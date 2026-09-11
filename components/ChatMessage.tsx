"use client";

// 单条聊天消息气泡；助手消息渲染 Markdown 与参考来源，用户消息保持纯文本。
// streaming 为 true 时在末尾显示光标（此时还没有结构化来源，卡片在流结束后出现）。
import { useState } from "react";
import ChatSources from "./ChatSources";
import Markdown from "./Markdown";
import SourceSnippetModal from "./SourceSnippetModal";
import type { Citation, ChatMessage as ChatMessageData } from "./types";

interface ChatMessageProps {
  role: ChatMessageData["role"];
  content: string;
  streaming?: boolean;
  selfName?: string;
  sources?: Citation[] | null;
}

export default function ChatMessage({
  role,
  content,
  streaming = false,
  selfName,
  sources,
}: ChatMessageProps) {
  const [activeSource, setActiveSource] = useState<Citation | null>(null);
  const isUser = role === "user";
  const label = isUser ? selfName || "我" : "助手";

  function openCitation(index: number) {
    const found = (sources || []).find((item) => item.index === index);
    if (found) setActiveSource(found);
  }

  return (
    <div className={"chat-message" + (isUser ? " is-user" : " is-assistant")}>
      <span className="chat-role">{label}</span>
      {isUser ? (
        <p className="chat-bubble">
          {content}
          {streaming && <span className="chat-cursor" aria-hidden="true" />}
        </p>
      ) : (
        <>
          <div className="chat-bubble chat-bubble--markdown">
            <Markdown content={content} sources={sources} onCitation={openCitation} />
            {streaming && <span className="chat-cursor" aria-hidden="true" />}
          </div>
          {!streaming && <ChatSources sources={sources} onOpen={setActiveSource} />}
        </>
      )}
      <SourceSnippetModal
        source={activeSource}
        onClose={() => setActiveSource(null)}
      />
    </div>
  );
}
