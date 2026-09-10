"""博客存储层：文章与点赞。

对外三态：draft（草稿，未发布）/ private（已发布，仅自己可见）/ public（已发布，公开）。
存储仍只有两列：visibility ∈ {private, public} + published_at；published_at 为空即草稿。
作者归属校验一律在这里做，查不到或不属于作者时返回 None。
"""
import re
import sqlite3

import db

PUBLIC = "public"
PRIVATE = "private"
DRAFT = "draft"

SORT_PUBLISHED = "published"
SORT_LIKES = "likes"

TITLE_MAX_LENGTH = 100
CONTENT_MAX_LENGTH = 50000
EXCERPT_LENGTH = 120
DEFAULT_LIMIT = 10
MY_LIMIT = 50
MAX_LIMIT = 50

_CODE_BLOCK = re.compile(r"```[\s\S]*?```")
_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
_MARKS = re.compile(r"[#>*_~`]+")

_ORDER = {
    SORT_PUBLISHED: "p.published_at DESC, p.id DESC",
    SORT_LIKES: "like_count DESC, p.published_at DESC, p.id DESC",
}


def _excerpt(content: str) -> str:
    """从 Markdown 正文提取纯文本摘要。"""
    text = _CODE_BLOCK.sub(" ", content)
    text = _IMAGE.sub(" ", text)
    text = _LINK.sub(r"\1", text)
    text = _MARKS.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > EXCERPT_LENGTH:
        return text[:EXCERPT_LENGTH] + "…"
    return text


def _visibility(row: sqlite3.Row) -> str:
    """存储行 → 对外三态。"""
    if row["published_at"] is None:
        return DRAFT
    return row["visibility"]


def _storage(visibility: str, published_at: str | None) -> tuple[str, str | None]:
    """对外三态 → 存储的 (visibility, published_at)。"""
    if visibility == DRAFT:
        return PRIVATE, None
    stored = PUBLIC if visibility == PUBLIC else PRIVATE
    return stored, published_at or db.now_iso()


def _post(row: sqlite3.Row) -> dict:
    """数据库行 → 原始文章结构。"""
    return {
        "id": row["id"],
        "author_id": row["author_id"],
        "title": row["title"],
        "content": row["content"],
        "visibility": _visibility(row),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_at": row["published_at"],
    }


def _author(row: sqlite3.Row) -> dict:
    return {
        "id": row["author_id"],
        "username": row["username"],
        "avatar": row["avatar"],
    }


def _liked_ids(
    conn: sqlite3.Connection, viewer_id: int | None, post_ids: list[int]
) -> set[int]:
    """当前用户在这批文章里点过赞的 id 集合。"""
    if viewer_id is None or not post_ids:
        return set()
    marks = ",".join("?" * len(post_ids))
    rows = conn.execute(
        f"SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN ({marks})",
        [viewer_id, *post_ids],
    ).fetchall()
    return {row["post_id"] for row in rows}


def _can_view(row: sqlite3.Row, viewer_id: int | None) -> bool:
    """作者本人，或「已发布且公开」的文章可见。"""
    if viewer_id is not None and row["author_id"] == viewer_id:
        return True
    return row["published_at"] is not None and row["visibility"] == PUBLIC


def _card(row: sqlite3.Row, liked: set[int]) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "excerpt": _excerpt(row["content"]),
        "author": _author(row),
        "visibility": _visibility(row),
        "published_at": row["published_at"],
        "updated_at": row["updated_at"],
        "like_count": row["like_count"],
        "liked_by_me": row["id"] in liked,
    }


_CARD_SQL = """
SELECT p.id, p.author_id, p.title, p.content, p.visibility, p.created_at,
       p.updated_at, p.published_at, u.username, u.avatar,
       (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count
FROM posts p JOIN users u ON u.id = p.author_id
"""


def create_post(author_id: int, title: str, content: str, visibility: str) -> dict:
    now = db.now_iso()
    stored, published_at = _storage(visibility, None)
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO posts (author_id, title, content, visibility,"
        " created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [author_id, title, content, stored, now, now, published_at],
    )
    conn.commit()
    post_id = cur.lastrowid
    conn.close()
    return get_post(post_id)


def get_post(post_id: int) -> dict | None:
    """按 id 取原始文章（不做可见性判断）。"""
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM posts WHERE id = ?", [post_id]).fetchone()
    conn.close()
    return _post(row) if row else None


