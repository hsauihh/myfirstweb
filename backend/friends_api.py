"""好友接口层：申请、好友列表、私聊消息。全部需要登录。"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

import direct_messages
import friend_codes
import friends
import users
from auth import require_user
from friends_ws import manager

MESSAGE_MAX_LENGTH = 2000

router = APIRouter(prefix="/api/friends", tags=["friends"])


class AddFriendRequest(BaseModel):
    """添加好友：用户名或好友码二选一。"""
    username: str | None = None
    code: str | None = None

    @field_validator("username", "code")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MESSAGE_MAX_LENGTH)


def _lookup_target(username: str | None, code: str | None) -> dict | None:
    has_username = bool(username)
    has_code = bool(code)
    if has_username == has_code:
        raise HTTPException(
            status_code=422, detail="请提供用户名或好友码，且只提供一个"
        )
    if has_username:
        found = users.get_user_by_username(username)
        return users.public_user(found) if found else None
    return friend_codes.find(code)


def _require_friendship(user_id: int, friend_id: int) -> None:
    if user_id == friend_id:
        raise HTTPException(status_code=422, detail="不能和自己聊天")
    if not friends.are_friends(user_id, friend_id):
        raise HTTPException(status_code=403, detail="还不是好友")


async def _notify_friends_became(user: dict, target: dict) -> None:
    await manager.send(
        target["id"], {"type": "friend_accepted", "friend": users.public_user(user)}
    )
    await manager.send(
        user["id"], {"type": "friend_accepted", "friend": users.public_user(target)}
    )


@router.get("")
async def list_friends_endpoint(request: Request) -> list[dict]:
    user = require_user(request)
    result = friends.list_friends(user["id"])
    for item in result:
        item["online"] = manager.is_online(item["id"])
    return result


@router.get("/requests")
async def list_requests_endpoint(request: Request) -> dict:
    user = require_user(request)
    return {
        "incoming": friends.list_incoming_requests(user["id"]),
        "outgoing": friends.list_outgoing_requests(user["id"]),
    }


@router.get("/me/code")
async def my_code_endpoint(request: Request) -> dict:
    user = require_user(request)
    return {"code": friend_codes.get_or_create(user["id"])}


@router.get("/lookup")
async def lookup_endpoint(
    request: Request, username: str | None = None, code: str | None = None
) -> dict:
    user = require_user(request)
    target = _lookup_target(username, code)
    if target is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "user": target,
        "relationship": friends.relationship(user["id"], target["id"]),
    }


@router.post("/requests", status_code=201)
async def send_request_endpoint(req: AddFriendRequest, request: Request) -> dict:
    user = require_user(request)
    target = _lookup_target(req.username, req.code)
    if target is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    try:
        result = friends.send_request(user["id"], target["id"])
    except friends.SelfAction:
        raise HTTPException(status_code=422, detail="不能添加自己为好友")
    except friends.AlreadyFriends:
        raise HTTPException(status_code=409, detail="你们已经是好友")
    except friends.RequestExists:
        raise HTTPException(status_code=409, detail="已发送过好友申请")

    if result["status"] == friends.STATUS_FRIENDS:
        await _notify_friends_became(user, target)
        return {"status": "friends", "friend": target}

    await manager.send(
        target["id"],
        {
            "type": "friend_request",
            "request": {
                "id": result["request_id"],
                "created_at": result["created_at"],
                "user": users.public_user(user),
            },
        },
    )
    return {"status": "pending"}


@router.post("/requests/{request_id}/accept")
async def accept_request_endpoint(request_id: int, request: Request) -> dict:
    user = require_user(request)
    requester_id = friends.accept_request(request_id, user["id"])
    if requester_id is None:
        raise HTTPException(status_code=404, detail="申请不存在")

    requester = users.get_user(requester_id)
    await manager.send(
        requester_id,
        {"type": "friend_accepted", "friend": users.public_user(user)},
    )
    await manager.send(
        user["id"],
        {"type": "friend_accepted", "friend": users.public_user(requester)},
    )
    return {"friend": users.public_user(requester)}


@router.delete("/requests/{request_id}")
async def delete_request_endpoint(request_id: int, request: Request) -> dict:
    user = require_user(request)
    participants = friends.delete_request(request_id, user["id"])
    if participants is None:
        raise HTTPException(status_code=404, detail="申请不存在")

    other_id = (
        participants["from_user_id"]
        if participants["to_user_id"] == user["id"]
        else participants["to_user_id"]
    )
    await manager.send(
        other_id, {"type": "friend_request_removed", "request_id": request_id}
    )
    return {"ok": True}


@router.delete("/messages")
async def clear_all_messages_endpoint(request: Request) -> dict:
    """清空我与所有好友的聊天记录（好友关系保留）。"""
    user = require_user(request)
    return {"deleted": direct_messages.clear_all(user["id"])}


@router.delete("/{friend_id}")
async def remove_friend_endpoint(friend_id: int, request: Request) -> dict:
    user = require_user(request)
    try:
        deleted = friends.remove_friendship(user["id"], friend_id)
    except friends.NotFriends:
        raise HTTPException(status_code=404, detail="还不是好友")
    await manager.send(friend_id, {"type": "friend_removed", "user_id": user["id"]})
    return {"ok": True, "deleted_messages": deleted}


@router.get("/{friend_id}/messages")
async def get_messages_endpoint(
    friend_id: int,
    request: Request,
    limit: int = direct_messages.HISTORY_DEFAULT_LIMIT,
    *,
    before: int | None = None,
) -> dict:
    user = require_user(request)
    _require_friendship(user["id"], friend_id)
    safe_limit = min(max(limit, 1), direct_messages.HISTORY_MAX_LIMIT)
    return direct_messages.get_history(
        user["id"], friend_id, before=before, limit=safe_limit
    )


@router.delete("/{friend_id}/messages")
async def clear_conversation_endpoint(friend_id: int, request: Request) -> dict:
    """清空与某位好友的聊天记录。"""
    user = require_user(request)
    _require_friendship(user["id"], friend_id)
    return {"deleted": direct_messages.clear_conversation(user["id"], friend_id)}


@router.post("/{friend_id}/messages", status_code=201)
async def send_message_endpoint(
    friend_id: int, req: MessageRequest, request: Request
) -> dict:
    user = require_user(request)
    _require_friendship(user["id"], friend_id)
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="消息不能为空")

    message = direct_messages.save_message(user["id"], friend_id, content)
    event = {"type": "message", "message": message}
    await manager.send(friend_id, event)
    await manager.send(user["id"], event)
    return {"message": message}


@router.post("/{friend_id}/read")
async def mark_read_endpoint(friend_id: int, request: Request) -> dict:
    user = require_user(request)
    _require_friendship(user["id"], friend_id)
    return {"read": direct_messages.mark_read(user["id"], friend_id)}
