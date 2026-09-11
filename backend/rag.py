"""RAG 检索层：本地向量化 + 图谱扩展 + 可溯源引用。

模型懒加载（首次使用才加载），测试里可 monkeypatch embed_texts 避开模型；
numpy 也在函数内导入，避免依赖未装好时整个服务起不来。

检索三步：
1. 整库向量矩阵缓存在进程内（指纹变了才重建，不再每次解析 JSON 向量）；
2. 向量召回 top-k 作为种子，再从「种子块提到的实体」做一跳图谱扩展；
3. 产出可渲染、可落库的引用（`citations`），每条都带文章、小节与命中片段。

检索范围按用户隔离：站内公共库（`source_id IS NULL`）+ 该用户的个人知识库。

注意：fastembed 默认把模型放在系统临时目录（`/tmp/fastembed_cache`），重启/清理即丢，
丢失后会转去联网下载（国内访问 HuggingFace 会一直卡住、接口无响应）。
因此这里固定用持久目录 `~/.cache/fastembed`，并优先离线加载本地缓存。
"""
import os
from dataclasses import dataclass

import graph_store
import rag_store

MODEL_NAME = "BAAI/bge-small-zh-v1.5"
CACHE_DIR = os.environ.get("FASTEMBED_CACHE_DIR") or os.path.expanduser("~/.cache/fastembed")
DEFAULT_K = 4
SEED_K = 6                       # 图谱扩展的向量种子数
DEFAULT_THRESHOLD = 0.3
MAX_CONTEXT_CHUNKS = 8           # 最终进提示词的块数上限（也就是可引用项上限）
MAX_CONTEXT_RELATIONS = 10
SNIPPET_LIMIT = 600              # 引用片段截断长度
POST_KIND = "post"               # 来源类型：个人知识库里的博客文章
PUBLIC_KIND = "public"           # 来源类型：站内公共资料

_model = None


@dataclass(frozen=True)
class _VectorIndex:
    """整库向量矩阵与 id → 行号映射；指纹不变就复用。"""
    fingerprint: tuple[int, int]
    ids: list[int]
    positions: dict[int, int]
    matrix: "np.ndarray"


_index: _VectorIndex | None = None


def _get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding

        try:
            # 优先用本地缓存离线加载，避免联网校验卡住
            _model = TextEmbedding(
                MODEL_NAME, cache_dir=CACHE_DIR, local_files_only=True
            )
        except Exception:
            # 缓存缺失时才允许联网下载（首次部署可配 HF_ENDPOINT 镜像）
            _model = TextEmbedding(MODEL_NAME, cache_dir=CACHE_DIR)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    return [vector.tolist() for vector in _get_model().embed(texts)]


def is_ready(user_id: int | None = None, include_public: bool = True) -> bool:
    return rag_store.count_for_user(user_id, include_public) > 0


def _vector_index() -> _VectorIndex:
    """整库向量矩阵（带指纹缓存）：库增删改后才重建。"""
    global _index
    import numpy as np

    fingerprint = rag_store.vector_fingerprint()
    if _index is not None and _index.fingerprint == fingerprint:
        return _index
    ids, blobs = rag_store.all_vectors()
    matrix = (
        np.vstack([np.frombuffer(blob, dtype="<f4") for blob in blobs])
        if blobs
        else np.zeros((0, 0), dtype=np.float32)
    )
    _index = _VectorIndex(
        fingerprint=fingerprint,
        ids=ids,
        positions={document_id: row for row, document_id in enumerate(ids)},
        matrix=matrix,
    )
    return _index


def _cosine(matrix, vector):
    import numpy as np

    matrix_norm = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-8)
    vector_norm = vector / (np.linalg.norm(vector) + 1e-8)
    return matrix_norm @ vector_norm


def _rank_visible(
    query: str, user_id: int | None, include_public: bool
) -> list[tuple[int, float]]:
    """按余弦相似度给该用户可见的块排序，返回 (document_id, score)。"""
    import numpy as np

    index = _vector_index()
    visible = rag_store.visible_ids(user_id, include_public)
    if not visible or index.matrix.size == 0:
        return []
    query_vector = np.asarray(embed_texts([query])[0], dtype=np.float32)
    scores = _cosine(index.matrix, query_vector)
    rows = [index.positions[doc_id] for doc_id in visible if doc_id in index.positions]
    rows.sort(key=lambda row: scores[row], reverse=True)
    return [(index.ids[row], float(scores[row])) for row in rows]


