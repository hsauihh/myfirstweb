"""数据库建表与迁移（schema 定义）。

从 db.py 拆出，避免单文件过长；对外入口仍是 db.init_db()。
"""
import sqlite3

import db
import schema_rag


def init_db() -> None:
    conn = db.get_conn()
    cur = conn.cursor()
    _create_history(conn, cur)
    _create_conversations(conn, cur)
    _create_messages(conn, cur)
    _create_users(conn, cur)
    _create_friends(cur)
    _create_direct_messages(cur)
    _create_announcements(cur)
    _create_chat_daily_usage(cur)
    _create_orders(cur)
    _create_anonymous_usage(cur)
    _create_blog(cur)
    schema_rag.init_rag_schema(conn, cur)
    conn.commit()
    conn.close()


def _create_history(conn: sqlite3.Connection, cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        user_id INTEGER,
        text TEXT,
        score REAL,
        label TEXT,
        pinyin TEXT,
        created_at TEXT
    )
    """)
    db.ensure_column(conn, "history", "user_id", ddl="INTEGER")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_session_created "
        "ON history(session_id, created_at)"
    )


def _create_conversations(conn: sqlite3.Connection, cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id INTEGER,
        title TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'chat',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    db.ensure_column(conn, "conversations", "user_id", ddl="INTEGER")
    db.ensure_column(conn, "conversations", "kind", ddl="TEXT NOT NULL DEFAULT 'chat'")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_session "
        "ON conversations(session_id, updated_at DESC)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_user "
        "ON conversations(user_id, updated_at DESC)"
    )


def _create_messages(conn: sqlite3.Connection, cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        sources TEXT,
        created_at TEXT NOT NULL
    )
    """)
    db.ensure_column(conn, "messages", "sources", ddl="TEXT")
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation "
        "ON messages(conversation_id, id)"
    )


def _create_users(conn: sqlite3.Connection, cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        friend_code TEXT,
        avatar TEXT,
        vip_expires_at TEXT,
        created_at TEXT NOT NULL
    )
    """)
    db.ensure_column(conn, "users", "friend_code", ddl="TEXT")
    db.ensure_column(conn, "users", "avatar", ddl="TEXT")
    db.ensure_column(conn, "users", "vip_expires_at", ddl="TEXT")
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code "
        "ON users(friend_code)"
    )
    cur.execute("""
    CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user "
        "ON auth_sessions(user_id)"
    )


def _create_friends(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(from_user_id, to_user_id)
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_friend_requests_to "
        "ON friend_requests(to_user_id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_friend_requests_from "
        "ON friend_requests(from_user_id)"
    )
    cur.execute("""
    CREATE TABLE IF NOT EXISTS friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        UNIQUE(user_a_id, user_b_id)
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships(user_a_id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_b_id)"
    )


def _create_direct_messages(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read_at TEXT
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_dm_pair "
        "ON direct_messages(sender_id, recipient_id, id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_dm_unread "
        "ON direct_messages(recipient_id, read_at)"
    )


def _create_anonymous_usage(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS anonymous_usage (
        session_id TEXT PRIMARY KEY,
        used INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
    )
    """)


def _create_chat_daily_usage(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS chat_daily_usage (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
    )
    """)


def _create_orders(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'paid')),
        created_at TEXT NOT NULL,
        paid_at TEXT
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, id DESC)"
    )


def _create_blog(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        visibility TEXT NOT NULL CHECK(visibility IN ('private', 'public')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_posts_public "
        "ON posts(visibility, published_at DESC)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_posts_author "
        "ON posts(author_id, updated_at DESC)"
    )
    cur.execute("""
    CREATE TABLE IF NOT EXISTS post_likes (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (post_id, user_id)
    )
    """)


def _create_announcements(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS announcement_reads (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        read_at TEXT NOT NULL,
        PRIMARY KEY (user_id, announcement_id)
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_announcement_reads_user "
        "ON announcement_reads(user_id)"
    )
