"""知识图谱存储层：实体、关系、块-实体关联与抽取缓存。

实体与关系本身是全局的（同一概念在不同用户、不同来源之间复用）；
用户可见性不在这里另存一份，而是靠 `chunk_id` 连回 `documents`，
复用 `rag_store.visibility_clause` 的归属规则判断。
"""
import json
import sqlite3

import db
import rag_store

_ENTITY_UPSERT = (
    "INSERT INTO graph_entities (key, name, kind, created_at) VALUES (?, ?, ?, ?)"
    " ON CONFLICT(key) DO UPDATE SET name = excluded.name,"
    " kind = CASE WHEN excluded.kind != '' THEN excluded.kind ELSE kind END"
)

_RELATION_COLUMNS = """
SELECT DISTINCT src.name AS src, dst.name AS dst, r.relation AS relation
FROM graph_relations r
JOIN graph_entities src ON src.id = r.src_id
JOIN graph_entities dst ON dst.id = r.dst_id
JOIN documents d ON d.id = r.chunk_id
"""


def _placeholders(values) -> str:
    return ", ".join("?" for _ in values)


def _upsert_entities(
    conn: sqlite3.Connection, entities: list[dict], now: str
) -> dict[str, int]:
    """写入实体并返回 key → id 映射。"""
    for entity in entities:
        conn.execute(_ENTITY_UPSERT, [entity["key"], entity["name"], entity["kind"], now])
    keys = [entity["key"] for entity in entities]
    rows = conn.execute(
        f"SELECT id, key FROM graph_entities WHERE key IN ({_placeholders(keys)})",
        keys,
    ).fetchall()
    return {row["key"]: row["id"] for row in rows}


def replace_chunks(entries: list[dict]) -> dict:
    """整块替换若干块的抽取结果（幂等：重跑不会留下重复关联）。

    entries 每项形如
    {"chunk_id": int, "entities": [{"key","name","kind"}], "relations": [{"src","dst","relation"}]}，
    其中 relations 的 src/dst 是**实体 key**，且必须出现在同一块的 entities 里。
    """
    if not entries:
        return {"mentions": 0, "relations": 0}
    now = db.now_iso()
    chunk_ids = [entry["chunk_id"] for entry in entries]
    conn = db.get_conn()
    try:
        conn.execute(
            f"DELETE FROM graph_mentions WHERE chunk_id IN ({_placeholders(chunk_ids)})",
            chunk_ids,
        )
        conn.execute(
            f"DELETE FROM graph_relations WHERE chunk_id IN ({_placeholders(chunk_ids)})",
            chunk_ids,
        )
        mentions = 0
        relations = 0
        for entry in entries:
            entities = entry["entities"]
            if not entities:
                continue
            ids = _upsert_entities(conn, entities, now)
            pairs = [(entry["chunk_id"], ids[item["key"]]) for item in entities]
            conn.executemany(
                "INSERT OR IGNORE INTO graph_mentions (chunk_id, entity_id)"
                " VALUES (?, ?)",
                pairs,
            )
            mentions += len(pairs)
            links = [
                (ids[link["src"]], ids[link["dst"]], link["relation"], entry["chunk_id"], now)
                for link in entry["relations"]
                if link["src"] in ids and link["dst"] in ids
            ]
            conn.executemany(
                "INSERT INTO graph_relations"
                " (src_id, dst_id, relation, chunk_id, created_at) VALUES (?, ?, ?, ?, ?)",
                links,
            )
            relations += len(links)
        conn.commit()
    finally:
        conn.close()
    return {"mentions": mentions, "relations": relations}


def get_extractions(hashes: list[str]) -> dict[str, dict]:
    """按内容哈希取回已缓存的抽取结果（payload 已是规范化结构）。"""
    if not hashes:
        return {}
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT content_hash, payload FROM graph_extractions"
        f" WHERE content_hash IN ({_placeholders(hashes)})",
        hashes,
    ).fetchall()
    conn.close()
    return {row["content_hash"]: json.loads(row["payload"]) for row in rows}


