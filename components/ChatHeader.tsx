"use client";

// 对话面板头部：标题 + 右侧补充信息（children）。
// 宽屏的会话切换在左栏（ChatSidebar）；窄屏左栏被隐藏，所以这里额外放一套
// 下拉 + 新对话/删除，由 CSS 控制只在窄屏出现。
import type { ReactNode } from "react";
import type { Conversation } from "./types";

interface ChatHeaderProps {
  kicker: string;
  title: string;
  conversations: Conversation[];
  activeId: number | null;
  sending: boolean;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onRemove: (id: number) => void;
  children?: ReactNode;
}

export default function ChatHeader({
  kicker,
  title,
  conversations,
  activeId,
  sending,
  onSelect,
  onCreate,
  onRemove,
  children,
}: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <div className="chat-header__main">
        <p className="section-kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>
      <div className="chat-header__aside">
        {children}
        <div className="chat-header__narrow">
          <select
            className="chat-select"
            value={activeId ?? ""}
            disabled={sending}
            onChange={(event) => onSelect(Number(event.target.value))}
            aria-label="选择会话"
          >
            {conversations.length === 0 && <option value="">暂无会话</option>}
            {conversations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-button"
            disabled={sending}
            onClick={onCreate}
          >
            新对话
          </button>
          <button
            type="button"
            className="ghost-button danger"
            disabled={sending || activeId === null}
            onClick={() => activeId !== null && onRemove(activeId)}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
