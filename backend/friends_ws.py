"""好友 WebSocket：连接管理、实时推送、在线状态。

在线状态为单进程内存态，重启即清空。
"""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import auth
import friends
import users

CLOSE_UNAUTHORIZED = 4401

router = APIRouter()


class ConnectionManager:
    """维护 user_id → 该用户所有连接，负责点对点推送与好友广播。"""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}

    def is_online(self, user_id: int) -> bool:
        return bool(self._connections.get(user_id))

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> bool:
        """移除连接；返回该用户是否已完全离线。"""
        sockets = self._connections.get(user_id)
        if sockets is None:
            return False
        sockets.discard(websocket)
        if sockets:
            return False
        self._connections.pop(user_id, None)
        return True

    async def send(self, user_id: int, event: dict) -> None:
        """推给某个用户的所有连接；发送失败的连接直接剔除。"""
        for websocket in list(self._connections.get(user_id, set())):
            try:
                await websocket.send_json(event)
            except Exception:
                self.disconnect(user_id, websocket)

    async def broadcast_to_friends(self, user_id: int, event: dict) -> None:
        for friend_id in friends.friend_ids(user_id):
            await self.send(friend_id, event)

    async def broadcast_all(self, event: dict) -> None:
        """推给所有在线用户（公告用）。"""
        for user_id in list(self._connections):
            await self.send(user_id, event)


manager = ConnectionManager()


def _authenticate(websocket: WebSocket) -> dict | None:
    token = websocket.cookies.get(auth.AUTH_COOKIE)
    if not token:
        return None
    session = users.get_auth_session(token)
    if session is None:
        return None
    return users.get_user(session["user_id"])


async def _handle_client_event(websocket: WebSocket, raw: str) -> None:
    try:
        event = json.loads(raw)
    except ValueError:
        return
    if event.get("type") == "ping":
        await websocket.send_json({"type": "pong"})


@router.websocket("/ws/friends")
async def friends_socket(websocket: WebSocket) -> None:
    user = _authenticate(websocket)
    if user is None:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return

    user_id = user["id"]
    await manager.connect(user_id, websocket)
    await manager.broadcast_to_friends(
        user_id, {"type": "presence", "user_id": user_id, "online": True}
    )
    await websocket.send_json({"type": "ready", "user": users.public_user(user)})

    try:
        while True:
            await _handle_client_event(websocket, await websocket.receive_text())
    except WebSocketDisconnect:
        pass
    finally:
        if manager.disconnect(user_id, websocket):
            await manager.broadcast_to_friends(
                user_id, {"type": "presence", "user_id": user_id, "online": False}
            )
