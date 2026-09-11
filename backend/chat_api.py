"""AI 对话接口层：会话 CRUD + SSE 流式回复 + 匿名额度的消耗。

数据按 Owner 归属（登录用户或匿名 session），越权访问统一返回 404。
"""
import json
import os
from collections.abc import Iterator
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

import quotas
import kb
import rag
from auth import resolve_owner, resolve_owner_for_stream
from chat import (
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_SYSTEM_PROMPT,
    HISTORY_FETCH_LIMIT,
    ChatConfig,
    build_messages,
    stream_reply,
)
from db import Owner
from session import set_session_cookie
from storage import (
    RAG_KIND,
    add_message,
    create_conversation,
    delete_conversation,
    get_conversation,
    get_messages,
    list_conversations,
    rename_conversation,
    touch_conversation,
)

DEFAULT_TITLE = "新对话"
TITLE_MAX_LENGTH = 20
MAX_CONTENT_LENGTH = 4000
CONVERSATION_LIST_LIMIT = 20
ConversationKind = Literal["chat", "rag"]
# qa = 单轮问答（不带历史）；context = 多轮对话（带历史）
MessageMode = Literal["qa", "context"]

router = APIRouter(prefix="/api/chat", tags=["chat"])


class MessageRequest(BaseModel):
    """知识库相关字段只在 kind=rag 的会话里生效。"""
    content: str = Field(min_length=1, max_length=MAX_CONTENT_LENGTH)
    mode: MessageMode = "qa"
    include_system: bool = True