def _chunk(document: dict, score: float | None, via: str) -> dict:
    return {
        "id": document["id"],
        "source": document["source"],
        "source_id": document["source_id"],
        "label": document["label"] or document["source"],
        "section": document["section"],
        "content": document["content"],
        "score": score,
        "via": via,
    }


def _graph_hits(
    seed_ids: list[int], user_id: int | None, include_public: bool
) -> tuple[list[int], list[dict]]:
    """从种子块出发做一跳图谱扩展；无图数据时返回空结果。"""
    entity_ids = graph_store.entities_for_chunks(seed_ids)
    if not entity_ids:
        return [], []
    neighbors = graph_store.neighbor_chunks(
        entity_ids,
        user_id=user_id,
        include_public=include_public,
        exclude_ids=seed_ids,
        limit=MAX_CONTEXT_CHUNKS,
    )
    relations = graph_store.relations_between(
        entity_ids,
        user_id=user_id,
        include_public=include_public,
        limit=MAX_CONTEXT_RELATIONS,
    )
    return [item["id"] for item in neighbors], relations


def retrieve(
    query: str,
    *,
    user_id: int | None = None,
    include_public: bool = True,
    k: int = SEED_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> dict:
    """向量召回 + 图谱一跳扩展，返回 {"chunks": [...], "relations": [...]}。

    扩展块不受相似度阈值约束（它们本来就不靠相似度进来），但必须命中至少一个
    种子实体；图谱不可用时结果与纯向量检索一致。
    """
    ranked = _rank_visible(query, user_id, include_public)
    if not ranked:
        return {"chunks": [], "relations": []}
    seeds = [(doc_id, score) for doc_id, score in ranked[:k] if score >= threshold]
    seed_ids = [doc_id for doc_id, _ in seeds]
    neighbor_ids, relations = _graph_hits(seed_ids, user_id, include_public)
    documents = rag_store.documents_by_ids([*seed_ids, *neighbor_ids])
    chunks = [
        _chunk(documents[doc_id], score, "vector")
        for doc_id, score in seeds
        if doc_id in documents
    ]
    chunks += [
        _chunk(documents[doc_id], None, "graph")
        for doc_id in neighbor_ids
        if doc_id in documents
    ]
    return {"chunks": chunks[:MAX_CONTEXT_CHUNKS], "relations": relations}


def _snippet(content: str) -> str:
    if len(content) <= SNIPPET_LIMIT:
        return content
    return content[:SNIPPET_LIMIT] + "…"


def _citation(index: int, item: dict, target: dict | None) -> dict:
    """一条引用：index 与上下文里的 [n] 编号一致。

    个人来源带 post_id / 标题 / 作者（前端据此跳原文）；公共资料（RAGdata 未随站点
    发布）没有网页可跳，只给文件名与小节，正文片段由前端弹层展示。
    """
    personal = item["source_id"] is not None
    citation = {
        "index": index,
        "kind": POST_KIND if personal else PUBLIC_KIND,
        "title": os.path.basename(item["source"]),
        "author": None,
        "label": item["label"],
        "section": item["section"],
        "post_id": None,
        "snippet": _snippet(item["content"]),
        "score": item["score"],
        "via": item["via"],
    }
    if target:
        citation["title"] = target["title"]
        citation["author"] = target["author"]
        citation["post_id"] = target["post_id"]
    return citation


def citations(retrieval: dict) -> list[dict]:
    """把检索结果转成可渲染、可随消息落库的来源引用。"""
    chunks = retrieval.get("chunks") or []
    if not chunks:
        return []
    targets = rag_store.source_targets(
        [item["source_id"] for item in chunks if item["source_id"] is not None]
    )
    return [
        _citation(index, item, targets.get(item["source_id"]))
        for index, item in enumerate(chunks, start=1)
    ]


RELATION_HEADING = "关联（来自知识图谱）："


def _reference(index: int, item: dict) -> str:
    parts = [f"来源：{item.get('label') or item['source']}"]
    if item.get("section"):
        parts.append(f"小节：{item['section']}")
    return f"[{index}]（{' · '.join(parts)}）\n{item['content']}"


def build_context(retrieval: dict) -> str:
    """把检索结果拼成提示词里的「参考资料」段（含可选的图谱关联）。"""
    chunks = retrieval.get("chunks") or []
    if not chunks:
        return ""
    text = "\n\n".join(
        _reference(index, item) for index, item in enumerate(chunks, start=1)
    )
    relations = retrieval.get("relations") or []
    if relations:
        lines = "\n".join(
            f"- {item['src']} → {item['dst']}：{item['relation']}" for item in relations
        )
        text = f"{text}\n\n{RELATION_HEADING}\n{lines}"
    return text
