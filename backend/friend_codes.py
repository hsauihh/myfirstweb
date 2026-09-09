"""好友码：生成与查找。"""
import secrets
import sqlite3

import db

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8
CODE_RETRIES = 5


def get_or_create(user_id: int) -> str:
    """读取好友码，没有则生成一个（唯一冲突时重试）。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT friend_code FROM users WHERE id = ?", [user_id]
    ).fetchone()
    if row is not None and row["friend_code"]:
        conn.close()
        return row["friend_code"]

    for _ in range(CODE_RETRIES):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        try:
            conn.execute(
                "UPDATE users SET friend_code = ? WHERE id = ?", [code, user_id]
            )
            conn.commit()
            conn.close()
            return code
        except sqlite3.IntegrityError:
            conn.rollback()
    conn.close()
    raise RuntimeError("好友码生成失败，请重试")


def find(code: str) -> dict | None:
    conn = db.get_conn()
    row = conn.execute(
        "SELECT id, username, created_at FROM users WHERE friend_code = ?",
        [code.strip().upper()],
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "created_at": row["created_at"],
    }