def get_post_detail(post_id: int, viewer_id: int | None) -> dict | None:
    """取详情；对本人不可见的文章返回 None（对外表现为 404）。"""
    conn = db.get_conn()
    row = conn.execute(_CARD_SQL + " WHERE p.id = ?", [post_id]).fetchone()
    if row is None or not _can_view(row, viewer_id):
        conn.close()
        return None
    liked = _liked_ids(conn, viewer_id, [post_id])
    conn.close()
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "visibility": _visibility(row),
        "author": _author(row),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "published_at": row["published_at"],
        "like_count": row["like_count"],
        "liked_by_me": post_id in liked,
        "can_edit": row["author_id"] == viewer_id,
    }


def update_post(
    author_id: int,
    post_id: int,
    title: str | None = None,
    content: str | None = None,
    visibility: str | None = None,
) -> dict | None:
    """更新文章；非作者或不存在返回 None。"""
    existing = get_post(post_id)
    if existing is None or existing["author_id"] != author_id:
        return None

    new_visibility = visibility or existing["visibility"]
    stored, published_at = _storage(new_visibility, existing["published_at"])

    conn = db.get_conn()
    conn.execute(
        "UPDATE posts SET title = ?, content = ?, visibility = ?,"
        " updated_at = ?, published_at = ? WHERE id = ?",
        [
            title if title is not None else existing["title"],
            content if content is not None else existing["content"],
            stored,
            db.now_iso(),
            published_at,
            post_id,
        ],
    )
    conn.commit()
    conn.close()
    return get_post(post_id)


def delete_post(actor_id: int, post_id: int, is_admin: bool = False) -> int:
    """删除文章：作者本人，或管理员删除公开文章；否则返回 0。"""
    post = get_post(post_id)
    if post is None:
        return 0
    if post["author_id"] != actor_id and not (is_admin and post["visibility"] == PUBLIC):
        return 0

    conn = db.get_conn()
    cur = conn.execute("DELETE FROM posts WHERE id = ?", [post_id])
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return deleted


def list_public_posts(
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
    viewer_id: int | None = None,
    sort: str = SORT_PUBLISHED,
) -> dict:
    """公开文章列表，按发布时间或点赞量倒序。"""
    order = _ORDER.get(sort, _ORDER[SORT_PUBLISHED])
    conn = db.get_conn()
    rows = conn.execute(
        _CARD_SQL
        + " WHERE p.published_at IS NOT NULL AND p.visibility = ?"
        + f" ORDER BY {order} LIMIT ? OFFSET ?",
        [PUBLIC, limit + 1, offset],
    ).fetchall()
    has_more = len(rows) > limit
    rows = rows[:limit]
    liked = _liked_ids(conn, viewer_id, [row["id"] for row in rows])
    conn.close()
    return {"items": [_card(row, liked) for row in rows], "has_more": has_more}


def list_my_posts(author_id: int, limit: int = MY_LIMIT, offset: int = 0) -> dict:
    """我的全部文章（含草稿），按更新时间倒序。"""
    conn = db.get_conn()
    rows = conn.execute(
        _CARD_SQL
        + " WHERE p.author_id = ? ORDER BY p.updated_at DESC, p.id DESC"
        " LIMIT ? OFFSET ?",
        [author_id, limit + 1, offset],
    ).fetchall()
    has_more = len(rows) > limit
    rows = rows[:limit]
    liked = _liked_ids(conn, author_id, [row["id"] for row in rows])
    conn.close()
    return {"items": [_card(row, liked) for row in rows], "has_more": has_more}


def toggle_like(user_id: int, post_id: int) -> dict | None:
    """切换点赞；文章对本人不可见时返回 None。"""
    post = get_post(post_id)
    if post is None:
        return None
    if post["author_id"] != user_id and post["visibility"] != PUBLIC:
        return None

    conn = db.get_conn()
    existing = conn.execute(
        "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
        [post_id, user_id],
    ).fetchone()
    if existing:
        conn.execute(
            "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
            [post_id, user_id],
        )
        liked = False
    else:
        conn.execute(
            "INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
            [post_id, user_id, db.now_iso()],
        )
        liked = True
    count = conn.execute(
        "SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?", [post_id]
    ).fetchone()["c"]
    conn.commit()
    conn.close()
    return {"liked": liked, "like_count": count}
