"""把另一个库里的「站内公共知识库」合并进当前 history.db（保留用户数据）。

线上已有真实用户时，重建好的库不能整体覆盖服务器。本脚本只替换公共库部分
（`documents.source_id IS NULL`），用户侧的表一行都不动；以后 RAGdata 更新就是
「本机入库 → 推库副本 → 服务器导入」。

用法（在 backend/ 下，先停掉后端服务）：
    uv run python import_public.py ~/history.db.push
    uv run python import_public.py ~/history.db.push --dry-run
    uv run python import_public.py ~/history.db.push --no-extractions

流程（单事务，失败回滚）：
1. 清掉指向已删块的死数据（向量 / 提及 / 关系），再删除本库现有公共块；
2. 从源库读公共块 + 向量 + 图谱，重映射 id 后写入——源库的 id 会和个人库撞车；
3. 清理不再被任何块提到的实体。

导入后必须重启后端：检索层在进程内缓存了整库向量矩阵（见 `rag._vector_index`）。
"""
import argparse
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path

import db
import graph_store
import rag_store

PUBLIC_CLAUSE = "source_id IS NULL"
_PUBLIC_IDS = f"SELECT id FROM documents WHERE {PUBLIC_CLAUSE}"
_REQUIRED_TABLES = {
    "documents",
    "document_vectors",
    "graph_entities",
    "graph_mentions",
    "graph_relations",
}
_REQUIRED_DOCUMENT_COLUMNS = {"source_id", "label"}
# 指向已不存在的块的残留行：正常路径（开着外键级联删块）不会产生，但迁移时
# 关过外键、或库被别的工具改过时会有，留着会污染向量矩阵与图谱。
_ORPHAN_CLEANUP = (
    "DELETE FROM document_vectors WHERE document_id NOT IN (SELECT id FROM documents)",
    "DELETE FROM graph_mentions WHERE chunk_id NOT IN (SELECT id FROM documents)",
    "DELETE FROM graph_relations WHERE chunk_id NOT IN (SELECT id FROM documents)",
)


@dataclass(frozen=True)
class PublicLibrary:
    """源库里的公共库数据；`documents` / `entities` 的 id 仍是源库的，写入时重映射。"""

    documents: list[sqlite3.Row]
    vectors: list[sqlite3.Row]
    entities: list[sqlite3.Row]
    mentions: list[sqlite3.Row]
    relations: list[sqlite3.Row]
    extractions: list[sqlite3.Row]

    def describe(self) -> str:
        return (
            f"公共块 {len(self.documents)} 个（向量 {len(self.vectors)} 条），"
            f"实体 {len(self.entities)} 个、提及 {len(self.mentions)} 条、"
            f"关系 {len(self.relations)} 条，抽取缓存 {len(self.extractions)} 条"
        )