def put_extractions(payloads: dict[str, dict]) -> None:
    if not payloads:
        return
    now = db.now_iso()
    conn = db.get_conn()
    conn.executemany(
        "INSERT OR REPLACE INTO graph_extractions (content_hash, payload, created_at)"
        " VALUES (?, ?, ?)",
        [
            (content_hash, json.dumps(payload, ensure_ascii=False), now)
            for content_hash, payload in payloads.items()
        ],
    )
    conn.commit()
    conn.close()


def entities_for_chunks(chunk_ids: list[int]) -> list[int]:
    """这些块提到的实体 id（去重）。"""
    if not chunk_ids:
        return []
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT DISTINCT entity_id FROM graph_mentions"
        f" WHERE chunk_id IN ({_placeholders(chunk_ids)})",
        chunk_ids,
    ).fetchall()
    conn.close()
    return [row["entity_id"] for row in rows]


def neighbor_chunks(
    entity_ids: list[int],
    *,
    user_id: int | None,
    include_public: bool = True,
    exclude_ids: list[int] | None = None,
    limit: int = 8,
) -> list[dict]:
    """一跳图谱扩展：返回提到这些实体的**该用户可见**的其它块 id。

    按「命中的种子实体个数」倒序，命中越多说明与当前问题越相关；
    正文与引用信息由调用方按 id 再取，避免在这里重复拼装。
    """
    if not entity_ids:
        return []
    where, params = rag_store.visibility_clause(user_id, include_public, alias="d.")
    excluded = exclude_ids or []
    exclusion = ""
    if excluded:
        exclusion = f" AND d.id NOT IN ({_placeholders(excluded)})"
    sql = (
        "SELECT d.id AS id, COUNT(*) AS hits"
        " FROM graph_mentions m JOIN documents d ON d.id = m.chunk_id"
        f" WHERE m.entity_id IN ({_placeholders(entity_ids)}) AND {where}{exclusion}"
        " GROUP BY d.id ORDER BY hits DESC, d.id LIMIT ?"
    )
    conn = db.get_conn()
    rows = conn.execute(sql, [*entity_ids, *params, *excluded, limit]).fetchall()
    conn.close()
    return [{"id": row["id"], "hits": row["hits"]} for row in rows]


def relations_between(
    entity_ids: list[int],
    *,
    user_id: int | None,
    include_public: bool = True,
    limit: int = 10,
) -> list[dict]:
    """两端都在这批实体里的关系。"""
    if not entity_ids:
        return []
    where, params = rag_store.visibility_clause(user_id, include_public, alias="d.")
    placeholders = _placeholders(entity_ids)
    sql = (
        f"{_RELATION_COLUMNS} WHERE r.src_id IN ({placeholders})"
        f" AND r.dst_id IN ({placeholders}) AND {where}"
        " ORDER BY r.id LIMIT ?"
    )
    conn = db.get_conn()
    rows = conn.execute(
        sql, [*entity_ids, *entity_ids, *params, limit]
    ).fetchall()
    conn.close()
    return [
        {"src": row["src"], "dst": row["dst"], "relation": row["relation"]}
        for row in rows
    ]


def count_entities() -> int:
    conn = db.get_conn()
    total = conn.execute("SELECT COUNT(*) AS total FROM graph_entities").fetchone()["total"]
    conn.close()
    return total


def count_relations() -> int:
    conn = db.get_conn()
    total = conn.execute("SELECT COUNT(*) AS total FROM graph_relations").fetchone()["total"]
    conn.close()
    return total


def prune_orphans() -> int:
    """删除已不再被任何块提到的实体（重建公共库后调用）。"""
    conn = db.get_conn()
    cur = conn.execute(
        "DELETE FROM graph_entities WHERE id NOT IN"
        " (SELECT entity_id FROM graph_mentions)"
    )
    conn.commit()
    conn.close()
    return cur.rowcount
