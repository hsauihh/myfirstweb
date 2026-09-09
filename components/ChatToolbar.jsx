"use client";

// 会话操作栏：切换会话、新建、删除。
export default function ChatToolbar({
  conversations,
  activeId,
  sending,
  onSelect,
  onCreate,
  onRemove,
}) {
  return (
    <div className="panel-heading chat-heading">
      <div>
        <p className="section-kicker">AI 对话</p>
        <h3>和助手聊聊</h3>
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
