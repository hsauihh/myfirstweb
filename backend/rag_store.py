"""知识库文档存储层：块内容与向量。

`source_id IS NULL` 表示站内公共库（RAGdata 入库）；非空表示某用户的个人知识库来源
（`kb_sources.kind` 区分文章与随心一记的笔记）。
向量单独放 `document_vectors`（float32 BLOB），与块正文分离：
既让 `documents` 保持可读的小体积，也让检索层能一次性把整库矩阵读进内存缓存。
"""
import sqlite3
import struct

import db

# kb_sources.kind 的取值（与 kb.py 保持一致，避免各处写字面量）
SOURCE_KIND_POST = "post"
SOURCE_KIND_NOTE = "note"
# 笔记在引用卡片里的标题长度
NOTE_TITLE_LIMIT = 24

_DOCUMENT_COLUMNS = (
    "id, source, chunk_index, content, section, source_id, label"
)


def pack_vector(values: list[float]) -> bytes:
    """float32 小端字节（显式字节序，不依赖平台）。"""
    return struct.pack(f"<{len(values)}f", *values)


def unpack_vector(blob: bytes, dim: int) -> tuple[float, ...]:
    return struct.unpack(f"<{dim}f", blob)


def replace_source(
    source: str,
    chunks: list[dict],
    embeddings: list[list[float]],
    *,
    label: str | None = None,
    source_id: int | None = None,
) -> int:
    """整篇替换某来源的所有块（含向量）；返回写入块数。

    chunks 每项形如 {"content": str, "section": str}，section 是块所属的标题路径。
    """
    now = db.now_iso()
    conn = db.get_conn()
    try:
        conn.execute("DELETE FROM documents WHERE source = ?", [source])
        for index, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            cur = conn.execute(
                "INSERT INTO documents"
                " (source, chunk_index, content, section, created_at, label, source_id)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    source,
                    index,
                    chunk["content"],
                    chunk.get("section", ""),
                    now,
                    label,
                    source_id,
                ],
            )
            conn.execute(
                "INSERT INTO document_vectors (document_id, dim, vector)"
                " VALUES (?, ?, ?)",
                [cur.lastrowid, len(vector), pack_vector(vector)],
            )
        conn.commit()
    finally:
        conn.close()
    return len(chunks)


def _document(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "source": row["source"],
        "chunk_index": row["chunk_index"],
        "content": row["content"],
        "section": row["section"],
        "source_id": row["source_id"],
        "label": row["label"],
    }


def visibility_clause(
    user_id: int | None, include_public: bool = True, alias: str = ""
) -> tuple[str, list]:
    """返回 documents 可见性过滤的 SQL 片段与参数（供 rag / graph 共用）。

    `source_id IS NULL` 是站内公共库；非空表示某个用户的个人库来源。
    """
    column = f"{alias}source_id" if alias else "source_id"
    if user_id is None:
        return f"{column} IS NULL", []
    personal = f"{column} IN (SELECT id FROM kb_sources WHERE user_id = ?)"
    if include_public:
        return f"({column} IS NULL OR {personal})", [user_id]
    return personal, [user_id]


def visible_ids(user_id: int | None, include_public: bool = True) -> list[int]:
    """该用户可见的块 id（轻量：不取正文与向量，用于检索前过滤）。"""
    where, params = visibility_clause(user_id, include_public)
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT id FROM documents WHERE {where} ORDER BY id", params
    ).fetchall()
    conn.close()
    return [row["id"] for row in rows]


def documents_by_ids(ids: list[int]) -> dict[int, dict]:
    """按 id 取块正文与元数据（只取入选的少数块，不碰向量）。"""
    if not ids:
        return {}
    placeholders = ", ".join("?" for _ in ids)
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT {_DOCUMENT_COLUMNS} FROM documents WHERE id IN ({placeholders})",
        ids,
    ).fetchall()
    conn.close()
    return {row["id"]: _document(row) for row in rows}


def chunks_for_source(source: str) -> list[dict]:
    """某来源的全部块（按块序），供图谱抽取建立块-实体关联。"""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, content FROM documents WHERE source = ? ORDER BY chunk_index",
        [source],
    ).fetchall()
    conn.close()
    return [{"id": row["id"], "content": row["content"]} for row in rows]


def all_vectors() -> tuple[list[int], list[bytes]]:
    """整库向量：按 document_id 升序返回 (ids, 字节串)。"""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT document_id, vector FROM document_vectors ORDER BY document_id"
    ).fetchall()
    conn.close()
    return [row["document_id"] for row in rows], [row["vector"] for row in rows]


def vector_fingerprint() -> tuple[int, int]:
    """向量库指纹（条数 + 最大 id）：变了才需要重建内存矩阵。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT COUNT(*) AS total, COALESCE(MAX(document_id), 0) AS last"
        " FROM document_vectors"
    ).fetchone()
    conn.close()
    return (row["total"], row["last"])


def source_targets(source_ids: list[int]) -> dict[int, dict]:
    """个人库来源的跳转信息：来源 id → 文章（标题/作者/文章 id）或笔记（预览文本）。

    笔记没有网页可跳，所以只给预览标题与 note_id，前端弹片段展示。
    """
    if not source_ids:
        return {}
    placeholders = ", ".join("?" for _ in source_ids)
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT s.id AS source_id, s.kind AS kind, s.note_content AS note_content,"
        " p.id AS post_id, p.title AS title, u.username AS author"
        " FROM kb_sources s"
        " LEFT JOIN posts p ON p.id = s.post_id"
        " LEFT JOIN users u ON u.id = p.author_id"
        f" WHERE s.id IN ({placeholders})",
        source_ids,
    ).fetchall()
    conn.close()
    targets: dict[int, dict] = {}
    for row in rows:
        if row["kind"] == SOURCE_KIND_NOTE:
            targets[row["source_id"]] = {
                "kind": SOURCE_KIND_NOTE,
                "note_id": row["source_id"],
                "post_id": None,
                "title": note_title(row["note_content"]),
                "author": None,
            }
            continue
        targets[row["source_id"]] = {
            "kind": SOURCE_KIND_POST,
            "note_id": None,
            "post_id": row["post_id"],
            "title": row["title"],
            "author": row["author"],
        }
    return targets


def note_title(content: str | None) -> str:
    """笔记的引用标题：取第一行并截断，让来源卡片能区分不同笔记。"""
    text = (content or "").strip()
    if not text:
        return "随心一记"
    first = text.splitlines()[0].strip()
    return first[:NOTE_TITLE_LIMIT] + ("…" if len(first) > NOTE_TITLE_LIMIT else "")


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
