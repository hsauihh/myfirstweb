"""会话标识：用 Cookie 里的 session_id 隔离不同访客的数据。"""
import uuid

from fastapi import Request, Response

SESSION_COOKIE = "session_id"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30      # 记 30 天


def resolve_session_id(request: Request) -> tuple[str, bool]:
    """读取当前访客的 session_id，返回 (sid, 是否为本次新签发)。"""
    sid = request.cookies.get(SESSION_COOKIE)
    if sid:
        return sid, False
    return uuid.uuid4().hex, True


def set_session_cookie(response: Response, sid: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, sid,
        httponly=True, samesite="lax",
        max_age=SESSION_MAX_AGE_SECONDS,
    )


def get_session_id(request: Request, response: Response) -> str:
    """读取 session_id；首次访问时在响应上写入 Cookie。"""
    sid, is_new = resolve_session_id(request)
    if is_new:
        set_session_cookie(response, sid)
    return sid
