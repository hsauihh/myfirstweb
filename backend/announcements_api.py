"""公告接口：登录用户读取/标记已读，脚本用密钥发布。"""
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import announcements
from auth import require_user
from friends_ws import manager

TITLE_MAX_LENGTH = 100
BODY_MAX_LENGTH = 5000
ANNOUNCE_KEY_HEADER = "X-Announce-Key"

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


class AnnouncementRequest(BaseModel):
    title: str = Field(min_length=1, max_length=TITLE_MAX_LENGTH)
    body: str = Field(default="", max_length=BODY_MAX_LENGTH)


@router.get("")
def list_announcements(request: Request) -> dict:
    user = require_user(request)
    return announcements.list_for(user["id"])


@router.post("/{announcement_id}/read")
def mark_read_endpoint(announcement_id: int, request: Request) -> dict:
    user = require_user(request)
    if not announcements.mark_read(user["id"], announcement_id):
        raise HTTPException(status_code=404, detail="公告不存在")
    return {"ok": True, "unread": announcements.unread_count(user["id"])}


@router.post("", status_code=201)
async def publish_endpoint(req: AnnouncementRequest, request: Request) -> dict:
    """发布公告：需请求头携带与 .env 中 ANNOUNCE_KEY 一致的密钥。"""
    key = os.environ.get("ANNOUNCE_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="未配置 ANNOUNCE_KEY")
    if request.headers.get(ANNOUNCE_KEY_HEADER) != key:
        raise HTTPException(status_code=401, detail="发布密钥不正确")

    announcement = announcements.create(req.title, req.body)
    await manager.broadcast_all(
        {"type": "announcement", "announcement": announcement}
    )
    return announcement
