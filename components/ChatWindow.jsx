"use client";

// 微信式聊天窗口：对方消息左侧、自己消息右侧，底部输入区带表情。
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import EmojiPicker from "./EmojiPicker.jsx";

const MAX_LENGTH = 2000;

export default function ChatWindow({
  friend,
  selfId,
  selfName,
  selfAvatar,
  messages,
  hasMore,
  sending,
  onSend,
  onLoadOlder,
  onRemove,
}) {
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const lastIdRef = useRef(null);

  // 只有出现新消息时才滚到底部；加载更早的消息不打断阅读位置
  useEffect(() => {
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    if (lastId === lastIdRef.current) return;
    lastIdRef.current = lastId;
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  if (!friend) {
    return (
      <div className="chat-window chat-window--empty">
        点左侧会话列表，选一位好友开始聊天
      </div>
    );
  }

  function submit(event) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    onSend(text);
    setText("");
  }

  async function remove() {
    const confirmed = window.confirm(
      `确定删除好友 ${friend.username} 吗？聊天记录会一并删除。`
    );
    if (confirmed) await onRemove(friend.id);
  }

  return (
    <div className="chat-window">
      <header className="chat-window-heading">
        <span className="chat-window-name">{friend.username}</span>
        <span className={"friend-dot" + (friend.online ? " is-online" : "")} />
        <button type="button" className="ghost-button danger" onClick={remove}>
          删除好友
        </button>
      </header>

      <div className="chat-window-messages" ref={listRef}>
        {hasMore && (
          <button
            type="button"
            className="ghost-button chat-load-more"
            onClick={onLoadOlder}
          >
            加载更早消息
          </button>
        )}
        {messages.length === 0 && (
          <p className="messages-empty">还没有消息，打个招呼吧。</p>
        )}
        {messages.map((message, index) => {
          const mine = message.sender_id === selfId;
          const prev = messages[index - 1];
          const showName = !prev || prev.sender_id !== message.sender_id;
          const name = mine ? selfName : friend.username;
          return (
            <div key={message.id} className={"chat-row" + (mine ? " is-mine" : "")}>
              <Avatar
                name={mine ? selfName : friend.username}
                src={mine ? selfAvatar : friend.avatar}
                size={36}
              />
              <div className="chat-row-body">
                {showName && <span className="chat-name">{name}</span>}
                <p className="chat-bubble">{message.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form className="chat-window-input" onSubmit={submit}>
        <div className="chat-window-tools">
          <EmojiPicker onPick={(emoji) => setText((prev) => prev + emoji)} />
          <span className="lab-count">
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
        <textarea
          rows="3"
          maxLength={MAX_LENGTH}
          placeholder="输入消息…（Enter 发送，Shift+Enter 换行）"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(event);
            }
          }}
        />
        <div className="chat-window-actions">
          <button className="primary-button" type="submit" disabled={sending}>
            发送
          </button>
        </div>
      </form>
    </div>
  );
}
