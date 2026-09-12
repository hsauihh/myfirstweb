"use client";

// 会话左栏（DeepSeek 版式）：顶部「新对话」，下面是会话条目（悬停显示删除）。
// 窄屏由 CSS 隐藏左栏，改用 ChatHeader 里的下拉，见 css/chat-ds.css。
import type { Conversation } from "./types";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  sending: boolean;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onRemove: (id: number) => void;
}

export default function ChatSidebar({
  conversations,
  activeId,
  sending,
  onSelect,
  onCreate,
  onRemove,
}: ChatSidebarProps) {
  return (
    <aside className="chat-sidebar" aria-label="会话列表">
      <button
        type="button"
        className="chat-sidebar__new"
        disabled={sending}
        onClick={onCreate}
      >
        <span aria-hidden="true">＋</span> 新对话
      </button>
      {conversations.length === 0 ? (
        <p className="chat-sidebar__empty">还没有会话</p>
      ) : (
        <ul className="chat-sidebar__list">
          {conversations.map((item) => (
            <li
              key={item.id}
              className={
                "chat-sidebar__row" + (item.id === activeId ? " is-active" : "")
              }
            >
              <button
                type="button"
                className="chat-sidebar__item"
                disabled={sending}
                title={item.title}
                onClick={() => onSelect(item.id)}
              >
                <span className="chat-sidebar__title">{item.title}</span>
                <span className="chat-sidebar__time">
                  {formatTime(item.updated_at)}
                </span>
              </button>
              <button
                type="button"
                className="chat-sidebar__remove"
                aria-label={`删除会话：${item.title}`}
                disabled={sending}
                onClick={() => onRemove(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
