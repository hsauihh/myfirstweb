"use client";

// 会话操作栏：切换会话、新建、删除。
import type { ChatToolbarConversation } from "./types";

interface ChatToolbarProps {
  kicker?: string;
  title?: string;
  conversations: ChatToolbarConversation[];
  activeId: number | null;
  sending: boolean;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onRemove: () => void;
}

export default function ChatToolbar({
  kicker = "AI 对话",
  title = "和助手聊聊",
  conversations,
  activeId,
  sending,
  onSelect,
  onCreate,
  onRemove,
}: ChatToolbarProps) {
  return (
    <div className="panel-heading chat-heading">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>
      <div className="chat-actions">
        <select
          className="chat-select"
          value={activeId ?? ""}
          disabled={sending}
          onChange={(e) => onSelect(Number(e.target.value))}
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
          onClick={onRemove}
        >
          删除
        </button>
      </div>
    </div>
  );
}
