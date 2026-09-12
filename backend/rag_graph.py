"""知识库图谱页的数据层：把块级实体提及聚合成「章 / 来源 → 核心概念 → 关系」结构图。

只读且确定：同一份数据永远得到同一张图（无随机、无缓存）。
可见性规则与检索一致（`rag_store.visibility_clause`），个人块只出现在本人图里。

分组骨架的取法：
- 个人库块按来源（文章）成组；
- 公共库块从 `documents.section` 第一级或文件名里取章号，归到同一章；
- 取不到章号的公共文件（README、assets）各自成组。
"""
import re
import sqlite3
from collections import Counter

import db
import graph_store
import rag_store

GROUP_NODE_LIMIT = 8            # 每个分组最多展示的概念数
NODE_LIMIT = 72                 # 概念节点总数上限（分组很多时兜底）
EDGE_LIMIT = 150
DETAIL_RELATION_LIMIT = 12
DETAIL_CHUNK_LIMIT = 3
SNIPPET_LIMIT = 300
SECTION_SEPARATOR = " / "
POST_KIND = "post"
PUBLIC_KIND = "public"

# 「4.存储器」「4.7 高速缓冲存储器cache」「4.7.3.1 直接映射」都能取出章号
_NUMBER = re.compile(r"^(\d+)(?:[.．、]\d+)*[.．、\s]*(.*)$")
# 只有章级标题（分隔符后不是数字）才用来给章取展示名
_CHAPTER = re.compile(r"^(\d+)[.．、\s]+([^\d\s].*)$")


def _first_segment(section: str) -> str:
    """标题路径的第一级，如「4 存储器 / 4.7 cache」→「4 存储器」。"""
    return (section or "").split(SECTION_SEPARATOR)[0].strip()


def basename(source: str) -> str:
    """来源文件名（保留后缀，用于片段展示）。"""
    return (source or "").rsplit("/", 1)[-1]


def stem(source: str) -> str:
    """来源文件名：去目录与 .md 后缀。"""
    name = basename(source)
    return name[:-3] if name.lower().endswith(".md") else name


def parse_number(text: str) -> tuple[int, str] | None:
    """「4.存储器」→ (4, "存储器")；「4.7 cache」→ (4, "7 cache")；无章号返回 None。"""
    match = _NUMBER.match((text or "").strip())
    if match is None:
        return None
    return int(match.group(1)), match.group(2).strip()


def chapter_title(text: str) -> tuple[int, str] | None:
    """只认章级标题（「4.存储器」「4 存储器」），用于给章取展示名。"""
    match = _CHAPTER.match((text or "").strip())
    if match is None:
        return None
    return int(match.group(1)), match.group(2).strip()


def _group_of(row: sqlite3.Row, votes: dict[int, Counter]) -> tuple[str, str, int | None, str]:
    """块的归属分组 → (key, kind, 章号, 兜底标题)。"""
    if row["source_id"] is not None:
        return (
            f"src:{row['source_id']}",
            "source",
            None,
            row["label"] or stem(row["source"]),
        )
    section = _first_segment(row["section"])
    named = chapter_title(section) or chapter_title(stem(row["source"]))
    if named is not None:
        votes.setdefault(named[0], Counter())[named[1]] += 1
    for text in (section, stem(row["source"])):
        parsed = parse_number(text)
        if parsed is not None:
            return f"ch{parsed[0]}", "chapter", parsed[0], parsed[1]
    stemmed = stem(row["source"])
    return f"file:{stemmed}", "source", None, stemmed


def _top_title(counter: Counter | None, fallback: str) -> str:
    """出现最多的章级标题（并列取字典序最小），没有就用兜底标题。"""
    if not counter:
        return fallback
    return sorted(counter.items(), key=lambda item: (-item[1], item[0]))[0][0]


def group_index(
    user_id: int | None, include_public: bool
) -> tuple[dict[int, str], dict[str, dict]]:
    """可见块 → (块 id → 分组 key, 分组 key → 分组信息)。"""
    where, params = rag_store.visibility_clause(user_id, include_public, alias="d.")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT d.id AS id, d.source AS source, d.section AS section,"
        " d.source_id AS source_id, d.label AS label"
        f" FROM documents d WHERE {where} ORDER BY d.id",
        params,
    ).fetchall()
    conn.close()
    votes: dict[int, Counter] = {}
    chunk_group: dict[int, str] = {}
    groups: dict[str, dict] = {}
    for row in rows:
        key, kind, number, title = _group_of(row, votes)
        chunk_group[row["id"]] = key
        groups.setdefault(
            key, {"key": key, "kind": kind, "chapter": number, "title": title}
        )
    for group in groups.values():
        number = group["chapter"]
        if number is None:
            group["label"] = group["title"]
        else:
            title = _top_title(votes.get(number), group["title"])
            group["label"] = f"{number} {title}"
    return chunk_group, groups


def _visible_mentions(user_id: int | None, include_public: bool) -> list[sqlite3.Row]:
    where, params = rag_store.visibility_clause(user_id, include_public, alias="d.")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT m.entity_id AS entity_id, m.chunk_id AS chunk_id"
        " FROM graph_mentions m JOIN documents d ON d.id = m.chunk_id"
        f" WHERE {where} ORDER BY m.chunk_id, m.entity_id",
        params,
    ).fetchall()
    conn.close()
    return rows


