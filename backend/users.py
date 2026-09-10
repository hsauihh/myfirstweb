"""用户、登录态、VIP 与额度的存储层。"""
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import db


# ---------- 用户 ----------

def _user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "password_hash": row["password_hash"],
        "avatar": row["avatar"],
        "vip_expires_at": row["vip_expires_at"],
        "created_at": row["created_at"],
    }


def is_vip(user: dict) -> bool:
    """VIP 是否在有效期内。"""
    expires = user.get("vip_expires_at")
    return bool(expires) and expires > db.now_iso()


def is_admin(user: dict | None) -> bool:
    """管理员：用户名出现在 ADMIN_USERNAMES（逗号分隔）里。"""
    if not user:
        return False
    names = os.environ.get("ADMIN_USERNAMES", "")
    return user["username"] in {name.strip() for name in names.split(",") if name.strip()}


def public_user(user: dict) -> dict:
    """去掉密码哈希，用于对外返回。"""
    return {
        "id": user["id"],
        "username": user["username"],
        "avatar": user.get("avatar"),
        "vip": is_vip(user),
        "vip_expires_at": user.get("vip_expires_at"),
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
    return {
        "id": user_id,
        "username": username,
        "avatar": None,
        "vip_expires_at": None,
        "created_at": now,
    }


def activate_vip(user_id: int, days: int) -> dict | None:
    """开通/续费 VIP：从 max(现在, 当前到期) 起加 days 天。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT vip_expires_at FROM users WHERE id = ?", [user_id]
    ).fetchone()
    if row is None:
        conn.close()
        return None
    now = datetime.now(timezone.utc)
    base = now
    if row["vip_expires_at"]:
        try:
            existing = datetime.fromisoformat(row["vip_expires_at"])
            if existing > now:
                base = existing
        except ValueError:
            pass
    expires = (base + timedelta(days=days)).isoformat()
    conn.execute(
        "UPDATE users SET vip_expires_at = ? WHERE id = ?", [expires, user_id]
    )
    conn.commit()
    conn.close()
    return get_user(user_id)


def set_avatar(user_id: int, path: str) -> dict | None:
    """更新头像路径并返回更新后的用户。"""
    conn = db.get_conn()
    conn.execute("UPDATE users SET avatar = ? WHERE id = ?", [path, user_id])
    conn.commit()
    conn.close()
    return get_user(user_id)


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


def get_daily_used(user_id: int, day: str) -> int:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT used FROM chat_daily_usage WHERE user_id = ? AND day = ?",
        [user_id, day],
    ).fetchone()
    conn.close()
    return row["used"] if row else 0


def consume_daily_quota(user_id: int, day: str, limit: int) -> bool:
    """原子占用一次当日额度；额度已满返回 False。"""
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO chat_daily_usage (user_id, day, used) VALUES (?, ?, 1)"
        " ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1"
        " WHERE chat_daily_usage.used < ?",
        [user_id, day, limit],
    )
    conn.commit()
    consumed = cur.rowcount == 1
    conn.close()
    return consumed


def get_rag_daily_used(user_id: int, day: str) -> int:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT used FROM rag_daily_usage WHERE user_id = ? AND day = ?",
        [user_id, day],
    ).fetchone()
    conn.close()
    return row["used"] if row else 0


def consume_rag_daily_quota(user_id: int, day: str, limit: int) -> bool:
    """原子占用一次知识库当日额度；额度已满返回 False。"""
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO rag_daily_usage (user_id, day, used) VALUES (?, ?, 1)"
        " ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1"
        " WHERE rag_daily_usage.used < ?",
        [user_id, day, limit],
    )
    conn.commit()
    consumed = cur.rowcount == 1
    conn.close()
    return consumed
