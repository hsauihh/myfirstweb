"""认证：密码哈希、登录态解析、数据归属解析。"""
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, Request, Response

import users
from db import Owner
from session import SESSION_COOKIE, get_session_id, resolve_session_id, set_session_cookie

AUTH_COOKIE = "auth_token"
AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30      # 登录态保留 30 天
BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def session_expiry() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(seconds=AUTH_MAX_AGE_SECONDS)
    ).isoformat()


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        AUTH_COOKIE, token,
        httponly=True, samesite="lax",
        max_age=AUTH_MAX_AGE_SECONDS,
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE)


def get_current_user(request: Request) -> dict | None:
    """按 auth_token Cookie 解析当前登录用户；未登录或过期返回 None。"""
    token = request.cookies.get(AUTH_COOKIE)
    if not token:
        return None
    session = users.get_auth_session(token)
    if session is None:
        return None
    return users.get_user(session["user_id"])


def require_user(request: Request) -> dict:
    """需要登录的接口用：未登录抛 401。"""
    user = get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    return user


def resolve_owner(request: Request, response: Response) -> Owner:
    """普通接口：已登录按用户归属，否则按匿名 session（必要时下发 Cookie）。"""
    user = get_current_user(request)
    if user is not None:
        return Owner(
            user_id=user["id"],
            session_id=request.cookies.get(SESSION_COOKIE, ""),
        )
    return Owner(user_id=None, session_id=get_session_id(request, response))


def resolve_owner_for_stream(
    request: Request,
) -> tuple[Owner, dict | None, str | None]:
    """流式接口：返回 (归属, 当前用户或 None, 需要新签发的 session_id 或 None)。"""
    user = get_current_user(request)
    if user is not None:
        owner = Owner(
            user_id=user["id"],
            session_id=request.cookies.get(SESSION_COOKIE, ""),
        )
        return owner, user, None
    session_id, is_new = resolve_session_id(request)
    return (
        Owner(user_id=None, session_id=session_id),
        None,
        session_id if is_new else None,
    )
