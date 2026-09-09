"""认证接口：注册、登录、当前用户、登出。"""
import re

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

import auth
import users
from session import SESSION_COOKIE
from users import ANONYMOUS_CHAT_LIMIT

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


def _anonymous_quota(request: Request) -> dict | None:
    """匿名访客的剩余额度；已登录返回 None。"""
    if auth.get_current_user(request) is not None:
        return None
    session_id = request.cookies.get(SESSION_COOKIE, "")
    used = users.get_anonymous_used(session_id) if session_id else 0
    return {
        "used": used,
        "limit": ANONYMOUS_CHAT_LIMIT,
        "remaining": max(0, ANONYMOUS_CHAT_LIMIT - used),
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
    return {"user": user, "quota": None}


@router.post("/login")
def login(req: Credentials, request: Request, response: Response) -> dict:
    user = users.get_user_by_username(req.username)
    if user is None or not auth.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    _start_session(request, response, user["id"])
    return {"user": users.public_user(user), "quota": None}


@router.get("/me")
def me(request: Request) -> dict:
    user = auth.get_current_user(request)
    if user is None:
        return {"user": None, "quota": _anonymous_quota(request)}
    return {"user": users.public_user(user), "quota": None}


@router.delete("/session")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get(auth.AUTH_COOKIE)
    if token:
        users.delete_auth_session(token)
    auth.clear_auth_cookie(response)
    return {"ok": True}
