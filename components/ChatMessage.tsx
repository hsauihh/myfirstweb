"use client";

// 单条聊天消息（DeepSeek 版式）：
// - 用户消息：右对齐气泡（沿用站点气泡 token）；
// - 助手消息：无气泡，直接渲染 Markdown，下面是参考来源与操作条（复制 / 重新生成）。
// streaming 为 true 时末尾显示光标（此时还没有结构化来源，卡片在流结束后出现）。
import { useEffect, useRef, useState } from "react";
import ChatSources from "./ChatSources";
import Markdown from "./Markdown";
import SourceSnippetModal from "./SourceSnippetModal";
import type { Citation, ChatMessage as ChatMessageData } from "./types";

const COPIED_RESET_MS = 1600;

interface ChatMessageProps {
  role: ChatMessageData["role"];
  content: string;
  streaming?: boolean;
  sources?: Citation[] | null;
  /** 只有最后一条助手消息给 onRegenerate（历史消息只提供复制）。 */
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export default function ChatMessage({
  role,
  content,
  streaming = false,
  sources,
  onRegenerate,
  regenerating = false,
}: ChatMessageProps) {
  const [activeSource, setActiveSource] = useState<Citation | null>(null);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const isUser = role === "user";

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function openCitation(index: number) {
    const found = (sources || []).find((item) => item.index === index);
    if (found) setActiveSource(found);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      setCopied(false);
    }
  }

  if (isUser) {
    return (
      <div className="ds-msg ds-msg--user">
        <p className="ds-bubble">
          {content}
          {streaming && <span className="chat-cursor" aria-hidden="true" />}
        </p>
      </div>
    );
  }

  return (
    <div className="ds-msg ds-msg--assistant">
      <div className="ds-answer">
        <Markdown content={content} sources={sources} onCitation={openCitation} />
        {streaming && <span className="chat-cursor" aria-hidden="true" />}
      </div>
      {!streaming && <ChatSources sources={sources} onOpen={setActiveSource} />}
      {!streaming && (
        <div className="ds-actions">
          <button
            type="button"
            className="ds-action"
            onClick={copy}
            aria-label="复制这条回复"
          >
            {copied ? "已复制" : "复制"}
          </button>
          {onRegenerate && (
            <button
              type="button"
              className="ds-action"
              disabled={regenerating}
              onClick={onRegenerate}
            >
              重新生成
            </button>
          )}
        </div>
      )}
      <SourceSnippetModal
        source={activeSource}
        onClose={() => setActiveSource(null)}
      />
    </div>
  );
}
