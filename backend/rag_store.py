"""知识库文档存储层：块内容与向量。"""
import json
import sqlite3

import db


def replace_source(
    source: str, chunks: list[str], embeddings: list[list[float]]
) -> int:
    """整篇替换某来源的所有块；返回写入块数。"""
    now = db.now_iso()
    conn = db.get_conn()
    conn.execute("DELETE FROM documents WHERE source = ?", [source])
    conn.executemany(
        "INSERT INTO documents (source, chunk_index, content, embedding, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        [
            (source, index, chunk, json.dumps(vector), now)
            for index, (chunk, vector) in enumerate(zip(chunks, embeddings))
        ],
    )
    conn.commit()
    conn.close()
    return len(chunks)


def all_documents() -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, source, chunk_index, content, embedding"
        " FROM documents ORDER BY id"
    ).fetchall()
    conn.close()
    return [
        {
            "id": row["id"],
            "source": row["source"],
            "chunk_index": row["chunk_index"],
            "content": row["content"],
            "embedding": json.loads(row["embedding"]),
        }
        for row in rows
    ]


def count() -> int:
    conn = db.get_conn()
    row = conn.execute("SELECT COUNT(*) AS total FROM documents").fetchone()
    conn.close()
    return row["total"]


def clear() -> None:
    conn = db.get_conn()
    conn.execute("DELETE FROM documents")
    conn.commit()
    conn.close()
