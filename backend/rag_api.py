"""知识库状态接口：站内公共库 + 当前登录用户的个人库。"""
from fastapi import APIRouter, Request

import auth
import rag
import rag_store

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.get("/status")
def status_endpoint(request: Request) -> dict:
    user = auth.get_current_user(request)
    user_id = user["id"] if user else None
    public = rag_store.count_public()
    personal = rag_store.count_personal(user_id) if user_id is not None else 0
    return {
        "ready": rag.is_ready(user_id),
        "documents": public + personal,
        "personal": personal,
        "public": public,
    }
