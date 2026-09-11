"""知识库入库脚本：读取目录下的 md/txt，标题感知切块、向量化后写入数据库。

默认同时抽取实体/关系建图（GraphRAG）；`--no-graph` 可只做向量入库。
抽取按块内容哈希缓存，重复跑不会重复调模型。

用法：
    uv run python ingest.py ../RAGdata
    uv run python ingest.py ../RAGdata --rebuild
    uv run python ingest.py ../RAGdata --rebuild --no-graph
"""
import argparse
import re
import sys
from pathlib import Path

import graph
import graph_store
import rag
import rag_store

SUPPORTED_SUFFIXES = {".md", ".txt"}
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
MIN_CHUNK = 30
SECTION_SEPARATOR = " / "
IMAGE_EMBED = re.compile(r"!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)")
WIKI_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


def clean_markdown(text: str) -> str:
    """去掉图片嵌入、Obsidian 双链语法与强调标记。"""
    text = IMAGE_EMBED.sub("", text)
    text = WIKI_LINK.sub(lambda match: match.group(2) or match.group(1).split("#")[-1], text)
    return text.replace("==", "").replace("**", "")


def aggregate_paragraphs(text: str) -> list[str]:
    """按段落聚合到约 CHUNK_SIZE 字，相邻块重叠 CHUNK_OVERLAP 字。"""
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if current and len(current) + len(paragraph) + 1 > CHUNK_SIZE:
            chunks.append(current)
            current = current[-CHUNK_OVERLAP:] + "\n" + paragraph
        else:
            current = f"{current}\n{paragraph}" if current else paragraph
    if current:
        chunks.append(current)
    return [chunk.strip() for chunk in chunks if len(chunk.strip()) >= MIN_CHUNK]


def section_path(stack: list[tuple[int, str]]) -> str:
    """标题栈 → 「一级 / 二级」形式的路径。"""
    return SECTION_SEPARATOR.join(title for _, title in stack)


def _flush(lines: list[str], section: str, chunks: list[dict]) -> None:
    body = "\n".join(lines).strip()
    if not body:
        return
    chunks.extend({"content": text, "section": section} for text in aggregate_paragraphs(body))


def chunk_markdown(text: str) -> list[dict]:
    """标题感知切块：按 ATX 标题分段，小节内部再按段落聚合。

    小节之间**不会**被合并进同一块（引用要能精确到节）；标题行保留在块正文里，
    让模型仍能看到结构。无标题的文本（.txt / 没有小标题的文章）退化为空 section。

    太短的小节（清洗后不足 MIN_CHUNK 字）会被丢弃——只有标题行、没有实质内容的小节
    对检索与生成都没有价值。

    返回 [{"content": str, "section": str}]。
    """
    chunks: list[dict] = []
    stack: list[tuple[int, str]] = []
    lines: list[str] = []
    for line in text.splitlines():
        heading = HEADING.match(line)
        if not heading:
            lines.append(line)
            continue
        _flush(lines, section_path(stack), chunks)
        level = len(heading.group(1))
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, heading.group(2).strip()))
        lines = [line]
    _flush(lines, section_path(stack), chunks)
    return chunks


def iter_files(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES:
            yield path


def _build_graph(key: str, graph_enabled: bool) -> None:
    """抽图是增强项：失败只打印，不影响入库结果。"""
    if not graph_enabled:
        return
    try:
        stats = graph.build_for_source(key)
    except Exception as error:
        print(f"    [图谱] 抽取失败：{error}")
        return
    print(
        f"    [图谱] 关联 {stats['mentions']} 条、关系 {stats['relations']} 条"
        f"（新增 {stats['extracted']} 块 / 缓存 {stats['cached']} 块 / 失败 {stats['failed']} 块）"
    )


def ingest(root: Path, rebuild: bool, graph_enabled: bool = True) -> None:
    if rebuild:
        rag_store.clear()
        print("已清空知识库")
    if graph_enabled and not graph.available():
        print("未配置 CHAT_API_KEY，跳过图谱抽取（仅向量入库）")
        graph_enabled = False
    total_chunks = 0
    files = list(iter_files(root))
    for path in files:
        text = clean_markdown(path.read_text(encoding="utf-8", errors="ignore"))
        chunks = chunk_markdown(text)
        if not chunks:
            continue
        key = str(path.relative_to(root))
        rag_store.replace_source(
            key, chunks, rag.embed_texts([chunk["content"] for chunk in chunks])
        )
        total_chunks += len(chunks)
        print(f"  {key} -> {len(chunks)} 块")
        _build_graph(key, graph_enabled)
    if rebuild and graph_enabled:
        removed = graph_store.prune_orphans()
        print(f"  清理孤立实体 {removed} 个")
    print(
        f"完成：{len(files)} 个文件，{total_chunks} 块，"
        f"知识库共 {rag_store.count()} 块，"
        f"图谱 {graph_store.count_entities()} 实体 / {graph_store.count_relations()} 关系"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="把目录入库为知识库")
    parser.add_argument("directory", help="知识库目录（.md / .txt）")
    parser.add_argument("--rebuild", action="store_true", help="先清空再入库")
    parser.add_argument(
        "--no-graph", action="store_true", help="只做向量入库，不抽实体关系"
    )
    args = parser.parse_args()

    root = Path(args.directory)
    if not root.is_dir():
        print(f"目录不存在：{root}", file=sys.stderr)
        return 1
    ingest(root, args.rebuild, graph_enabled=not args.no_graph)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
