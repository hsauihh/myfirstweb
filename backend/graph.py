"""知识图谱抽取层：用 LLM 从块文本里抽实体与关系，并按内容哈希缓存。

图谱是检索的**增强项**而不是必需项：任何环节失败都只降级为纯向量检索，
绝不阻断入库、来源同步或问答。

同一个块内容永远得到同一份抽取结果（`graph_extractions` 按内容哈希缓存），
所以重建公共库、多个用户加同一篇文章都不会重复调用模型。
"""
import hashlib
import json
import os
import re
import unicodedata

import graph_store
import rag_store

DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"
CHUNKS_PER_CALL = 6              # 一次请求抽多个块，摊薄往返延迟
PARSE_ATTEMPTS = 2               # 解析失败整批重试的次数
MAX_ENTITIES_PER_CHUNK = 12
MAX_RELATIONS_PER_CHUNK = 12
MIN_NAME_LENGTH = 2
MAX_NAME_LENGTH = 24
MAX_KIND_LENGTH = 8
MAX_RELATION_LENGTH = 12
SOURCE_CHUNK_LIMIT = 24          # 个人库单篇最多抽这么多块（其余块仍可被向量检索命中）

FENCE = re.compile(r"```[a-zA-Z]*\n?|```")
NAME_CHARS = re.compile(r"\w")
NAME_TRIM = " \t·-—_、,，.。:：;；'\"()（）[]【】"

SYSTEM_PROMPT = """你是知识图谱抽取器。从用户给出的资料片段里抽取实体与实体间关系，只输出 JSON。

要求：
- 实体是资料里出现的名词性概念，name 用资料中最规范的称呼，kind 用 1-4 个字概括（概念/技术/部件/人物/课程等）。
- 关系描述同一片段内两个实体之间的直接联系，relation 用 2-6 个字（组成/访问/用于/属于等）。
- 每条关系的 src 与 dst 必须是同一片段里抽出的实体名，不要跨片段连边。
- 每个片段最多 12 个实体、12 条关系；只抽资料里明确写到的内容，不要编造。
- 严格按下面格式输出，不要写解释文字：

{"results":[{"index":1,"entities":[{"name":"CPU","kind":"部件"}],"relations":[{"src":"CPU","dst":"主存","relation":"访问"}]}]}

results 的条数与顺序必须与输入片段一一对应。"""


def _config() -> tuple[str, str, str]:
    base_url = os.environ.get("CHAT_BASE_URL", DEFAULT_BASE_URL)
    api_key = os.environ.get("CHAT_API_KEY", "")
    model = os.environ.get("GRAPH_MODEL") or os.environ.get("CHAT_MODEL", DEFAULT_MODEL)
    return base_url, api_key, model


def available() -> bool:
    """是否具备抽图条件（需要模型 key）。"""
    return bool(_config()[1])


def _complete(prompt: str) -> str:
    """调用模型拿一次 JSON 文本；测试里替换本函数即可离线运行。"""
    from openai import OpenAI

    base_url, api_key, model = _config()
    client = OpenAI(base_url=base_url, api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )
    return response.choices[0].message.content or ""


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_name(name: object) -> tuple[str, str] | None:
    """规范化实体名，返回 (匹配用 key, 展示名)；不合格返回 None。

    key 用来判等（去空白 + 大小写折叠），name 保留原始写法用于拼提示词。
    """
    if not isinstance(name, str):
        return None
    display = " ".join(unicodedata.normalize("NFKC", name).split()).strip(NAME_TRIM)
    if not MIN_NAME_LENGTH <= len(display) <= MAX_NAME_LENGTH:
        return None
    if NAME_CHARS.search(display) is None:
        return None
    key = "".join(display.split()).casefold()
    return (key, display) if key else None


def _clip(value: object, limit: int) -> str:
    return " ".join(str(value or "").split())[:limit]


