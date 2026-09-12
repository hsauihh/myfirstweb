"""知识库状态接口：站内公共库 + 当前登录用户的个人库 + 图谱规模 + 结构图数据。"""
from fastapi import APIRouter, HTTPException, Request

import auth
import graph_store
import rag
import rag_graph
import rag_graph_detail
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
        "entities": graph_store.count_entities(),
        "relations": graph_store.count_relations(),
    }


@router.get("/graph")
def graph_endpoint(request: Request) -> dict:
    """结构图：章 / 来源骨架 + 核心概念 + 关系；未登录只看站内公共库。"""
    user = auth.get_current_user(request)
    return rag_graph.structure(user["id"] if user else None)


@router.get("/graph/entities/{entity_id}")
def graph_entity_endpoint(entity_id: int, request: Request) -> dict:
    """概念详情；实体对该用户不可见时返回 404，不泄露他人块内容。"""
    user = auth.get_current_user(request)
    detail = rag_graph_detail.entity_detail(entity_id, user["id"] if user else None)
    if detail is None:
        raise HTTPException(status_code=404, detail="实体不存在或不可见")
    return detail

