"""RAG 检索层：本地向量化 + 余弦检索 + 上下文拼装。

模型懒加载（首次使用才下载/加载），测试里可 monkeypatch embed_texts 避开模型；
numpy 也在函数内导入，避免依赖未装好时整个服务起不来。
"""
import rag_store

MODEL_NAME = "BAAI/bge-small-zh-v1.5"
DEFAULT_K = 4
DEFAULT_THRESHOLD = 0.3

_model = None


def _get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding

        _model = TextEmbedding(model_name=MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    return [vector.tolist() for vector in _get_model().embed(texts)]


def is_ready() -> bool:
    return rag_store.count() > 0


def search(
    query: str, *, k: int = DEFAULT_K, threshold: float = DEFAULT_THRESHOLD
) -> list[dict]:
    """返回相似度最高的 k 个块（低于阈值丢弃）。"""
    documents = rag_store.all_documents()
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
        f"[{index}]（来源：{item['source']}）\n{item['content']}"
        for index, item in enumerate(results, start=1)
    )
