"""知识库文档存储层：块内容与向量。

`source_id IS NULL` 表示站内公共库（RAGdata 入库）；非空表示某用户的个人知识库来源。
"""
import json
import sqlite3

import db

_DOCUMENT_COLUMNS = (
    "id, source, chunk_index, content, embedding, source_id, label"
)


def replace_source(
    source: str,
    chunks: list[str],
    embeddings: list[list[float]],
    *,
    label: str | None = None,
    source_id: int | None = None,
) -> int:
    """整篇替换某来源的所有块；返回写入块数。"""
    now = db.now_iso()
    conn = db.get_conn()
    conn.execute("DELETE FROM documents WHERE source = ?", [source])
    conn.executemany(
        "INSERT INTO documents"
        " (source, chunk_index, content, embedding, created_at, label, source_id)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (source, index, chunk, json.dumps(vector), now, label, source_id)
            for index, (chunk, vector) in enumerate(zip(chunks, embeddings))
        ],
    )
    conn.commit()
    conn.close()
    return len(chunks)


def _document(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "source": row["source"],
        "chunk_index": row["chunk_index"],
        "content": row["content"],
        "embedding": json.loads(row["embedding"]),
        "label": row["label"],
    }


def all_documents() -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT {_DOCUMENT_COLUMNS} FROM documents ORDER BY id"
    ).fetchall()
    conn.close()
    return [_document(row) for row in rows]


def documents_for_user(
    user_id: int | None, include_public: bool = True
) -> list[dict]:
    """该用户可见的块：可含站内公共库，加上他自己的个人库。"""
    conn = db.get_conn()
    if user_id is None:
        rows = conn.execute(
            f"SELECT {_DOCUMENT_COLUMNS} FROM documents"
            " WHERE source_id IS NULL ORDER BY id"
        ).fetchall()
    elif include_public:
        rows = conn.execute(
            f"SELECT {_DOCUMENT_COLUMNS} FROM documents"
            " WHERE source_id IS NULL OR source_id IN"
            " (SELECT id FROM kb_sources WHERE user_id = ?)"
            " ORDER BY id",
            [user_id],
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT {_DOCUMENT_COLUMNS} FROM documents"
            " WHERE source_id IN (SELECT id FROM kb_sources WHERE user_id = ?)"
            " ORDER BY id",
            [user_id],
        ).fetchall()
    conn.close()
    return [_document(row) for row in rows]


def _count(where: str, params: list) -> int:
    conn = db.get_conn()
    row = conn.execute(
        f"SELECT COUNT(*) AS total FROM documents WHERE {where}", params
    ).fetchone()
    conn.close()
    return row["total"]


def count_public() -> int:
    return _count("source_id IS NULL", [])


def count_personal(user_id: int) -> int:
    return _count("source_id IN (SELECT id FROM kb_sources WHERE user_id = ?)", [user_id])


def count_for_user(user_id: int | None, include_public: bool = True) -> int:
    if user_id is None:
        return count_public()
    if include_public:
        return count_public() + count_personal(user_id)
    return count_personal(user_id)


def count() -> int:
    return _count("1 = 1", [])


def clear() -> None:
    """只清空站内公共库，保留用户个人库。"""
    conn = db.get_conn()
    conn.execute("DELETE FROM documents WHERE source_id IS NULL")
    conn.commit()
    conn.close()
