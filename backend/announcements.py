"""公告存储层：创建、按用户读取（带已读标记）、标记已读。"""
import sqlite3

import db


def _announcement(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "created_at": row["created_at"],
    }


def create(title: str, body: str) -> dict:
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO announcements (title, body, created_at) VALUES (?, ?, ?)",
        [title, body, now],
    )
    conn.commit()
    announcement_id = cur.lastrowid
    conn.close()
    return {"id": announcement_id, "title": title, "body": body, "created_at": now}


def list_for(user_id: int) -> dict:
    """返回 {items: 按时间倒序带 read 标记, unread: 未读数}。"""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT a.id, a.title, a.body, a.created_at,"
        " (r.user_id IS NOT NULL) AS read"
        " FROM announcements a"
        " LEFT JOIN announcement_reads r"
        "   ON r.announcement_id = a.id AND r.user_id = ?"
        " ORDER BY a.id DESC",
        [user_id],
    ).fetchall()
    conn.close()
    items = [{**_announcement(row), "read": bool(row["read"])} for row in rows]
    return {"items": items, "unread": sum(1 for item in items if not item["read"])}


def list_public(limit: int) -> list[dict]:
    """公开只读列表（首页公告栗用）：不带已读状态，也不需要登录。"""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, title, body, created_at FROM announcements"
        " ORDER BY id DESC LIMIT ?",
        [limit],
    ).fetchall()
    conn.close()
    return [_announcement(row) for row in rows]


def mark_read(user_id: int, announcement_id: int) -> bool:
    conn = db.get_conn()
    exists = conn.execute(
        "SELECT 1 FROM announcements WHERE id = ?", [announcement_id]
    ).fetchone()
    if exists is None:
        conn.close()
        return False
    conn.execute(
        "INSERT OR IGNORE INTO announcement_reads (user_id, announcement_id, read_at)"
        " VALUES (?, ?, ?)",
        [user_id, announcement_id, db.now_iso()],
    )
    conn.commit()
    conn.close()
    return True


def unread_count(user_id: int) -> int:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT COUNT(*) AS total FROM announcements a"
        " WHERE NOT EXISTS (SELECT 1 FROM announcement_reads r"
        "   WHERE r.announcement_id = a.id AND r.user_id = ?)",
        [user_id],
    ).fetchone()
    conn.close()
    return row["total"]
