"""个人知识库：把博客文章选入知识库，并保持与文章同步。

- 来源元数据在 `kb_sources`；块内容与向量复用 `documents` 表。
- 个人库块写 `source`（内部键）、`source_id`（指向来源行）、`label`（展示名）。
- 站内公共库（RAGdata 入库）没有来源行，检索时与本用户的个人库合并。
- 文章被编辑后由 `sync_user` 懒重建；删除或改非公开后移除来源，外键级联删块。
"""
import sqlite3

import db
import graph
import ingest
import rag
import rag_store

PUBLIC = "public"
DRAFT = "draft"

_SOURCE_SELECT = """
SELECT s.id AS source_id, s.post_id, s.post_updated_at, s.created_at,
       p.title, p.visibility, p.published_at, p.updated_at, p.author_id,
       u.username, u.avatar,
       (SELECT COUNT(*) FROM documents d WHERE d.source_id = s.id) AS chunks
FROM kb_sources s
JOIN posts p ON p.id = s.post_id
JOIN users u ON u.id = p.author_id
"""

_CANDIDATE_SELECT = """
SELECT p.id AS post_id, p.title, p.visibility, p.published_at, p.updated_at,
       p.author_id, u.username, u.avatar,
       EXISTS(
           SELECT 1 FROM kb_sources s WHERE s.user_id = ? AND s.post_id = p.id
       ) AS in_kb
FROM posts p JOIN users u ON u.id = p.author_id
"""


class KbSourceTooShort(Exception):
    """文章清洗后不足最小切块长度，无法入库。"""


def _source_key(user_id: int, post_id: int) -> str:
    return f"kb:{user_id}:{post_id}"


def _label(title: str, author: str) -> str:
    return f"《{title}》· {author}"


def _visibility(published_at: str | None, visibility: str) -> str:
    """存储行 → 对外三态（与 blog.py 一致：未发布即草稿）。"""
    return DRAFT if published_at is None else visibility


def _author(row: sqlite3.Row) -> dict:
    return {
        "id": row["author_id"],
        "username": row["username"],
        "avatar": row["avatar"],
    }


def _visible_to(row: sqlite3.Row, user_id: int) -> bool:
    """作者可见自己的全部，其他人只能看已发布且公开的文章。"""
    if row["author_id"] == user_id:
        return True
    return row["published_at"] is not None and row["visibility"] == PUBLIC


def _post_for_user(
    conn: sqlite3.Connection, user_id: int, post_id: int
) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT p.id, p.title, p.content, p.updated_at, p.visibility,"
        " p.published_at, p.author_id, u.username"
        " FROM posts p JOIN users u ON u.id = p.author_id"
        " WHERE p.id = ? AND (p.author_id = ?"
        " OR (p.published_at IS NOT NULL AND p.visibility = 'public'))",
        [post_id, user_id],
    ).fetchone()


def _source_row(
    conn: sqlite3.Connection, user_id: int, post_id: int
) -> sqlite3.Row | None:
    return conn.execute(
        _SOURCE_SELECT + " WHERE s.user_id = ? AND s.post_id = ?",
        [user_id, post_id],
    ).fetchone()


def _source_payload(row: sqlite3.Row) -> dict:
    return {
        "post_id": row["post_id"],
        "title": row["title"],
        "author": _author(row),
        "visibility": _visibility(row["published_at"], row["visibility"]),
        "chunks": row["chunks"],
        "added_at": row["created_at"],
        "stale": row["chunks"] == 0 or row["post_updated_at"] != row["updated_at"],
    }


def _chunks(title: str, content: str) -> list[dict]:
    """标题以纯文本前置（利于检索），section 只取文章内部的小节路径。"""
    return ingest.chunk_markdown(ingest.clean_markdown(f"{title}\n\n{content}"))


def _build_graph(user_id: int, post_id: int) -> None:
    """抽图是增强项：失败只打印，绝不影响入库与来源同步状态。"""
    key = _source_key(user_id, post_id)
    try:
        graph.build_for_source(key, max_chunks=graph.SOURCE_CHUNK_LIMIT)
    except Exception as error:
        print(f"图谱抽取失败（{key}）：{error}")


def _write_chunks(
    source_id: int, user_id: int, post_id: int, post: sqlite3.Row
) -> int:
    """切块 → 向量化 → 写库 → 建图，并把来源标记为「已按当前版本重建」。"""
    chunks = _chunks(post["title"], post["content"])
    if not chunks:
        raise KbSourceTooShort()
    embeddings = rag.embed_texts([chunk["content"] for chunk in chunks])
    rag_store.replace_source(
        _source_key(user_id, post_id),
        chunks,
        embeddings,
        label=_label(post["title"], post["username"]),
        source_id=source_id,
    )
    _build_graph(user_id, post_id)
    conn = db.get_conn()
    conn.execute(
        "UPDATE kb_sources SET post_updated_at = ? WHERE id = ?",
        [post["updated_at"], source_id],
    )
    conn.commit()
    conn.close()
    return len(chunks)


def _delete_source_row(source_id: int) -> None:
    conn = db.get_conn()
    conn.execute("DELETE FROM kb_sources WHERE id = ?", [source_id])
    conn.commit()
    conn.close()


