"""对话额度：匿名总额度 + 登录用户每日额度 + VIP 判定。"""
from datetime import datetime
from zoneinfo import ZoneInfo

import users
from db import Owner

ANONYMOUS_CHAT_LIMIT = 3
DAILY_FREE_LIMIT = 20
RAG_DAILY_LIMIT = 5
QUOTA_EXCEEDED_CODE = "chat_quota_exceeded"
SHANGHAI = ZoneInfo("Asia/Shanghai")


def today_key() -> str:
    """按中国时区取自然日（YYYY-MM-DD）。"""
    return datetime.now(SHANGHAI).date().isoformat()


def snapshot(owner: Owner, user: dict | None) -> dict | None:
    """额度快照；VIP 不限量返回 None。"""
    if owner.user_id is None:
        return _payload(
            "anonymous", users.get_anonymous_used(owner.session_id), ANONYMOUS_CHAT_LIMIT
        )
    if user is not None and users.is_vip(user):
        return None
    return _payload(
        "daily", users.get_daily_used(owner.user_id, today_key()), DAILY_FREE_LIMIT
    )


def consume(owner: Owner, user: dict | None) -> bool:
    """占用一次额度；VIP 直接放行，额度用尽返回 False。"""
    if owner.user_id is None:
        return users.consume_anonymous_quota(owner.session_id, ANONYMOUS_CHAT_LIMIT)
    if user is not None and users.is_vip(user):
        return True
    return users.consume_daily_quota(owner.user_id, today_key(), DAILY_FREE_LIMIT)


def snapshot_rag(owner: Owner, user: dict | None) -> dict | None:
    """知识库额度快照；匿名或 VIP 返回 None。"""
    if owner.user_id is None:
        return None
    if user is not None and users.is_vip(user):
        return None
    return _payload(
        "rag_daily",
        users.get_rag_daily_used(owner.user_id, today_key()),
        RAG_DAILY_LIMIT,
    )


def consume_rag(owner: Owner, user: dict | None) -> bool:
    """占用一次知识库额度；匿名返回 False，VIP 直接放行。"""
    if owner.user_id is None:
        return False
    if user is not None and users.is_vip(user):
        return True
    return users.consume_rag_daily_quota(owner.user_id, today_key(), RAG_DAILY_LIMIT)


def _payload(scope: str, used: int, limit: int) -> dict:
    return {
        "scope": scope,
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
    }
