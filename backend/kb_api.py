"""个人知识库接口：来源增删查、候选文章挑选、手动同步、随心一记的笔记。"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import kb
import rag_store
from auth import require_user

CANDIDATE_LIMIT = 20
MAX_LIMIT = 50
NOTE_PAGE_SIZE = kb.NOTE_PAGE_SIZE
NOTE_MAX_LIMIT = kb.NOTE_MAX_LIMIT

router = APIRouter(prefix="/api/kb", tags=["kb"])


class SourceCreate(BaseModel):
    post_id: int = Field(gt=0)


class NoteCreate(BaseModel):
    """笔记正文；长度上限与前端计数器一致。"""
    content: str = Field(min_length=1, max_length=kb.NOTE_MAX_LENGTH)


def _safe_limit(limit: int, default: int) -> int:
    return min(max(limit, 1), MAX_LIMIT)


@router.get("/sources")
def list_sources_endpoint(request: Request) -> dict:
    """我的来源列表；顺手做一次懒同步（文章改过则重建，不可见则清理）。"""
    user = require_user(request)
    kb.sync_user(user["id"])
    public = rag_store.count_public()
    personal = rag_store.count_personal(user["id"])
    return {
        "items": kb.list_sources(user["id"]),
        "personal_documents": personal,
        "public_documents": public,
        "ready": personal + public > 0,
    }


@router.get("/candidates")
def candidates_endpoint(
    request: Request, q: str = "", limit: int = CANDIDATE_LIMIT, offset: int = 0
) -> dict:
    user = require_user(request)
    return kb.candidates(
        user["id"], q, _safe_limit(limit, CANDIDATE_LIMIT), max(offset, 0)
    )


@router.post("/sources")
def add_source_endpoint(req: SourceCreate, request: Request) -> dict:
    user = require_user(request)
    existed = kb.has_source(user["id"], req.post_id)
    try:
        source = kb.add_source(user["id"], req.post_id)
    except kb.KbSourceTooShort:
        raise HTTPException(status_code=422, detail="文章太短，无法加入知识库")
    if source is None:
        raise HTTPException(status_code=404, detail="文章不存在或不可见")
    return {"source": source, "created": not existed}


@router.delete("/sources/{post_id}")
def remove_source_endpoint(post_id: int, request: Request) -> dict:
    user = require_user(request)
    deleted = kb.remove_source(user["id"], post_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="来源不存在")
    return {"deleted": deleted}


@router.post("/sources/{post_id}/sync")
def sync_source_endpoint(post_id: int, request: Request) -> dict:
    user = require_user(request)
    source = kb.sync_source(user["id"], post_id)
    if source is None:
        raise HTTPException(status_code=404, detail="来源不存在或已不可见")
    return {"source": source}


# ---------- 随心一记 ----------


@router.get("/notes")
def list_notes_endpoint(
    request: Request, limit: int = NOTE_PAGE_SIZE, offset: int = 0
) -> dict:
    """我的笔记列表（时间倒序，带总数供分页）。"""
    user = require_user(request)
    return kb.list_notes(
        user["id"], min(max(limit, 1), NOTE_MAX_LIMIT), max(offset, 0)
    )


@router.post("/notes")
def add_note_endpoint(req: NoteCreate, request: Request) -> dict:
    """记一条笔记：入库即可被知识库问答检索到（不消耗对话额度）。"""
    user = require_user(request)
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="笔记不能为空")
    return {"note": kb.add_note(user["id"], content), "created": True}


@router.delete("/notes/{note_id}")
def remove_note_endpoint(note_id: int, request: Request) -> dict:
    user = require_user(request)
    deleted = kb.remove_note(user["id"], note_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"deleted": deleted}
