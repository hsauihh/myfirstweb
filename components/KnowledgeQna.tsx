"use client";

// 知识库问答面板：rag 会话 + 「问答 / 上下文」模式 + 「使用系统知识库」开关。
// 两个选项都是每条消息的参数，随消息发送。
import { useEffect, useRef, useState } from "react";
import ChatComposer from "./ChatComposer";
import ChatMessages from "./ChatMessages";
import ChatToolbar from "./ChatToolbar";
import useChat from "./useChat";
import { useAuth } from "./AuthContext";
import type { RagMode, RagStatus } from "./types";

const MODES: { id: RagMode; label: string }[] = [
  { id: "qa", label: "问答" },
  { id: "context", label: "上下文" },
];

interface KnowledgeQnaProps {
  status: RagStatus | null;
  onManageSources: () => void;
}

export default function KnowledgeQna({ status, onManageSources }: KnowledgeQnaProps) {
  const auth = useAuth();
  const chat = useChat({ kind: "rag", onQuota: auth.applyQuota });
  const listRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<RagMode>("qa");
  const [includeSystem, setIncludeSystem] = useState(true);
  const blocked =
    !auth.loading && !auth.user?.vip && (auth.ragQuota?.remaining ?? 0) <= 0;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chat.messages, chat.streamingText]);

  async function handleRemove() {
    if (chat.activeId === null) return;
    if (!window.confirm("确定删除这个会话吗？此操作不可恢复。")) return;
    await chat.removeConversation(chat.activeId);
  }

  function send(text: string) {
    return chat.send(text, { mode, includeSystem });
  }

  function placeholder() {
    if (blocked) return "今日知识库次数已用完，开通 VIP 继续";
    const scope = includeSystem ? "个人 + 站内" : "个人";
    return `基于${scope}知识库提问…（Enter 发送，Shift+Enter 换行）`;
  }

  const counts = status
    ? `个人 ${status.personal} + 站内 ${status.public} 个片段`
    : "知识库状态加载中…";

  const controls = (
    <div className="rag-controls">
      <div className="rag-mode" role="group" aria-label="问答模式">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={"rag-mode__btn" + (mode === item.id ? " is-active" : "")}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="rag-toggle">
        <button
          type="button"
          role="switch"
          aria-checked={includeSystem}
          aria-label="使用系统知识库"
          className={"switch switch--sm" + (includeSystem ? " is-on" : "")}
          onClick={() => setIncludeSystem((value) => !value)}
        >
          <span className="switch-knob" />
        </button>
        <span className="rag-toggle-label">使用系统知识库</span>
      </div>
    </div>
  );

  return (
    <article className="panel panel-full chat-panel card">
      <ChatToolbar
        kicker="知识库问答"
        title="基于知识库回答"
        conversations={chat.conversations}
        activeId={chat.activeId}
        sending={chat.sending}
        onSelect={chat.selectConversation}
        onCreate={chat.newConversation}
        onRemove={handleRemove}
      />
      <p className="chat-quota">
        {counts}
        {" · "}
        <button type="button" className="link-button" onClick={onManageSources}>
          管理来源
        </button>
      </p>
      <ChatMessages
        messages={chat.messages}
        streamingText={chat.streamingText}
        listRef={listRef}
        selfName={auth.user?.username}
      />
      {chat.error && <p className="lab-error chat-error">{chat.error}</p>}
      <ChatComposer
        sending={chat.sending}
        disabled={blocked}
        placeholder={placeholder()}
        controls={controls}
        user={auth.user}
        quota={auth.ragQuota}
        useRag
        onSend={send}
        onStop={chat.stop}
      />
    </article>
  );
}
