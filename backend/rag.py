"""RAG 检索层：本地向量化 + 余弦检索 + 上下文拼装。

模型懒加载（首次使用才加载），测试里可 monkeypatch embed_texts 避开模型；
numpy 也在函数内导入，避免依赖未装好时整个服务起不来。

检索范围按用户隔离：站内公共库（`source_id IS NULL`）+ 该用户的个人知识库。

注意：fastembed 默认把模型放在系统临时目录（`/tmp/fastembed_cache`），重启/清理即丢，
丢失后会转去联网下载（国内访问 HuggingFace 会一直卡住、接口无响应）。
因此这里固定用持久目录 `~/.cache/fastembed`，并优先离线加载本地缓存。
"""
import os

import rag_store

MODEL_NAME = "BAAI/bge-small-zh-v1.5"
CACHE_DIR = os.environ.get("FASTEMBED_CACHE_DIR") or os.path.expanduser("~/.cache/fastembed")
DEFAULT_K = 4
DEFAULT_THRESHOLD = 0.3

_model = None


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


def is_ready(user_id: int | None = None) -> bool:
    return rag_store.count_for_user(user_id) > 0


def search(
    query: str,
    *,
    user_id: int | None = None,
    k: int = DEFAULT_K,
    threshold: float = DEFAULT_THRESHOLD,
) -> list[dict]:
    """返回相似度最高的 k 个块（低于阈值丢弃）。"""
    documents = rag_store.documents_for_user(user_id)
    if not documents:
        return []
    import numpy as np

    query_vector = np.array(embed_texts([query])[0], dtype=np.float32)
    matrix = np.array([doc["embedding"] for doc in documents], dtype=np.float32)
    scores = _cosine(matrix, query_vector)
    order = np.argsort(scores)[::-1][:k]
    return [
        {
            "source": documents[index]["source"],
            "label": documents[index]["label"] or documents[index]["source"],
            "content": documents[index]["content"],
            "score": float(scores[index]),
        }
        for index in order
        if float(scores[index]) >= threshold
    ]


def _cosine(matrix, vector):
    import numpy as np

    matrix_norm = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-8)
    vector_norm = vector / (np.linalg.norm(vector) + 1e-8)
    return matrix_norm @ vector_norm


def build_context(results: list[dict]) -> str:
    if not results:
        return ""
    return "\n\n".join(
        f"[{index}]（来源：{item.get('label') or item['source']}）\n{item['content']}"
        for index, item in enumerate(results, start=1)
    )
