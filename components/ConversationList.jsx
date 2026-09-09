"use client";

// 会话列表：微信式条目（头像 + 用户名 + 最后消息 + 时间 + 未读）。
import Avatar from "./Avatar.jsx";

function formatTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function preview(friend, selfId) {
  if (!friend.last_message) return "还没有消息";
  const prefix = friend.last_message_sender_id === selfId ? "我：" : "";
  return prefix + friend.last_message;
}

export default function ConversationList({ friends, activeId, selfId, onSelect }) {
  return (
    <div className="conversation-pane">
      {friends.length === 0 ? (
        <p className="messages-empty">还没有好友，点右上角头像添加。</p>
      ) : (
        <ul className="conversation-list">
          {friends.map((friend) => (
            <li key={friend.id}>
              <button
                type="button"
                className={
                  "conversation-item" + (friend.id === activeId ? " is-active" : "")
                }
                onClick={() => onSelect(friend.id)}
              >
                <Avatar name={friend.username} size={40} />
                <span className="conversation-body">
                  <span className="conversation-top">
                    <span className="conversation-name">{friend.username}</span>
                    <span className="conversation-time">
                      {formatTime(friend.last_message_at)}
                    </span>
                  </span>
                  <span className="conversation-preview">
                    {preview(friend, selfId)}
                  </span>
                </span>
                {friend.unread > 0 && (
                  <span className="conversation-badge">{friend.unread}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
