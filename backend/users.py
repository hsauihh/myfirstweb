"""用户、登录态与匿名额度的存储层。"""
import sqlite3

import db

ANONYMOUS_CHAT_LIMIT = 3        # 匿名访客可发送的用户消息条数上限


# ---------- 用户 ----------

def _user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "password_hash": row["password_hash"],
        "created_at": row["created_at"],
    }


def public_user(user: dict) -> dict:
    """去掉密码哈希，用于对外返回。"""
    return {
        "id": user["id"],
        "username": user["username"],
        "created_at": user["created_at"],
    }


def create_user(username: str, password_hash: str) -> dict:
    now = db.now_iso()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        [username, password_hash, now],
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()
    return {"id": user_id, "username": username, "created_at": now}


def get_user_by_username(username: str) -> dict | None:
    """含 password_hash，仅供登录校验使用。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM users WHERE username = ?", [username]
    ).fetchone()
    conn.close()
    return _user(row) if row else None


def get_user(user_id: int) -> dict | None:
    """含 password_hash；对外返回前请用 public_user。"""
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", [user_id]).fetchone()
    conn.close()
    return _user(row) if row else None


# ---------- 登录态 ----------

def create_auth_session(token: str, user_id: int, expires_at: str) -> None:
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO auth_sessions (token, user_id, created_at, expires_at)"
        " VALUES (?, ?, ?, ?)",
        [token, user_id, db.now_iso(), expires_at],
    )
    conn.commit()
    conn.close()


def get_auth_session(token: str) -> dict | None:
    """只返回未过期的会话；过期的顺手删掉。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM auth_sessions WHERE token = ? AND expires_at > ?",
        [token, db.now_iso()],
    ).fetchone()
    if row is None:
        conn.execute("DELETE FROM auth_sessions WHERE token = ?", [token])
        conn.commit()
    conn.close()
    return dict(row) if row else None


def delete_auth_session(token: str) -> None:
    conn = db.get_conn()
    conn.execute("DELETE FROM auth_sessions WHERE token = ?", [token])
    conn.commit()
    conn.close()


# ---------- 匿名数据迁移与额度 ----------

def bind_session_to_user(session_id: str, user_id: int) -> None:
    """把匿名会话产生的对话与历史绑到刚登录的账号。"""
    conn = db.get_conn()
    conn.execute(
        "UPDATE conversations SET user_id = ?"
        " WHERE session_id = ? AND user_id IS NULL",
        [user_id, session_id],
    )
    conn.execute(
        "UPDATE history SET user_id = ? WHERE session_id = ? AND user_id IS NULL",
        [user_id, session_id],
    )
    conn.commit()
    conn.close()


def get_anonymous_used(session_id: str) -> int:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT used FROM anonymous_usage WHERE session_id = ?", [session_id]
    ).fetchone()
    conn.close()
    return row["used"] if row else 0


def consume_anonymous_quota(session_id: str, limit: int) -> bool:
    """原子占用一次匿名额度；额度已满返回 False。"""
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO anonymous_usage (session_id, used, updated_at) VALUES (?, 1, ?)"
        " ON CONFLICT(session_id) DO UPDATE SET"
        " used = used + 1, updated_at = excluded.updated_at"
        " WHERE anonymous_usage.used < ?",
        [session_id, db.now_iso(), limit],
    )
    conn.commit()
    consumed = cur.rowcount == 1
    conn.close()
    return consumed
