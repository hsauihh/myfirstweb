"""只补图谱：对库里**已有的块**抽实体关系，不重切块、不重算向量、不动用户数据。

用途：库已经入过库（块与向量都在），但图谱是空的——典型场景是历史上用
`ingest.py --no-graph` 入的库、或在图谱功能上线前入的库。此时不需要重新上传
RAGdata、也不需要重跑嵌入，直接按块内容补图即可（抽取按内容哈希缓存，重跑免费）。

用法（在 backend/ 下）：
    uv run python graph_build.py --dry-run        # 只列出会处理哪些来源，不调模型
    uv run python graph_build.py                  # 给站内公共库补图
    uv run python graph_build.py --personal       # 连个人库来源一起补
    uv run python graph_build.py --limit 24       # 每个来源最多抽这么多块（默认全抽）
    uv run python graph_build.py --source a.md    # 只处理指定来源（可重复）

抽图是增强项：单个来源失败只打日志并继续，不影响其它来源，也不影响问答
（图谱缺失时检索会降级为纯向量）。
"""
import argparse
import os
import sys

from dotenv import load_dotenv

import graph
import graph_store
import rag_store


def _targets(public_only: bool, only: list[str]) -> list[tuple[str, int]]:
    sources = rag_store.document_sources(public_only=public_only)
    if not only:
        return sources
    wanted = set(only)
    return [(source, chunks) for source, chunks in sources if source in wanted]


def build(public_only: bool, limit: int | None, only: list[str], dry_run: bool) -> int:
    sources = _targets(public_only, only)
    if not sources:
        print("没有可处理的来源：库里还没有块（先跑 ingest.py 或用个人库同步）")
        return 0

    total_chunks = sum(chunks for _source, chunks in sources)
    print(
        f"待处理来源 {len(sources)} 个 / 共 {total_chunks} 块"
        f"（每个来源{'全抽' if limit is None else f'最多 {limit} 块'}）"
    )
    if dry_run:
        for source, chunks in sources:
            print(f"  [dry-run] {source}（{chunks} 块）")
        return 0

    if not os.environ.get("CHAT_API_KEY"):
        print("警告：未配置 CHAT_API_KEY，抽取会整批失败（只影响图谱，不影响入库与问答）")

    stats = {"chunks": 0, "cached": 0, "extracted": 0, "failed": 0, "mentions": 0, "relations": 0}
    for index, (source, chunks) in enumerate(sources, start=1):
        try:
            result = graph.build_for_source(source, max_chunks=limit)
        except Exception as error:                      # 单个来源失败不影响其它来源
            print(f"[{index}/{len(sources)}] {source} 抽取失败：{error}")
            stats["failed"] += 1
            continue
        for key in stats:
            stats[key] += result.get(key, 0)
        print(
            f"[{index}/{len(sources)}] {source}：{chunks} 块，"
            f"新抽 {result['extracted']} / 命中缓存 {result['cached']}，"
            f"提及 {result['mentions']}、关系 {result['relations']}"
        )

    removed = graph_store.prune_orphans()
    print(
        f"完成：处理 {stats['chunks']} 块（新抽 {stats['extracted']}，缓存命中 {stats['cached']}），"
        f"新增提及 {stats['mentions']}、关系 {stats['relations']}，清理孤立实体 {removed} 个"
    )
    print(
        f"图谱规模：{graph_store.count_entities()} 实体 / {graph_store.count_relations()} 关系"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="给库里已有的块补抽实体关系（不动向量）")
    parser.add_argument(
        "--personal", action="store_true", help="连个人库来源一起补（默认只补站内公共库）"
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="每个来源最多抽多少块（默认全部）"
    )
    parser.add_argument(
        "--source", action="append", default=[], help="只处理指定来源，可重复传"
    )
    parser.add_argument("--dry-run", action="store_true", help="只列出计划，不调模型")
    args = parser.parse_args()

    load_dotenv()
    if args.limit is not None and args.limit <= 0:
        print("--limit 必须大于 0", file=sys.stderr)
        return 1
    return build(
        public_only=not args.personal,
        limit=args.limit,
        only=args.source,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    raise SystemExit(main())
