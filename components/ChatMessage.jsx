// 单条聊天消息气泡；streaming 为 true 时在末尾显示光标。
export default function ChatMessage({ role, content, streaming = false }) {
  const isUser = role === "user";
  return (
    <div className={"chat-message" + (isUser ? " is-user" : " is-assistant")}>
      <span className="chat-role">{isUser ? "我" : "助手"}</span>
      <p className="chat-bubble">
        {content}
        {streaming && <span className="chat-cursor" aria-hidden="true" />}
      </p>
    </div>
  );
}