def _chat_config() -> ChatConfig:
    """从环境变量读取模型配置，缺省指向 DeepSeek。"""
    return ChatConfig(
        base_url=os.environ.get("CHAT_BASE_URL", DEFAULT_BASE_URL),
        api_key=os.environ.get("CHAT_API_KEY", ""),
        model=os.environ.get("CHAT_MODEL", DEFAULT_MODEL),
        system_prompt=os.environ.get("CHAT_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT),
    )


def _require_conversation(owner: Owner, conversation_id: int) -> dict:
    conversation = get_conversation(owner, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conversation


def _make_title(text: str) -> str:
    text = text.strip()
    if len(text) <= TITLE_MAX_LENGTH:
        return text
    return text[:TITLE_MAX_LENGTH] + "…"


def _quota_message(owner: Owner) -> str:
    if owner.user_id is None:
        return "匿名对话次数已用完，请登录后继续"
    return "今日免费次数已用完，开通 VIP 后不限量"


def _quota_error(
    owner: Owner, user: dict | None, use_rag: bool
) -> JSONResponse:
    detail = (
        "知识库免费次数已用完，开通 VIP 后不限量"
        if use_rag
        else _quota_message(owner)
    )
    snapshot = (
        quotas.snapshot_rag(owner, user)
        if use_rag
        else quotas.snapshot(owner, user)
    )
    return JSONResponse(
        status_code=403,
        content={
            "detail": detail,
            "code": quotas.QUOTA_EXCEEDED_CODE,
            "quota": snapshot,
        },
    )


def _check_quota(
    owner: Owner, user: dict | None, use_rag: bool, include_system: bool = True
) -> tuple[dict | None, JSONResponse | None]:
    """返回 (额度快照, 错误响应)；额度足够时错误响应为 None。"""
    if use_rag:
        if owner.user_id is None:
            raise HTTPException(status_code=403, detail="登录后可使用知识库")
        if not rag.is_ready(owner.user_id, include_public=include_system):
            detail = (
                "知识库为空，请先在「知识库 → 来源管理」添加文章或运行 ingest.py"
                if include_system
                else "个人知识库为空，请先在「来源管理」添加文章"
            )
            raise HTTPException(status_code=409, detail=detail)
        if not quotas.consume_rag(owner, user):
            return quotas.snapshot_rag(owner, user), _quota_error(owner, user, True)
        return quotas.snapshot_rag(owner, user), None

    if not quotas.consume(owner, user):
        return quotas.snapshot(owner, user), _quota_error(owner, user, False)
    return quotas.snapshot(owner, user), None


def _rag_context(
    owner: Owner, content: str, include_system: bool
) -> tuple[str, list[dict]]:
    """检索个人库（可加站内公共库）；检索前先懒同步（文章改过则重建向量、小节与图谱）。"""
    kb.sync_user(owner.user_id)
    retrieval = rag.retrieve(
        content, user_id=owner.user_id, include_public=include_system
    )
    return rag.build_context(retrieval), rag.citations(retrieval)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/conversations")
def create_conversation_endpoint(
    request: Request, response: Response, kind: ConversationKind = "chat"
) -> dict:
    owner = resolve_owner(request, response)
    return create_conversation(owner, DEFAULT_TITLE, kind)


@router.get("/conversations")
def list_conversations_endpoint(
    request: Request,
    response: Response,
    limit: int = CONVERSATION_LIST_LIMIT,
    kind: ConversationKind = "chat",
) -> list[dict]:
    owner = resolve_owner(request, response)
    return list_conversations(owner, limit, kind)


@router.get("/conversations/{conversation_id}/messages")
def get_messages_endpoint(
    conversation_id: int, request: Request, response: Response
) -> list[dict]:
    owner = resolve_owner(request, response)
    _require_conversation(owner, conversation_id)
    return get_messages(conversation_id)


@router.delete("/conversations/{conversation_id}")
def delete_conversation_endpoint(
    conversation_id: int, request: Request, response: Response
) -> dict:
    owner = resolve_owner(request, response)
    deleted = delete_conversation(owner, conversation_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"deleted": deleted}


@router.post("/conversations/{conversation_id}/messages")
def send_message_endpoint(
    conversation_id: int, req: MessageRequest, request: Request
) -> Response:
    config = _chat_config()
    if not config.api_key:
        raise HTTPException(status_code=503, detail="未配置 CHAT_API_KEY")

    owner, user, new_session_id = resolve_owner_for_stream(request)
    conversation = _require_conversation(owner, conversation_id)

    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="消息不能为空")

    use_rag = conversation["kind"] == RAG_KIND
    quota, error = _check_quota(owner, user, use_rag, req.include_system)
    if error is not None:
        return error
    context = ""
    sources: list[dict] = []
    if use_rag:
        context, sources = _rag_context(owner, content, req.include_system)

    # 问答模式不带历史（单轮）；上下文模式取最近历史（多轮）
    history = (
        get_messages(conversation_id, HISTORY_FETCH_LIMIT)
        if req.mode == "context"
        else []
    )
    add_message(conversation_id, "user", content)
    if conversation["title"] == DEFAULT_TITLE:
        rename_conversation(conversation_id, _make_title(content))

    messages = build_messages(config.system_prompt, history, content, context=context)
    stream = StreamingResponse(
        _stream(config, conversation_id, messages, quota=quota, sources=sources),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
    if new_session_id:
        set_session_cookie(stream, new_session_id)
    return stream


def _stream(
    config: ChatConfig,
    conversation_id: int,
    messages: list[dict],
    *,
    quota: dict | None,
    sources: list[dict] | None = None,
) -> Iterator[str]:
    """把模型增量转成 SSE 事件；已产出的内容无论是否中断都落库（含来源引用）。"""
    chunks: list[str] = []
    error_detail = ""
    reply: dict | None = None
    conversation: dict | None = None
    try:
        for delta in stream_reply(messages, config):
            chunks.append(delta)
            yield _sse("delta", {"text": delta})
    except Exception as error:                  # 模型/网络异常统一转成 error 事件
        error_detail = f"模型调用失败：{error}"
    finally:
        if chunks:
            reply = add_message(
                conversation_id, "assistant", "".join(chunks), sources=sources
            )
            conversation = touch_conversation(conversation_id)

    if error_detail:
        yield _sse("error", {"detail": error_detail})
    elif reply is None:
        yield _sse("error", {"detail": "模型没有返回内容"})
    else:
        yield _sse(
            "done",
            {"message": reply, "conversation": conversation, "quota": quota},
        )
