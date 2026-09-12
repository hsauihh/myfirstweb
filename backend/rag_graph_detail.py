"""知识库图谱页的实体详情：点开某个概念时看它的分组、关系与命中片段。

可见性与结构图完全一致（`rag_store.visibility_clause`）：实体只要对当前用户
没有任何可见提及，就当作不存在（接口返回 404），不泄露他人块内容。
"""
import sqlite3
from collections import Counter

import db
import rag_store
from rag_graph import (
    DETAIL_CHUNK_LIMIT,
    DETAIL_RELATION_LIMIT,
    POST_KIND,
    PUBLIC_KIND,
    SNIPPET_LIMIT,
    basename,
    entity_meta,
    group_index,
)


def _snippet(content: str) -> str:
    return content if len(content) <= SNIPPET_LIMIT else content[:SNIPPET_LIMIT] + "…"


def _entity_groups(
    chunks: list[sqlite3.Row],
    chunk_group: dict[int, str],
    groups: dict[str, dict],
) -> list[str]:
    """该实体出现过的分组（章节 / 来源），保持文档顺序。"""
    labels: list[str] = []
    for row in chunks:
        label = groups.get(chunk_group.get(row["id"], ""), {}).get("label")
        if label and label not in labels:
            labels.append(label)
    return labels


def _entity_relations(entity_id: int, rows: list[sqlite3.Row]) -> list[dict]:
    """与该实体直接相连的关系（双向聚合），direction 表示实体在关系里的位置。"""
    weights: Counter = Counter()
    for row in rows:
        if row["src_id"] == entity_id:
            weights[(row["dst_id"], "out", row["relation"])] += 1
        else:
            weights[(row["src_id"], "in", row["relation"])] += 1
    names = entity_meta({key[0] for key in weights})
    ranked = sorted(weights.items(), key=lambda item: (-item[1], item[0]))
    return [
        {
            "direction": key[1],
            "name": names[key[0]]["name"] if key[0] in names else "",
            "relation": key[2],
            "weight": weight,
        }
        for key, weight in ranked[:DETAIL_RELATION_LIMIT]
    ]


def _entity_chunks(rows: list[sqlite3.Row]) -> list[dict]:
    """命中片段：个人来源带文章标题 / 作者 / post_id，公共来源只给文件名与小节。"""
    kept = rows[:DETAIL_CHUNK_LIMIT]
    targets = rag_store.source_targets(
        [row["source_id"] for row in kept if row["source_id"] is not None]
    )
    payload: list[dict] = []
    for row in kept:
        target = targets.get(row["source_id"]) if row["source_id"] is not None else None
        title = target["title"] if target else (row["label"] or basename(row["source"]))
        payload.append(
            {
                "kind": POST_KIND if row["source_id"] is not None else PUBLIC_KIND,
                "label": row["label"] or basename(row["source"]),
                "title": title,
                "author": target["author"] if target else None,
                "post_id": target["post_id"] if target else None,
                "section": row["section"],
                "snippet": _snippet(row["content"]),
            }
        )
    return payload


def entity_detail(
    entity_id: int, user_id: int | None, include_public: bool = True
) -> dict | None:
    """实体详情；对当前用户不可见（没有任何可见提及）时返回 None。"""
    where, params = rag_store.visibility_clause(user_id, include_public, alias="d.")
    conn = db.get_conn()
    entity = conn.execute(
        "SELECT id, name, kind FROM graph_entities WHERE id = ?", [entity_id]
    ).fetchone()
    if entity is None:
        conn.close()
        return None
    rows = conn.execute(
        "SELECT d.id AS id, d.source AS source, d.section AS section,"
        " d.source_id AS source_id, d.label AS label, d.content AS content"
        " FROM graph_mentions m JOIN documents d ON d.id = m.chunk_id"
        f" WHERE m.entity_id = ? AND {where} ORDER BY d.id",
        [entity_id, *params],
    ).fetchall()
    relations = conn.execute(
        "SELECT r.src_id AS src_id, r.dst_id AS dst_id, r.relation AS relation"
        " FROM graph_relations r JOIN documents d ON d.id = r.chunk_id"
        f" WHERE (r.src_id = ? OR r.dst_id = ?) AND {where} ORDER BY r.id",
        [entity_id, entity_id, *params],
    ).fetchall()
    conn.close()
    if not rows:
        return None
    chunk_group, groups = group_index(user_id, include_public)
    return {
        "entity_id": entity["id"],
        "name": entity["name"],
        "kind": entity["kind"],
        "degree": len(rows),
        "groups": _entity_groups(rows, chunk_group, groups),
        "relations": _entity_relations(entity_id, relations),
        "chunks": _entity_chunks(rows),
    }
