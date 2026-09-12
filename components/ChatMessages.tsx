"use client";

// 消息列表：历史消息 + 正在流式生成的回复。
// 空的时候渲染 empty（各页面自己给建议问题），有消息后只显示消息。
import type { RefObject, ReactNode } from "react";
import ChatMessage from "./ChatMessage";
import type { ChatMessage as ChatMessageData } from "./types";

interface ChatMessagesProps {
  messages: ChatMessageData[];
  streamingText: string;
  listRef: RefObject<HTMLDivElement | null>;
  /** 没有消息时显示的内容（欢迎语 + 建议问题 chips）。 */
  empty?: ReactNode;
  /** 传给最后一条助手消息：重新生成（撤销旧回复并按原问题重跑）。 */
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export default function ChatMessages({
  messages,
  streamingText,
  listRef,
  empty,
  onRegenerate,
  regenerating,
}: ChatMessagesProps) {
  const isEmpty = messages.length === 0 && !streamingText;
  const lastIndex = messages.length - 1;

  return (
    <div className="ds-messages" ref={listRef}>
      {isEmpty && <div className="ds-empty">{empty}</div>}
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id}
          role={message.role}
          content={message.content}
          sources={message.sources}
          onRegenerate={
            onRegenerate && message.role === "assistant" && index === lastIndex
              ? onRegenerate
              : undefined
          }
          regenerating={regenerating}
        />
      ))}
      {streamingText && <ChatMessage role="assistant" content={streamingText} streaming />}
    </div>
  );
}
