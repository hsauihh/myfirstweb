"""知识库入库脚本：读取目录下的 md/txt，切块向量化后写入数据库。

用法：
    uv run python ingest.py ../RAGdata
    uv run python ingest.py ../RAGdata --rebuild
"""
import argparse
import re
import sys
from pathlib import Path

import rag
import rag_store

SUPPORTED_SUFFIXES = {".md", ".txt"}
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
MIN_CHUNK = 30
IMAGE_EMBED = re.compile(r"!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)")
WIKI_LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def clean_markdown(text: str) -> str:
    """去掉图片嵌入、Obsidian 双链语法与强调标记。"""
    text = IMAGE_EMBED.sub("", text)
    text = WIKI_LINK.sub(lambda match: match.group(2) or match.group(1).split("#")[-1], text)
    return text.replace("==", "").replace("**", "")


def chunk_text(text: str) -> list[str]:
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


def iter_files(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in SUPPORTED_SUFFIXES:
            yield path


def ingest(root: Path, rebuild: bool) -> None:
    if rebuild:
        rag_store.clear()
        print("已清空知识库")
    total_chunks = 0
    files = list(iter_files(root))
    for path in files:
        text = clean_markdown(path.read_text(encoding="utf-8", errors="ignore"))
        chunks = chunk_text(text)
        if not chunks:
            continue
        rag_store.replace_source(
            str(path.relative_to(root)), chunks, rag.embed_texts(chunks)
        )
        total_chunks += len(chunks)
        print(f"  {path.relative_to(root)} -> {len(chunks)} 块")
    print(
        f"完成：{len(files)} 个文件，{total_chunks} 块，"
        f"知识库共 {rag_store.count()} 块"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="把目录入库为知识库")
    parser.add_argument("directory", help="知识库目录（.md / .txt）")
    parser.add_argument("--rebuild", action="store_true", help="先清空再入库")
    args = parser.parse_args()

    root = Path(args.directory)
    if not root.is_dir():
        print(f"目录不存在：{root}", file=sys.stderr)
        return 1
    ingest(root, args.rebuild)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
