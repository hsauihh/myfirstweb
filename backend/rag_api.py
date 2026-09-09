"""知识库状态接口。"""
from fastapi import APIRouter

import rag
import rag_store

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.get("/status")
def status_endpoint() -> dict:
    return {"ready": rag.is_ready(), "documents": rag_store.count()}
