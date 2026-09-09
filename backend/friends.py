"""好友关系存储层：申请、好友列表。"""
import sqlite3

import db

STATUS_PENDING = "pending"
STATUS_FRIENDS = "friends"

RELATION_SELF = "self"
RELATION_FRIENDS = "friends"
RELATION_SENT = "request_sent"
RELATION_RECEIVED = "request_received"
RELATION_NONE = "none"


class FriendError(Exception):
    """好友操作的业务错误基类。"""


class SelfAction(FriendError):
    """不能对自己执行该操作。"""


class AlreadyFriends(FriendError):
    """已经是好友。"""


class RequestExists(FriendError):
    """申请已存在。"""


class NotFriends(FriendError):
    """还不是好友。"""


def _pair(user_a: int, user_b: int) -> tuple[int, int]:
    return (user_a, user_b) if user_a < user_b else (user_b, user_a)


def are_friends(user_a: int, user_b: int) -> bool:
    low, high = _pair(user_a, user_b)
    conn = db.get_conn()
    row = conn.execute(
        "SELECT 1 FROM friendships WHERE user_a_id = ? AND user_b_id = ?",
        [low, high],
    ).fetchone()
    conn.close()
    return row is not None


def relationship(viewer_id: int, other_id: int) -> str:
    """返回 viewer 对 other 的关系：self / friends / request_sent / request_received / none。"""
    if viewer_id == other_id:
        return RELATION_SELF
    if are_friends(viewer_id, other_id):
        return RELATION_FRIENDS

    conn = db.get_conn()
    sent = conn.execute(
        "SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
        [viewer_id, other_id],
    ).fetchone()
    received = conn.execute(
        "SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
        [other_id, viewer_id],
    ).fetchone()
    conn.close()
    if sent:
        return RELATION_SENT
    if received:
        return RELATION_RECEIVED
    return RELATION_NONE


def _insert_friendship(conn: sqlite3.Connection, user_a: int, user_b: int) -> None:
    low, high = _pair(user_a, user_b)
    conn.execute(
        "INSERT OR IGNORE INTO friendships (user_a_id, user_b_id, created_at)"
        " VALUES (?, ?, ?)",
        [low, high, db.now_iso()],
    )


def send_request(from_user_id: int, to_user_id: int) -> dict:
    """发好友申请；若对方已申请过我则直接成为好友。"""
    if from_user_id == to_user_id:
        raise SelfAction()
    if are_friends(from_user_id, to_user_id):
        raise AlreadyFriends()

    conn = db.get_conn()
    try:
        reverse = conn.execute(
            "SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
            [to_user_id, from_user_id],
        ).fetchone()
        if reverse is not None:
            conn.execute("DELETE FROM friend_requests WHERE id = ?", [reverse["id"]])
            _insert_friendship(conn, from_user_id, to_user_id)
            conn.commit()
            return {"status": STATUS_FRIENDS}

        existing = conn.execute(
            "SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?",
            [from_user_id, to_user_id],
        ).fetchone()
        if existing is not None:
            raise RequestExists()

        now = db.now_iso()
        cur = conn.execute(
            "INSERT INTO friend_requests (from_user_id, to_user_id, created_at)"
            " VALUES (?, ?, ?)",
            [from_user_id, to_user_id, now],
        )
        conn.commit()
        return {
            "status": STATUS_PENDING,
            "request_id": cur.lastrowid,
            "created_at": now,
        }
    finally:
        conn.close()


def _request(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "user": {
            "id": row["user_id"],
            "username": row["username"],
            "avatar": row["avatar"],
            "created_at": row["user_created_at"],
        },
    }


def _list_requests(user_id: int, *, incoming: bool) -> list[dict]:
    owner_column = "to_user_id" if incoming else "from_user_id"
    user_column = "from_user_id" if incoming else "to_user_id"
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT r.id, r.created_at, u.id AS user_id, u.username, u.avatar,"
        " u.created_at AS user_created_at"
        f" FROM friend_requests r JOIN users u ON u.id = r.{user_column}"
        f" WHERE r.{owner_column} = ? ORDER BY r.id DESC",
        [user_id],
    ).fetchall()
    conn.close()
    return [_request(row) for row in rows]


def list_incoming_requests(user_id: int) -> list[dict]:
    return _list_requests(user_id, incoming=True)


