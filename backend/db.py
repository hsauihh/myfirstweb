"""SQLite 连接、数据归属（Owner）与时间工具。

建表与迁移在 schema.py；init_db 只是转调，保持对外的 db.init_db() 入口。
时间统一存 UTC ISO 字符串，展示时由前端换算本地时区。
"""
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

DB_FILE = "history.db"


@dataclass(frozen=True)
class Owner:
    """数据归属：登录用户按 user_id，匿名访客按 session_id。"""
    user_id: int | None
    session_id: str


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row      # 让查询结果带上列名（默认是元组）
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def owner_clause(owner: Owner) -> tuple[str, list]:
    """返回归属过滤的 SQL 片段与参数。"""
    if owner.user_id is not None:
        return "user_id = ?", [owner.user_id]
    return "session_id = ? AND user_id IS NULL", [owner.session_id]


def init_db() -> None:
    """建表与迁移（实现见 schema.py，避免本文件过长）。"""
    import schema
    schema.init_db()


def ensure_column(
    conn: sqlite3.Connection, table: str, column: str, *, ddl: str
) -> None:
    """旧库补列：列已存在时不动。"""
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
