// 单条聊天消息气泡；助手消息渲染 Markdown，用户消息保持纯文本。
// streaming 为 true 时在末尾显示光标。
import Markdown from "./Markdown.jsx";

export default function ChatMessage({ role, content, streaming = false, selfName }) {
  const isUser = role === "user";
  const label = isUser ? selfName || "我" : "助手";
  return (
    <div className={"chat-message" + (isUser ? " is-user" : " is-assistant")}>
      <span className="chat-role">{label}</span>
      {isUser ? (
        <p className="chat-bubble">
          {content}
          {streaming && <span className="chat-cursor" aria-hidden="true" />}
        </p>
      ) : (
        <div className="chat-bubble chat-bubble--markdown">
          <Markdown content={content} />
          {streaming && <span className="chat-cursor" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
