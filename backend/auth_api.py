"""认证接口：注册、登录、当前用户、登出。"""
import re

from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, Field, field_validator

import auth
import avatars
import quotas
import users
from db import Owner
from session import SESSION_COOKIE

USERNAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]{2,19}$")
PASSWORD_LENGTH = 8

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    """注册与登录共用的入参：用户名 + 恰好 8 位密码。"""
    username: str = Field(min_length=3, max_length=20)
    password: str = Field(min_length=PASSWORD_LENGTH, max_length=PASSWORD_LENGTH)

    @field_validator("username")
    @classmethod
    def _check_username(cls, value: str) -> str:
        if not USERNAME_PATTERN.match(value):
            raise ValueError("用户名需为 3-20 位字母、数字或下划线，且以字母开头")
        return value

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        if any(char.isspace() for char in value):
            raise ValueError("密码不能包含空白字符")
        return value


def _user_payload(user: dict) -> dict:
    """对外用户结构：public_user + 是否管理员。"""
    return {**users.public_user(user), "is_admin": users.is_admin(user)}


def _auth_payload(user: dict) -> dict:
    """登录/注册后的统一返回：用户 + 两种额度。"""
    owner = Owner(user_id=user["id"], session_id="")
    return {
        "user": _user_payload(user),
        "quota": quotas.snapshot(owner, user),
        "rag_quota": quotas.snapshot_rag(owner, user),
    }


def _start_session(request: Request, response: Response, user_id: int) -> None:
    """下发登录态，并把该浏览器的匿名数据绑到账号。"""
    token = auth.create_session_token()
    users.create_auth_session(token, user_id, auth.session_expiry())
    auth.set_auth_cookie(response, token)
    session_id = request.cookies.get(SESSION_COOKIE)
    if session_id:
        users.bind_session_to_user(session_id, user_id)


@router.post("/register", status_code=201)
def register(req: Credentials, request: Request, response: Response) -> dict:
    if users.get_user_by_username(req.username) is not None:
        raise HTTPException(status_code=409, detail="用户名已被占用")
    user = users.create_user(req.username, auth.hash_password(req.password))
    _start_session(request, response, user["id"])
    return _auth_payload(users.get_user(user["id"]))


@router.post("/login")
def login(req: Credentials, request: Request, response: Response) -> dict:
    user = users.get_user_by_username(req.username)
    if user is None or not auth.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    _start_session(request, response, user["id"])
    return _auth_payload(user)


@router.get("/me")
def me(request: Request) -> dict:
    user = auth.get_current_user(request)
    owner = Owner(
        user_id=user["id"] if user else None,
        session_id=request.cookies.get(SESSION_COOKIE, ""),
    )
    return {
        "user": _user_payload(user) if user else None,
        "quota": quotas.snapshot(owner, user),
        "rag_quota": quotas.snapshot_rag(owner, user),
    }


@router.post("/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...)) -> dict:
    """上传头像（jpg / png / webp，≤ 2MB），替换旧头像。"""
    user = auth.require_user(request)
    try:
        path = await avatars.save_avatar(user["id"], file)
    except avatars.AvatarError as error:
        raise HTTPException(status_code=400, detail=str(error))
    avatars.remove_avatar(user["avatar"])
    updated = users.set_avatar(user["id"], path)
    return {"user": users.public_user(updated)}


@router.delete("/session")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get(auth.AUTH_COOKIE)
    if token:
        users.delete_auth_session(token)
    auth.clear_auth_cookie(response)
    return {"ok": True}
