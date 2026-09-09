"""公告发布脚本：读取 JSON 文件内容，推送给服务器所有用户。

用法：
    uv run python announce.py notice.json
    uv run python announce.py notice.json --url http://localhost:8001

文件格式（JSON）：
    {"title": "标题", "body": "正文（可选，支持 \\n 换行）"}

密钥来自 backend/.env 的 ANNOUNCE_KEY。
"""
import argparse
import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

DEFAULT_URL = "http://localhost:8001"
ANNOUNCE_KEY_HEADER = "X-Announce-Key"
TIMEOUT_SECONDS = 10


def parse_notice(text: str) -> tuple[str, str]:
    """解析 JSON 文本，返回 (title, body)。"""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"不是合法的 JSON：{error}") from error
    if not isinstance(data, dict):
        raise ValueError("JSON 顶层必须是对象")
    title = str(data.get("title", "")).strip()
    if not title:
        raise ValueError("缺少 title 字段")
    return title, str(data.get("body", ""))


def read_notice(path: str) -> tuple[str, str]:
    return parse_notice(Path(path).read_text(encoding="utf-8"))


def publish(title: str, body: str, *, url: str, key: str) -> dict:
    response = requests.post(
        f"{url}/api/announcements",
        json={"title": title, "body": body},
        headers={ANNOUNCE_KEY_HEADER: key},
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def main() -> int:
    parser = argparse.ArgumentParser(description="发布公告到服务器所有用户")
    parser.add_argument("file", help="公告 JSON 文件路径")
    parser.add_argument("--url", default=DEFAULT_URL, help="后端地址")
    args = parser.parse_args()

    load_dotenv()
    key = os.environ.get("ANNOUNCE_KEY", "")
    if not key:
        print("未配置 ANNOUNCE_KEY，请先在 backend/.env 中设置", file=sys.stderr)
        return 1

    try:
        title, body = read_notice(args.file)
    except (OSError, ValueError) as error:
        print(f"读取公告失败：{error}", file=sys.stderr)
        return 1

    try:
        announcement = publish(title, body, url=args.url, key=key)
    except requests.RequestException as error:
        print(f"发布失败：{error}", file=sys.stderr)
        return 1

    print(f"已发布公告 #{announcement['id']}：{announcement['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