def list_outgoing_requests(user_id: int) -> list[dict]:
    return _list_requests(user_id, incoming=False)


def accept_request(request_id: int, user_id: int) -> int | None:
    """接受发给 user_id 的申请，返回申请发起者 id；不存在或无权时返回 None。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM friend_requests WHERE id = ?", [request_id]
    ).fetchone()
    if row is None or row["to_user_id"] != user_id:
        conn.close()
        return None
    _insert_friendship(conn, row["from_user_id"], row["to_user_id"])
    conn.execute("DELETE FROM friend_requests WHERE id = ?", [request_id])
    conn.commit()
    conn.close()
    return row["from_user_id"]


def delete_request(request_id: int, user_id: int) -> dict | None:
    """拒绝（接收方）或撤回（发送方）申请；返回双方 id，失败返回 None。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM friend_requests WHERE id = ?", [request_id]
    ).fetchone()
    if row is None or user_id not in (row["from_user_id"], row["to_user_id"]):
        conn.close()
        return None
    conn.execute("DELETE FROM friend_requests WHERE id = ?", [request_id])
    conn.commit()
    conn.close()
    return {"from_user_id": row["from_user_id"], "to_user_id": row["to_user_id"]}


def remove_friendship(user_a: int, user_b: int) -> int:
    """删除好友关系并清空双方消息，返回删除的消息条数。"""
    low, high = _pair(user_a, user_b)
    conn = db.get_conn()
    row = conn.execute(
        "SELECT id FROM friendships WHERE user_a_id = ? AND user_b_id = ?",
        [low, high],
    ).fetchone()
    if row is None:
        conn.close()
        raise NotFriends()
    cur = conn.execute(
        "DELETE FROM direct_messages WHERE"
        " (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
        [user_a, user_b, user_b, user_a],
    )
    deleted = cur.rowcount
    conn.execute("DELETE FROM friendships WHERE id = ?", [row["id"]])
    conn.commit()
    conn.close()
    return deleted


def friend_ids(user_id: int) -> list[int]:
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT user_a_id, user_b_id FROM friendships"
        " WHERE user_a_id = ? OR user_b_id = ?",
        [user_id, user_id],
    ).fetchall()
    conn.close()
    return [
        row["user_b_id"] if row["user_a_id"] == user_id else row["user_a_id"]
        for row in rows
    ]


def list_friends(user_id: int) -> list[dict]:
    """好友列表，带未读数、最后消息时间与内容；有消息的排前面，再按时间倒序。"""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT u.id, u.username, u.avatar,"
        " (SELECT COUNT(*) FROM direct_messages m"
        "   WHERE m.recipient_id = ? AND m.sender_id = u.id AND m.read_at IS NULL)"
        "   AS unread,"
        " (SELECT MAX(m.created_at) FROM direct_messages m"
        "   WHERE (m.sender_id = ? AND m.recipient_id = u.id)"
        "      OR (m.sender_id = u.id AND m.recipient_id = ?))"
        "   AS last_message_at,"
        " (SELECT m.content FROM direct_messages m"
        "   WHERE (m.sender_id = ? AND m.recipient_id = u.id)"
        "      OR (m.sender_id = u.id AND m.recipient_id = ?)"
        "   ORDER BY m.id DESC LIMIT 1) AS last_message,"
        " (SELECT m.sender_id FROM direct_messages m"
        "   WHERE (m.sender_id = ? AND m.recipient_id = u.id)"
        "      OR (m.sender_id = u.id AND m.recipient_id = ?)"
        "   ORDER BY m.id DESC LIMIT 1) AS last_message_sender_id"
        " FROM friendships f"
        " JOIN users u ON u.id = CASE WHEN f.user_a_id = ? THEN f.user_b_id"
        "                             ELSE f.user_a_id END"
        " WHERE f.user_a_id = ? OR f.user_b_id = ?"
        " ORDER BY (last_message_at IS NULL), last_message_at DESC, u.username",
        [user_id] * 10,
    ).fetchall()
    conn.close()
    return [
        {
            "id": row["id"],
            "username": row["username"],
            "avatar": row["avatar"],
            "unread": row["unread"],
            "last_message_at": row["last_message_at"],
            "last_message": row["last_message"],
            "last_message_sender_id": row["last_message_sender_id"],
        }
        for row in rows
    ]
