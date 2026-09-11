"use client";

// 单条聊天消息气泡；助手消息渲染 Markdown 与参考来源，用户消息保持纯文本。
// streaming 为 true 时在末尾显示光标（此时还没有结构化来源，卡片在流结束后出现）。
import { useState } from "react";
import ChatSources from "./ChatSources.jsx";
import Markdown from "./Markdown.jsx";
import SourceSnippetModal from "./SourceSnippetModal.jsx";

export default function ChatMessage({
  role,
  content,
  streaming = false,
  selfName,
  sources,
}) {
  const [activeSource, setActiveSource] = useState(null);
  const isUser = role === "user";
  const label = isUser ? selfName || "我" : "助手";

  function openCitation(index) {
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