def open_source(path: Path) -> sqlite3.Connection:
    """只读打开源库，并确认它确实是本站的 history.db。"""
    if not path.is_file():
        raise SystemExit(f"源库不存在：{path}")
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    tables = {
        row["name"]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    missing = _REQUIRED_TABLES - tables
    if missing:
        raise SystemExit(f"源库缺少表 {', '.join(sorted(missing))}：这不是本站的 history.db")
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(documents)")}
    if _REQUIRED_DOCUMENT_COLUMNS - columns:
        raise SystemExit("源库的 documents 缺列：这份库太旧，先在本机跑一次后端升级")
    return conn


def read_public(conn: sqlite3.Connection, with_extractions: bool = True) -> PublicLibrary:
    """读出源库里属于站内公共库的块、向量与图谱（个人库与用户数据不读）。"""
    return PublicLibrary(
        documents=conn.execute(
            "SELECT id, source, chunk_index, content, section, label, created_at"
            f" FROM documents WHERE {PUBLIC_CLAUSE} ORDER BY id"
        ).fetchall(),
        vectors=conn.execute(
            "SELECT document_id, dim, vector FROM document_vectors"
            f" WHERE document_id IN ({_PUBLIC_IDS})"
        ).fetchall(),
        entities=conn.execute(
            "SELECT id, key, name, kind, created_at FROM graph_entities WHERE id IN ("
            f" SELECT entity_id FROM graph_mentions WHERE chunk_id IN ({_PUBLIC_IDS})"
            f" UNION SELECT src_id FROM graph_relations WHERE chunk_id IN ({_PUBLIC_IDS})"
            f" UNION SELECT dst_id FROM graph_relations WHERE chunk_id IN ({_PUBLIC_IDS}))"
        ).fetchall(),
        mentions=conn.execute(
            "SELECT chunk_id, entity_id FROM graph_mentions"
            f" WHERE chunk_id IN ({_PUBLIC_IDS})"
        ).fetchall(),
        relations=conn.execute(
            "SELECT src_id, dst_id, relation, chunk_id, created_at FROM graph_relations"
            f" WHERE chunk_id IN ({_PUBLIC_IDS})"
        ).fetchall(),
        extractions=(
            conn.execute(
                "SELECT content_hash, payload, created_at FROM graph_extractions"
            ).fetchall()
            if with_extractions
            else []
        ),
    )


def _insert_documents(
    conn: sqlite3.Connection, rows: list[sqlite3.Row]
) -> dict[int, int]:
    """写入块并返回「源库 id → 本库 id」映射（必须重映射，否则会和个人库撞 id）。"""
    mapping: dict[int, int] = {}
    for row in rows:
        cur = conn.execute(
            "INSERT INTO documents"
            " (source, chunk_index, content, section, created_at, label, source_id)"
            " VALUES (?, ?, ?, ?, ?, ?, NULL)",
            [
                row["source"],
                row["chunk_index"],
                row["content"],
                row["section"],
                row["created_at"],
                row["label"],
            ],
        )
        mapping[row["id"]] = cur.lastrowid
    return mapping


def _insert_entities(
    conn: sqlite3.Connection, rows: list[sqlite3.Row]
) -> dict[int, int]:
    """写入实体并返回「源库实体 id → 本库实体 id」映射。

    实体按 `key` 全局唯一：同一概念已有行时直接复用，不重复插。
    """
    conn.executemany(
        "INSERT OR IGNORE INTO graph_entities (key, name, kind, created_at)"
        " VALUES (?, ?, ?, ?)",
        [[row["key"], row["name"], row["kind"], row["created_at"]] for row in rows],
    )
    by_key = {
        row["key"]: row["id"] for row in conn.execute("SELECT id, key FROM graph_entities")
    }
    return {row["id"]: by_key[row["key"]] for row in rows if row["key"] in by_key}


def _verify(conn: sqlite3.Connection, lib: PublicLibrary) -> dict[str, int]:
    """提交前自检：块与向量条数必须和源库一致，否则整笔回滚。"""
    chunks = conn.execute(
        f"SELECT COUNT(*) AS total FROM documents WHERE {PUBLIC_CLAUSE}"
    ).fetchone()["total"]
    vectors = conn.execute(
        "SELECT COUNT(*) AS total FROM document_vectors v"
        f" JOIN documents d ON d.id = v.document_id WHERE d.{PUBLIC_CLAUSE}"
    ).fetchone()["total"]
    relations = conn.execute(
        "SELECT COUNT(*) AS total FROM graph_relations r"
        f" JOIN documents d ON d.id = r.chunk_id WHERE d.{PUBLIC_CLAUSE}"
    ).fetchone()["total"]
    if chunks != len(lib.documents) or vectors != len(lib.vectors):
        raise RuntimeError(
            f"自检失败（块 {chunks}/{len(lib.documents)}、"
            f"向量 {vectors}/{len(lib.vectors)}），已回滚"
        )
    return {"chunks": chunks, "vectors": vectors, "relations": relations}


def replace_public(lib: PublicLibrary) -> dict[str, int]:
    """用 `lib` 替换本库的公共库；用户侧的表不动，失败整笔回滚。"""
    conn = db.get_conn()
    try:
        cleaned = sum(conn.execute(sql).rowcount for sql in _ORPHAN_CLEANUP)
        removed = conn.execute(f"DELETE FROM documents WHERE {PUBLIC_CLAUSE}").rowcount
        chunks = _insert_documents(conn, lib.documents)
        conn.executemany(
            "INSERT INTO document_vectors (document_id, dim, vector) VALUES (?, ?, ?)",
            [
                [chunks[row["document_id"]], row["dim"], row["vector"]]
                for row in lib.vectors
                if row["document_id"] in chunks
            ],
        )
        entities = _insert_entities(conn, lib.entities)
        conn.executemany(
            "INSERT OR IGNORE INTO graph_mentions (chunk_id, entity_id) VALUES (?, ?)",
            [
                [chunks[row["chunk_id"]], entities[row["entity_id"]]]
                for row in lib.mentions
                if row["chunk_id"] in chunks and row["entity_id"] in entities
            ],
        )
        conn.executemany(
            "INSERT INTO graph_relations"
            " (src_id, dst_id, relation, chunk_id, created_at) VALUES (?, ?, ?, ?, ?)",
            [
                [
                    entities[row["src_id"]],
                    entities[row["dst_id"]],
                    row["relation"],
                    chunks[row["chunk_id"]],
                    row["created_at"],
                ]
                for row in lib.relations
                if row["chunk_id"] in chunks
                and row["src_id"] in entities
                and row["dst_id"] in entities
            ],
        )
        conn.executemany(
            "INSERT OR REPLACE INTO graph_extractions"
            " (content_hash, payload, created_at) VALUES (?, ?, ?)",
            [
                [row["content_hash"], row["payload"], row["created_at"]]
                for row in lib.extractions
            ],
        )
        stats = _verify(conn, lib)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    stats["removed"] = removed
    stats["cleaned"] = cleaned
    stats["orphans"] = graph_store.prune_orphans()
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(
        description="把另一个库的站内公共知识库合并进当前 history.db"
    )
    parser.add_argument("source", help="源库路径（本机 history.db 的副本）")
    parser.add_argument("--dry-run", action="store_true", help="只报告会导入什么，不写库")
    parser.add_argument("--no-extractions", action="store_true", help="不搬图谱抽取缓存")
    args = parser.parse_args()

    lib = read_public(open_source(Path(args.source).expanduser()), not args.no_extractions)
    print(f"源库公共库：{lib.describe()}")
    if args.dry_run:
        print("dry-run：未写入任何数据")
        return 0
    if not lib.documents:
        print("源库里没有公共块：中止，未做任何写入", file=sys.stderr)
        return 1

    db.init_db()  # 确保本库表结构已升级到当前版本
    stats = replace_public(lib)
    print(
        f"完成：删除旧公共块 {stats['removed']} 个，写入 {stats['chunks']} 块 /"
        f" 向量 {stats['vectors']} 条 / 关系 {stats['relations']} 条，"
        f"清理死数据 {stats['cleaned']} 行、孤立实体 {stats['orphans']} 个"
    )
    print(
        f"本库现状：公共块 {rag_store.count_public()}，"
        f"图谱 {graph_store.count_entities()} 实体 / {graph_store.count_relations()} 关系"
    )
    print("请重启后端让检索缓存失效：sudo systemctl restart zero-to-full")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