def _counts(
    mentions: list[sqlite3.Row], chunk_group: dict[int, str]
) -> tuple[dict[str, Counter], Counter]:
    """(分组 → 实体提及数, 实体 → 全局提及数)。"""
    group_counts: dict[str, Counter] = {}
    global_counts: Counter = Counter()
    for row in mentions:
        key = chunk_group.get(row["chunk_id"])
        if key is None:
            continue
        group_counts.setdefault(key, Counter())[row["entity_id"]] += 1
        global_counts[row["entity_id"]] += 1
    return group_counts, global_counts


def _primary_groups(
    group_counts: dict[str, Counter], global_counts: Counter
) -> dict[int, str]:
    """每个实体只挂一个分组：提及最多的那个（并列比全局提及数，再比分组 key）。"""
    ranked: dict[int, list[tuple[int, int, str]]] = {}
    for key, counts in group_counts.items():
        for entity_id, count in counts.items():
            ranked.setdefault(entity_id, []).append(
                (-count, -global_counts[entity_id], key)
            )
    return {entity_id: min(items)[2] for entity_id, items in ranked.items()}


def _selected(group_counts: dict[str, Counter], global_counts: Counter) -> set[int]:
    """每组取最关键的几个概念；总数超上限时再按全局提及数截断。"""
    picked: dict[int, int] = {}
    for counts in group_counts.values():
        ranked = sorted(
            counts.items(),
            key=lambda item: (-item[1], -global_counts[item[0]], item[0]),
        )
        for entity_id, _ in ranked[:GROUP_NODE_LIMIT]:
            picked.setdefault(entity_id, global_counts[entity_id])
    if len(picked) > NODE_LIMIT:
        keep = sorted(picked, key=lambda entity_id: (-picked[entity_id], entity_id))
        return set(keep[:NODE_LIMIT])
    return set(picked)


def entity_meta(ids: set[int]) -> dict[int, sqlite3.Row]:
    if not ids:
        return {}
    placeholders = ", ".join("?" for _ in ids)
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT id, name, kind FROM graph_entities WHERE id IN ({placeholders})",
        list(ids),
    ).fetchall()
    conn.close()
    return {row["id"]: row for row in rows}


def _ordered_groups(groups: dict[str, dict]) -> list[dict]:
    """数字章按章号升序，其余分组（个人来源 / 无章号文件）排在后面。"""
    return sorted(
        groups.values(),
        key=lambda group: (
            group["chapter"] is None,
            group["chapter"] or 0,
            group["label"],
        ),
    )


def _edges(selected: set[int], user_id: int | None, include_public: bool) -> list[dict]:
    """两端都在展示集合内的关系，按 (src, dst, relation) 聚合计数。"""
    if not selected:
        return []
    where, params = rag_store.visibility_clause(user_id, include_public, alias="d.")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT r.src_id AS src, r.dst_id AS dst, r.relation AS relation"
        " FROM graph_relations r JOIN documents d ON d.id = r.chunk_id"
        f" WHERE {where} ORDER BY r.id",
        params,
    ).fetchall()
    conn.close()
    weights: Counter = Counter(
        (row["src"], row["dst"], row["relation"])
        for row in rows
        if row["src"] in selected and row["dst"] in selected
    )
    ranked = sorted(weights.items(), key=lambda item: (-item[1], item[0]))
    return [
        {
            "source": f"e{key[0]}",
            "target": f"e{key[1]}",
            "relation": key[2],
            "weight": weight,
        }
        for key, weight in ranked[:EDGE_LIMIT]
    ]


def structure(user_id: int | None, include_public: bool = True) -> dict:
    """结构图数据：分组骨架 + 概念节点 + 关系边 + 规模统计。"""
    chunk_group, groups = group_index(user_id, include_public)
    group_counts, global_counts = _counts(
        _visible_mentions(user_id, include_public), chunk_group
    )
    primary = _primary_groups(group_counts, global_counts)
    selected = _selected(group_counts, global_counts)
    meta = entity_meta(selected)

    ordered = _ordered_groups(groups)
    rank = {group["key"]: index for index, group in enumerate(ordered)}
    nodes = [
        {
            "id": f"e{entity_id}",
            "entity_id": entity_id,
            "name": meta[entity_id]["name"],
            "kind": meta[entity_id]["kind"],
            "group": primary[entity_id],
            "degree": global_counts[entity_id],
        }
        for entity_id in selected
        if entity_id in meta
    ]
    nodes.sort(
        key=lambda node: (
            rank.get(node["group"], len(rank)),
            -node["degree"],
            node["entity_id"],
        )
    )
    used = Counter(node["group"] for node in nodes)
    payload_groups = [
        {
            "key": group["key"],
            "label": group["label"],
            "kind": group["kind"],
            "nodes": used[group["key"]],
        }
        for group in ordered
        if used.get(group["key"])
    ]
    edges = _edges(selected, user_id, include_public)
    return {
        "groups": payload_groups,
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "chunks": len(chunk_group),
            "entities": graph_store.count_entities(),
            "relations": graph_store.count_relations(),
            "nodes": len(nodes),
            "edges": len(edges),
            "truncated": any(
                len(counts) > GROUP_NODE_LIMIT for counts in group_counts.values()
            ),
        },
    }
