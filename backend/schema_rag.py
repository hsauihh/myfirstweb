"""知识库与图谱相关的建表与迁移（从 schema.py 拆出，避免单文件过长）。

调用顺序有约束：`documents` 先于 `kb_sources` 的补列，`posts`（见 schema.py）
先于 `kb_sources` 的外键。`init_rag_schema` 由 `schema.init_db()` 统一调用。
"""
import json
import sqlite3

import db
import rag_store

_DOCUMENTS_SOURCE_ID = (
    "INTEGER REFERENCES kb_sources(id) ON DELETE CASCADE"
)

# 多态来源表：文章（post）与随心一记的笔记（note）共用一张表，
# documents.source_id 因此仍是唯一的归属列（可见性规则不用改）。
def _kb_sources_ddl(table: str) -> str:
    return f"""
CREATE TABLE IF NOT EXISTS {table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'post',
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    note_content TEXT,
    source_key TEXT NOT NULL UNIQUE,
    post_updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, post_id)
)
"""


def init_rag_schema(conn: sqlite3.Connection, cur: sqlite3.Cursor) -> None:
    """建知识库与图谱相关的表，并把旧库升级到当前结构。"""
    _create_rag(cur)
    _create_kb(conn, cur)
    _create_graph(cur)
    migrate(conn)


def _create_rag(cur: sqlite3.Cursor) -> None:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        section TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(source, chunk_index)
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)"
    )
    cur.execute("""
    CREATE TABLE IF NOT EXISTS document_vectors (
        document_id INTEGER PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        dim INTEGER NOT NULL,
        vector BLOB NOT NULL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rag_daily_usage (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
    )
    """)


def _create_kb(conn: sqlite3.Connection, cur: sqlite3.Cursor) -> None:
    """个人知识库来源；documents 通过 source_id 关联（NULL 表示站内公共库）。"""
    cur.execute(_kb_sources_ddl("kb_sources"))
    cur.execute("CREATE INDEX IF NOT EXISTS idx_kb_sources_user ON kb_sources(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_kb_sources_post ON kb_sources(post_id)")
    db.ensure_column(conn, "documents", "source_id", ddl=_DOCUMENTS_SOURCE_ID)
    db.ensure_column(conn, "documents", "label", ddl="TEXT")
    if "kind" not in _columns(conn, "kb_sources"):
        _rebuild_kb_sources(conn)


def _rebuild_kb_sources(conn: sqlite3.Connection) -> None:
    """把 kb_sources 升级成多态来源表（加 kind / note_content，post_id 改可空）。

    SQLite 改不了列约束，只能重建。重建期间必须关外键：documents.source_id 是
    ON DELETE CASCADE，开着外键 DROP 旧表会把所有块（含站内公共库）级联删掉。
    逐行保留 id，documents.source_id 才不会指错行。
    """
    before = _orphan_chunks(conn)
    conn.commit()  # 先结束外层隐式事务，PRAGMA 在事务里是空操作
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute("PRAGMA legacy_alter_table = ON")
    try:
        conn.execute(_kb_sources_ddl("kb_sources_new"))
        conn.execute(
            "INSERT INTO kb_sources_new"
            " (id, user_id, kind, post_id, note_content, source_key,"
            "  post_updated_at, created_at)"
            " SELECT id, user_id, 'post', post_id, NULL, source_key,"
            "  post_updated_at, created_at FROM kb_sources"
        )
        conn.execute("DROP TABLE kb_sources")
        conn.execute("ALTER TABLE kb_sources_new RENAME TO kb_sources")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_kb_sources_user ON kb_sources(user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_kb_sources_post ON kb_sources(post_id)"
        )
        conn.commit()
    finally:
        conn.execute("PRAGMA legacy_alter_table = OFF")
        conn.execute("PRAGMA foreign_keys = ON")
    # 关键断言：重建后不能有块变成「指向不存在的来源行」（id 没对齐就会这样）
    after = _orphan_chunks(conn)
    if after > before:
        raise RuntimeError(
            f"kb_sources 重建后有 {after - before} 个块失去了来源行（重建前 {before} 个）"
        )
    print("已把 kb_sources 升级为多态来源表（kind / note_content）")


def _orphan_chunks(conn: sqlite3.Connection) -> int:
    """source_id 指向不存在来源行的块数（正常库恒为 0）。"""
    return conn.execute(
        "SELECT COUNT(*) AS total FROM documents d WHERE d.source_id IS NOT NULL"
        " AND NOT EXISTS (SELECT 1 FROM kb_sources s WHERE s.id = d.source_id)"
    ).fetchone()["total"]


def _create_graph(cur: sqlite3.Cursor) -> None:
    """GraphRAG：实体、关系、块-实体关联与抽取缓存。

    实体/关系本身是全局的，用户可见性靠 chunk_id 连回 documents 判断
    （与 rag_store 的归属规则一致），不再另存一份 user_id。
    """
    cur.execute("""
    CREATE TABLE IF NOT EXISTS graph_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS graph_mentions (
        chunk_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        entity_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
        PRIMARY KEY (chunk_id, entity_id)
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_graph_mentions_entity"
        " ON graph_mentions(entity_id)"
    )
    cur.execute("""
    CREATE TABLE IF NOT EXISTS graph_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        src_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
        dst_id INTEGER NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE,
        relation TEXT NOT NULL,
        chunk_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
    )
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_graph_relations_src ON graph_relations(src_id)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_graph_relations_dst ON graph_relations(dst_id)"
    )
    cur.execute("""
    CREATE TABLE IF NOT EXISTS graph_extractions (
        content_hash TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)


# ---------- 迁移 ----------


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def _move_vectors(conn: sqlite3.Connection) -> None:
    """把老的 documents.embedding（JSON 字符串）搬进 document_vectors（BLOB）。"""
    rows = conn.execute("SELECT id, embedding FROM documents").fetchall()
    for row in rows:
        values = json.loads(row["embedding"])
        conn.execute(
            "INSERT OR REPLACE INTO document_vectors (document_id, dim, vector)"
            " VALUES (?, ?, ?)",
            [row["id"], len(values), rag_store.pack_vector(values)],
        )
    try:
        conn.execute("ALTER TABLE documents DROP COLUMN embedding")
    except sqlite3.OperationalError as error:
        # 老 SQLite（<3.35）不支持 DROP COLUMN：留着即可，代码已不再读写它
        print(f"未能删除 documents.embedding 列（{error}），该列已不再使用")
    print(f"已迁移 {len(rows)} 条向量到 document_vectors")


def migrate(conn: sqlite3.Connection) -> None:
    """幂等升级：向量拆表；补 section 列并让存量个人库重建（补出小节信息）。"""
    columns = _columns(conn, "documents")
    if "embedding" in columns:
        _move_vectors(conn)
    if "section" not in columns:
        conn.execute(
            "ALTER TABLE documents ADD COLUMN section TEXT NOT NULL DEFAULT ''"
        )
        # 存量块没有小节信息，置空 post_updated_at 交给 kb.sync_user 懒重建
        conn.execute("UPDATE kb_sources SET post_updated_at = ''")
        print("已增加 documents.section 列；个人知识库来源将在下次访问时重建")
