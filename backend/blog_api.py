"""博客接口：公开列表/详情、我的文章增删改、点赞。"""
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

import blog
import kb
import users
from auth import get_current_user, require_user

router = APIRouter(prefix="/api/blog", tags=["blog"])

VISIBILITY_PATTERN = "^(draft|private|public)$"


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=blog.TITLE_MAX_LENGTH)
    content: str = Field(min_length=1, max_length=blog.CONTENT_MAX_LENGTH)
    visibility: str = Field(default=blog.DRAFT, pattern=VISIBILITY_PATTERN)

    @field_validator("title", "content")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("不能为空")
        return value


class PostUpdate(BaseModel):
    title: str | None = Field(
        default=None, min_length=1, max_length=blog.TITLE_MAX_LENGTH
    )
    content: str | None = Field(
        default=None, min_length=1, max_length=blog.CONTENT_MAX_LENGTH
    )
    visibility: str | None = Field(default=None, pattern=VISIBILITY_PATTERN)

    @field_validator("title", "content")
    @classmethod
    def _not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("不能为空")
        return value


def _viewer_id(request: Request) -> int | None:
    viewer = get_current_user(request)
    return viewer["id"] if viewer else None


def _safe_limit(limit: int, default: int) -> int:
    return min(max(limit, 1), blog.MAX_LIMIT)


@router.get("/posts")
def list_posts(
    request: Request,
    limit: int = blog.DEFAULT_LIMIT,
    offset: int = 0,
    sort: Literal["published", "likes"] = "published",
) -> dict:
    return blog.list_public_posts(
        _safe_limit(limit, blog.DEFAULT_LIMIT), max(offset, 0), _viewer_id(request), sort
    )


@router.get("/me/posts")
def list_my_posts(request: Request, limit: int = blog.MY_LIMIT, offset: int = 0) -> dict:
    user = require_user(request)
    return blog.list_my_posts(user["id"], _safe_limit(limit, blog.MY_LIMIT), max(offset, 0))


@router.get("/posts/{post_id}")
def get_post_endpoint(post_id: int, request: Request) -> dict:
    viewer_id = _viewer_id(request)
    post = blog.get_post_detail(post_id, viewer_id)
    if post is None:
        raise HTTPException(status_code=404, detail="文章不存在或不可见")
    if viewer_id is not None:
        post["in_kb"] = kb.has_source(viewer_id, post_id)
    return post


@router.post("/posts", status_code=201)
def create_post_endpoint(req: PostCreate, request: Request) -> dict:
    user = require_user(request)
    return blog.create_post(user["id"], req.title, req.content, req.visibility)


@router.patch("/posts/{post_id}")
def update_post_endpoint(post_id: int, req: PostUpdate, request: Request) -> dict:
    user = require_user(request)
    post = blog.update_post(
        user["id"], post_id,
        title=req.title, content=req.content, visibility=req.visibility,
    )
    if post is None:
        raise HTTPException(status_code=404, detail="文章不存在")
    if post["visibility"] != blog.PUBLIC:
        # 文章不再公开：从他人知识库移除（作者自己的那份保留）
        kb.remove_post_everywhere(post_id, except_user_id=user["id"])
    return post


@router.delete("/posts/{post_id}")
def delete_post_endpoint(post_id: int, request: Request) -> dict:
    user = require_user(request)
    if not blog.delete_post(user["id"], post_id, is_admin=users.is_admin(user)):
        raise HTTPException(status_code=404, detail="文章不存在")
    kb.remove_post_everywhere(post_id)
    return {"ok": True}


@router.post("/posts/{post_id}/like")
def toggle_like_endpoint(post_id: int, request: Request) -> dict:
    user = require_user(request)
    result = blog.toggle_like(user["id"], post_id)
    if result is None:
        raise HTTPException(status_code=404, detail="文章不存在或不可见")
    return result
