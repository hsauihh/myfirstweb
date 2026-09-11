// 消息列表：历史消息 + 正在流式生成的回复。
import ChatMessage from "./ChatMessage";
import type { ChatMessage as ChatMessageData } from "./types";
import type { RefObject } from "react";

interface ChatMessagesProps {
  messages: ChatMessageData[];
  streamingText: string;
  listRef: RefObject<HTMLDivElement | null>;
  selfName?: string;
}

export default function ChatMessages({
  messages,
  streamingText,
  listRef,
  selfName,
}: ChatMessagesProps) {
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
