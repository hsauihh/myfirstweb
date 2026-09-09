"""存储层：分析历史 + AI 会话与消息，全部按 Owner 归属查询。"""
import sqlite3

import db
from db import Owner, owner_clause


# ---------- 分析历史 ----------

def save_record(owner: Owner, record: dict) -> None:
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO history (session_id, user_id, text, score, label, pinyin, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        [owner.session_id, owner.user_id, record["text"], record["score"],
         record["label"], record["pinyin"], record["created_at"]],
    )
    conn.commit()
    conn.close()


def get_history(owner: Owner, limit: int) -> list[dict]:
    clause, params = owner_clause(owner)
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT * FROM history WHERE {clause} ORDER BY created_at DESC LIMIT ?",
        [*params, limit],
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def clear_history(owner: Owner) -> int:
    """删除该归属的全部历史记录，返回被删除的条数。"""
    clause, params = owner_clause(owner)
    conn = db.get_conn()
    cur = conn.execute(f"DELETE FROM history WHERE {clause}", params)
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return deleted


# ---------- AI 会话 ----------

def _conversation(row: sqlite3.Row) -> dict:
    """把数据库行转成对外结构，不外泄 session_id / user_id。"""
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_conversation(owner: Owner, title: str) -> dict:
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO conversations (session_id, user_id, title, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?)",
        [owner.session_id, owner.user_id, title, now, now],
    )
    conn.commit()
    conversation_id = cur.lastrowid
    conn.close()
    return {
        "id": conversation_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
    }


def list_conversations(owner: Owner, limit: int) -> list[dict]:
    clause, params = owner_clause(owner)
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT * FROM conversations WHERE {clause}"
        " ORDER BY updated_at DESC, id DESC LIMIT ?",
        [*params, limit],
    ).fetchall()
    conn.close()
    return [_conversation(row) for row in rows]


def get_conversation(owner: Owner, conversation_id: int) -> dict | None:
    """按归属查询会话；不属于该归属时返回 None。"""
    clause, params = owner_clause(owner)
    conn = db.get_conn()
    row = conn.execute(
        f"SELECT * FROM conversations WHERE id = ? AND {clause}",
        [conversation_id, *params],
    ).fetchone()
    conn.close()
    return _conversation(row) if row else None


def rename_conversation(conversation_id: int, title: str) -> None:
    conn = db.get_conn()
    conn.execute(
        "UPDATE conversations SET title = ? WHERE id = ?", [title, conversation_id]
    )
    conn.commit()
    conn.close()


def touch_conversation(conversation_id: int) -> dict | None:
    """刷新会话的 updated_at 并返回更新后的会话。"""
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?", [now, conversation_id]
    )
    row = cur.execute(
        "SELECT * FROM conversations WHERE id = ?", [conversation_id]
    ).fetchone()
    conn.commit()
    conn.close()
    return _conversation(row) if row else None


def delete_conversation(owner: Owner, conversation_id: int) -> int:
    """删除会话及其全部消息，返回删除的会话与消息条数之和；非本归属返回 0。"""
    clause, params = owner_clause(owner)
    conn = db.get_conn()
    cur = conn.cursor()
    owned = cur.execute(
        f"SELECT id FROM conversations WHERE id = ? AND {clause}",
        [conversation_id, *params],
    ).fetchone()
    if owned is None:
        conn.close()
        return 0
    cur.execute("DELETE FROM messages WHERE conversation_id = ?", [conversation_id])
    messages_deleted = cur.rowcount
    cur.execute("DELETE FROM conversations WHERE id = ?", [conversation_id])
    conn.commit()
    conn.close()
    return messages_deleted + 1


# ---------- 会话消息 ----------

def _message(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "role": row["role"],
        "content": row["content"],
        "created_at": row["created_at"],
    }


def add_message(conversation_id: int, role: str, content: str) -> dict:
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO messages (conversation_id, role, content, created_at)"
        " VALUES (?, ?, ?, ?)",
        [conversation_id, role, content, now],
    )
    conn.commit()
    message_id = cur.lastrowid
    conn.close()
    return {"id": message_id, "role": role, "content": content, "created_at": now}


def get_messages(conversation_id: int, limit: int | None = None) -> list[dict]:
    """按时间正序返回消息；limit 给定时只取最近 limit 条（仍按正序）。"""
    conn = db.get_conn()
    if limit is None:
        rows = conn.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC",
            [conversation_id],
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM ("
            "  SELECT * FROM messages WHERE conversation_id = ?"
            "  ORDER BY id DESC LIMIT ?"
            ") ORDER BY id ASC",
            [conversation_id, limit],
        ).fetchall()
    conn.close()
    return [_message(row) for row in rows]
