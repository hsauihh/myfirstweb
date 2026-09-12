"use client";

// 知识库问答面板（DeepSeek 版式）：左栏会话列表 + 消息区 + 圆角输入区。
// 输入框底行是知识库专有的控件：「问答 / 上下文」模式、「使用系统知识库」开关、「记一笔」。
// 两个选项都是每条消息的参数，随消息发送。
import { useEffect, useRef, useState } from "react";
import ChatComposer from "./ChatComposer";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatSidebar from "./ChatSidebar";
import ChatSuggestions from "./ChatSuggestions";
import NoteCaptureModal from "./NoteCaptureModal";
import useChat from "./useChat";
import { useAuth } from "./AuthContext";
import type { PromptChip } from "../data/site";
import type { RagMode, RagStatus } from "./types";

const MODES: { id: RagMode; label: string }[] = [
  { id: "qa", label: "问答" },
  { id: "context", label: "上下文" },
];

// 空对话时的建议问题：覆盖「我记了什么」「库里有什么」两类常见诉求
const SUGGESTIONS: PromptChip[] = [
  { label: "我的笔记记了什么", prompt: "我的知识库里都记了些什么？" },
  { label: "总结知识库要点", prompt: "用三点总结知识库里的要点。" },
  { label: "帮我归类笔记", prompt: "把知识库里的内容按主题归类，并说明每一类的用途。" },
];

interface KnowledgeQnaProps {
  status: RagStatus | null;
  /** 图谱页点「用这个概念提问」时预填的问题；nonce 变化才算新的一次。 */
  prefill?: { text: string; nonce: number } | null;
  onManageSources: () => void;
  /** 笔记增删后通知外层面板同步（列表与计数）。 */
  onNotesChanged?: () => void;
}

export default function KnowledgeQna({
  status,
  prefill,
  onManageSources,
  onNotesChanged,
}: KnowledgeQnaProps) {
  const auth = useAuth();
  const chat = useChat({ kind: "rag", onQuota: auth.applyQuota });
  const listRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<RagMode>("qa");
  const [includeSystem, setIncludeSystem] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [picked, setPicked] = useState<{ text: string; nonce: number } | null>(
    null
  );
  const blocked =
    !auth.loading && !auth.user?.vip && (auth.ragQuota?.remaining ?? 0) <= 0;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chat.messages, chat.streamingText]);

  function handleRemove(id: number) {
    if (!window.confirm("确定删除这个会话吗？此操作不可恢复。")) return;
    void chat.removeConversation(id);
  }

  function send(text: string) {
    return chat.send(text, { mode, includeSystem });
  }

  function placeholder() {
    if (blocked) return "今日知识库次数已用完，开通 VIP 继续";
    const scope = includeSystem ? "个人 + 站内" : "个人";
    return `基于${scope}知识库提问…`;
  }

  const counts = status
    ? `个人 ${status.personal} + 站内 ${status.public} 个片段`
    : "知识库状态加载中…";

  // 来自图谱的预填与本地 chips 的预填取更新的那次
  const activePrefill =
    prefill && picked
      ? prefill.nonce > picked.nonce
        ? prefill
        : picked
      : (prefill ?? picked);

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
      <button
        type="button"
        className="rag-quicknote"
        onClick={() => setNoteOpen(true)}
      >
        ✎ 记一笔
      </button>
    </div>
  );

  return (
    <article className="panel panel-full chat-panel card">
      <div className="chat-shell">
        <ChatSidebar
          conversations={chat.conversations}
          activeId={chat.activeId}
          sending={chat.sending}
          onSelect={chat.selectConversation}
          onCreate={chat.newConversation}
          onRemove={handleRemove}
        />
        <div className="chat-main">
          <ChatHeader
            kicker="知识库问答"
            title="基于知识库回答"
            conversations={chat.conversations}
            activeId={chat.activeId}
            sending={chat.sending}
            onSelect={chat.selectConversation}
            onCreate={chat.newConversation}
            onRemove={handleRemove}
          >
            <p className="chat-quota">
              {counts}
              {" · "}
              <button type="button" className="link-button" onClick={onManageSources}>
                管理来源
              </button>
            </p>
          </ChatHeader>
          <ChatMessages
            messages={chat.messages}
            streamingText={chat.streamingText}
            listRef={listRef}
            onRegenerate={() => void chat.regenerate({ mode, includeSystem })}
            regenerating={chat.sending}
            empty={
              <>
                <p className="ds-empty__title">基于你的知识库提问</p>
                <p className="ds-empty__hint">
                  范围：个人知识库（含随心一记）+ 站内公共资料
                </p>
                <ChatSuggestions
                  items={SUGGESTIONS}
                  disabled={blocked}
                  onPick={(prompt) => setPicked({ text: prompt, nonce: Date.now() })}
                />
              </>
            }
          />
          {chat.error && (
            <p className="lab-error chat-error">
              {chat.error}
              {chat.activeId !== null && (
                <button
                  type="button"
                  className="link-button chat-error__retry"
                  onClick={() =>
                    void chat.regenerate({ mode, includeSystem })
                  }
                >
                  重试
                </button>
              )}
            </p>
          )}
          <ChatComposer
            sending={chat.sending}
            disabled={blocked}
            placeholder={placeholder()}
            controls={controls}
            prefill={activePrefill}
            user={auth.user}
            quota={auth.ragQuota}
            useRag
            onSend={send}
            onStop={chat.stop}
          />
        </div>
      </div>
      <NoteCaptureModal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSaved={onNotesChanged}
      />
    </article>
  );
}
