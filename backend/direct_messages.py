"""好友私聊消息存储层。"""
import sqlite3

import db

HISTORY_DEFAULT_LIMIT = 50
HISTORY_MAX_LIMIT = 100


def _message(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "sender_id": row["sender_id"],
        "recipient_id": row["recipient_id"],
        "content": row["content"],
        "created_at": row["created_at"],
        "read_at": row["read_at"],
    }


def save_message(sender_id: int, recipient_id: int, content: str) -> dict:
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO direct_messages (sender_id, recipient_id, content, created_at)"
        " VALUES (?, ?, ?, ?)",
        [sender_id, recipient_id, content, now],
    )
    conn.commit()
    message_id = cur.lastrowid
    conn.close()
    return {
        "id": message_id,
        "sender_id": sender_id,
        "recipient_id": recipient_id,
        "content": content,
        "created_at": now,
        "read_at": None,
    }


def get_history(
    user_id: int,
    other_id: int,
    *,
    before: int | None = None,
    limit: int = HISTORY_DEFAULT_LIMIT,
) -> dict:
    """返回 {messages: 正序, has_more}；before 为游标（取 id 更小的消息）。"""
    params: list = [user_id, other_id, other_id, user_id]
    sql = (
        "SELECT * FROM direct_messages WHERE ("
        "(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))"
    )
    if before is not None:
        sql += " AND id < ?"
        params.append(before)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limit + 1)

    conn = db.get_conn()
    rows = conn.execute(sql, params).fetchall()
    conn.close()

    has_more = len(rows) > limit
    messages = [_message(row) for row in reversed(rows[:limit])]
    return {"messages": messages, "has_more": has_more}


def mark_read(user_id: int, other_id: int) -> int:
    """把 other_id 发给 user_id 的未读消息标记为已读，返回条数。"""
    conn = db.get_conn()
    cur = conn.execute(
        "UPDATE direct_messages SET read_at = ?"
        " WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL",
        [db.now_iso(), user_id, other_id],
    )
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


def clear_conversation(user_id: int, other_id: int) -> int:
    """清空与某位好友的全部消息，返回条数。"""
    conn = db.get_conn()
    cur = conn.execute(
        "DELETE FROM direct_messages WHERE"
        " (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
        [user_id, other_id, other_id, user_id],
    )
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return deleted


def clear_all(user_id: int) -> int:
    """清空我与所有好友的消息，返回条数。"""
    conn = db.get_conn()
    cur = conn.execute(
        "DELETE FROM direct_messages WHERE sender_id = ? OR recipient_id = ?",
        [user_id, user_id],
    )
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return deleted