def add_source(user_id: int, post_id: int) -> dict | None:
    """把文章加入用户知识库；文章不可见返回 None，已存在则幂等返回现有来源。"""
    conn = db.get_conn()
    try:
        post = _post_for_user(conn, user_id, post_id)
        if post is None:
            return None
        if _source_row(conn, user_id, post_id) is not None:
            return get_source(user_id, post_id)
        cur = conn.execute(
            "INSERT INTO kb_sources"
            " (user_id, post_id, source_key, post_updated_at, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            [
                user_id,
                post_id,
                _source_key(user_id, post_id),
                post["updated_at"],
                db.now_iso(),
            ],
        )
        source_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()

    try:
        _write_chunks(source_id, user_id, post_id, post)
    except Exception:
        _delete_source_row(source_id)
        raise
    return get_source(user_id, post_id)


def get_source(user_id: int, post_id: int) -> dict | None:
    conn = db.get_conn()
    row = _source_row(conn, user_id, post_id)
    conn.close()
    return _source_payload(row) if row else None


def list_sources(user_id: int) -> list[dict]:
    conn = db.get_conn()
    rows = conn.execute(
        _SOURCE_SELECT + " WHERE s.user_id = ? ORDER BY s.created_at DESC, s.id DESC",
        [user_id],
    ).fetchall()
    conn.close()
    return [_source_payload(row) for row in rows]


def has_source(user_id: int, post_id: int) -> bool:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT 1 FROM kb_sources WHERE user_id = ? AND post_id = ?",
        [user_id, post_id],
    ).fetchone()
    conn.close()
    return row is not None


def remove_source(user_id: int, post_id: int) -> int:
    conn = db.get_conn()
    cur = conn.execute(
        "DELETE FROM kb_sources WHERE user_id = ? AND post_id = ?",
        [user_id, post_id],
    )
    conn.commit()
    conn.close()
    return cur.rowcount


def remove_post_everywhere(post_id: int, except_user_id: int | None = None) -> int:
    """删除某文章的全部来源（可保留作者自己的那份）。"""
    conn = db.get_conn()
    if except_user_id is None:
        cur = conn.execute("DELETE FROM kb_sources WHERE post_id = ?", [post_id])
    else:
        cur = conn.execute(
            "DELETE FROM kb_sources WHERE post_id = ? AND user_id != ?",
            [post_id, except_user_id],
        )
    conn.commit()
    conn.close()
    return cur.rowcount


def _rebuild(user_id: int, row: sqlite3.Row) -> bool:
    """按文章当前内容重建来源；失败时保留旧块（下次再试）。"""
    conn = db.get_conn()
    post = conn.execute(
        "SELECT p.title, p.content, p.updated_at, u.username"
        " FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?",
        [row["post_id"]],
    ).fetchone()
    conn.close()
    if post is None:
        remove_source(user_id, row["post_id"])
        return False
    try:
        _write_chunks(row["source_id"], user_id, row["post_id"], post)
    except Exception:
        return False
    return True


def sync_user(user_id: int) -> int:
    """懒同步：清理已不可见的来源，重建内容已变化的来源；返回重建条数。"""
    conn = db.get_conn()
    rows = conn.execute(_SOURCE_SELECT + " WHERE s.user_id = ?", [user_id]).fetchall()
    conn.close()
    rebuilt = 0
    for row in rows:
        if not _visible_to(row, user_id):
            remove_source(user_id, row["post_id"])
        elif row["chunks"] == 0 or row["post_updated_at"] != row["updated_at"]:
            if _rebuild(user_id, row):
                rebuilt += 1
    return rebuilt


def sync_source(user_id: int, post_id: int) -> dict | None:
    """强制重建单个来源；不在知识库或已不可见返回 None。"""
    conn = db.get_conn()
    row = _source_row(conn, user_id, post_id)
    conn.close()
    if row is None:
        return None
    if not _visible_to(row, user_id):
        remove_source(user_id, post_id)
        return None
    _rebuild(user_id, row)
    return get_source(user_id, post_id)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _candidate_payload(row: sqlite3.Row) -> dict:
    return {
        "post_id": row["post_id"],
        "title": row["title"],
        "author": _author(row),
        "visibility": _visibility(row["published_at"], row["visibility"]),
        "published_at": row["published_at"],
        "updated_at": row["updated_at"],
        "in_kb": bool(row["in_kb"]),
    }


def candidates(
    user_id: int, query: str = "", limit: int = 20, offset: int = 0
) -> dict:
    """可加入知识库的文章：自己的全部 + 他人的公开文章，按标题模糊匹配。"""
    keyword = query.strip()
    pattern = f"%{_escape_like(keyword)}%"
    conn = db.get_conn()
    rows = conn.execute(
        _CANDIDATE_SELECT
        + " WHERE (p.author_id = ?"
        " OR (p.published_at IS NOT NULL AND p.visibility = 'public'))"
        " AND (? = '' OR p.title LIKE ? ESCAPE '\\')"
        " ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?",
        [user_id, user_id, keyword, pattern, limit + 1, offset],
    ).fetchall()
    conn.close()
    return {
        "items": [_candidate_payload(row) for row in rows[:limit]],
        "has_more": len(rows) > limit,
    }