def clean_entry(raw: dict) -> dict:
    """规范一块的抽取结果：同名实体合并、关系两端必须都在本块内、数量封顶。"""
    entities: dict[str, dict] = {}
    for item in raw.get("entities") or []:
        if not isinstance(item, dict):
            continue
        parsed = normalize_name(item.get("name"))
        if parsed is None or parsed[0] in entities:
            continue
        entities[parsed[0]] = {
            "key": parsed[0],
            "name": parsed[1],
            "kind": _clip(item.get("kind"), MAX_KIND_LENGTH),
        }
        if len(entities) >= MAX_ENTITIES_PER_CHUNK:
            break

    relations: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for item in raw.get("relations") or []:
        if not isinstance(item, dict):
            continue
        src = normalize_name(item.get("src"))
        dst = normalize_name(item.get("dst"))
        label = _clip(item.get("relation"), MAX_RELATION_LENGTH)
        if src is None or dst is None or not label or src[0] == dst[0]:
            continue
        if src[0] not in entities or dst[0] not in entities:
            continue
        signature = (src[0], dst[0], label)
        if signature in seen:
            continue
        seen.add(signature)
        relations.append({"src": src[0], "dst": dst[0], "relation": label})
        if len(relations) >= MAX_RELATIONS_PER_CHUNK:
            break
    return {"entities": list(entities.values()), "relations": relations}


def parse_payload(raw: str, expected: int) -> list[dict] | None:
    """解析一次批量结果；条数与块数不一致即判为失败（交给上层重试）。"""
    text = FENCE.sub("", raw or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list) or len(results) != expected:
        return None
    return [clean_entry(item) for item in results if isinstance(item, dict)]


def build_prompt(chunks: list[str]) -> str:
    blocks = "\n\n".join(
        f'<片段 index="{index}">{chunk}</片段>' for index, chunk in enumerate(chunks, 1)
    )
    return f"抽取下面 {len(chunks)} 个片段的实体与关系：\n\n{blocks}"


def _extract_batch(chunks: list[str]) -> list[dict] | None:
    """抽一批块；模型报错或解析失败都重试一次，仍失败返回 None。"""
    prompt = build_prompt(chunks)
    for _ in range(PARSE_ATTEMPTS):
        try:
            raw = _complete(prompt)
        except Exception:               # 模型/网络异常不该冒泡到入库流程
            continue
        entries = parse_payload(raw, len(chunks))
        if entries is not None:
            return entries
    return None


def _pending_payloads(rows: list[dict]) -> tuple[dict[int, dict], list[dict]]:
    """命中缓存的块直接用；返回 (块id→payload, 待抽取的块列表)。"""
    digests = [content_hash(row["content"]) for row in rows]
    hits = graph_store.get_extractions(digests)
    payloads: dict[int, dict] = {}
    pending: list[dict] = []
    for row, digest in zip(rows, digests):
        if digest in hits:
            payloads[row["id"]] = hits[digest]
        else:
            pending.append({"id": row["id"], "content": row["content"], "digest": digest})
    return payloads, pending


def build_for_source(
    source_key: str, *, max_chunks: int | None = None
) -> dict:
    """为某来源的块建图（幂等，可重复跑）；max_chunks 限制抽取的块数。

    返回 {"chunks","cached","extracted","failed","mentions","relations"}。
    """
    rows = rag_store.chunks_for_source(source_key)
    if max_chunks is not None:
        rows = rows[:max_chunks]
    stats = {
        "chunks": len(rows),
        "cached": 0,
        "extracted": 0,
        "failed": 0,
        "mentions": 0,
        "relations": 0,
    }
    if not rows:
        return stats

    payloads, pending = _pending_payloads(rows)
    stats["cached"] = len(payloads)
    fresh: dict[str, dict] = {}
    for start in range(0, len(pending), CHUNKS_PER_CALL):
        batch = pending[start : start + CHUNKS_PER_CALL]
        entries = _extract_batch([item["content"] for item in batch])
        if entries is None:
            stats["failed"] += len(batch)
            continue
        for item, entry in zip(batch, entries):
            payloads[item["id"]] = entry
            fresh[item["digest"]] = entry
            stats["extracted"] += 1

    graph_store.put_extractions(fresh)
    result = graph_store.replace_chunks(
        [{"chunk_id": chunk_id, **payload} for chunk_id, payload in payloads.items()]
    )
    stats["mentions"] = result["mentions"]
    stats["relations"] = result["relations"]
    return stats
