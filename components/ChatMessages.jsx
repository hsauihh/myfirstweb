// 消息列表：历史消息 + 正在流式生成的回复。
import ChatMessage from "./ChatMessage";

export default function ChatMessages({ messages, streamingText, listRef, selfName }) {
  const isEmpty = messages.length === 0 && !streamingText;
  return (
    <div className="chat-messages" ref={listRef}>
      {isEmpty && <p className="chat-empty">还没有消息，说点什么吧。</p>}
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          role={message.role}
          content={message.content}
          sources={message.sources}
          selfName={selfName}
        />
      ))}
      {streamingText && (
        <ChatMessage role="assistant" content={streamingText} streaming selfName={selfName} />
      )}
    </div>
  );
}
