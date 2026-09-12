"use client";

// 普通 AI 对话面板：左栏会话列表 + 消息区 + 输入区（空对话时给文字实验室的常用提示词）。
// 知识库问答已移到 /knowledge，这里不涉及知识库。
import { useEffect, useRef, useState } from "react";
import ChatComposer from "./ChatComposer";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatSidebar from "./ChatSidebar";
import ChatSuggestions from "./ChatSuggestions";
import useChat from "./useChat";
import { useAuth } from "./AuthContext";
import { textLabPrompts } from "../data/site";

export default function ChatPanel() {
  const auth = useAuth();
  const chat = useChat({ kind: "chat", onQuota: auth.applyQuota });
  const listRef = useRef<HTMLDivElement | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(
    null
  );
  const blocked =
    !auth.loading && !auth.user?.vip && (auth.quota?.remaining ?? 0) <= 0;

  // 新消息或流式增量出现时滚到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chat.messages, chat.streamingText]);

  function handleRemove(id: number) {
    if (!window.confirm("确定删除这个会话吗？此操作不可恢复。")) return;
    void chat.removeConversation(id);
  }

  function placeholder() {
    if (blocked) {
      return auth.user
        ? "今日免费次数已用完，开通 VIP 继续"
        : "额度已用完，登录后继续";
    }
    return "说点什么…";
  }

  function pickPrompt(prompt: string) {
    setPrefill({ text: prompt, nonce: Date.now() });
  }

  const conversations = chat.conversations;

  return (
    <article className="panel panel-full chat-panel card">
      <div className="chat-shell">
        <ChatSidebar
          conversations={conversations}
          activeId={chat.activeId}
          sending={chat.sending}
          onSelect={chat.selectConversation}
          onCreate={chat.newConversation}
          onRemove={handleRemove}
        />
        <div className="chat-main">
          <ChatHeader
            kicker="AI 对话"
            title="和助手聊聊"
            conversations={conversations}
            activeId={chat.activeId}
            sending={chat.sending}
            onSelect={chat.selectConversation}
            onCreate={chat.newConversation}
            onRemove={handleRemove}
          />
          <ChatMessages
            messages={chat.messages}
            streamingText={chat.streamingText}
            listRef={listRef}
            onRegenerate={() => void chat.regenerate()}
            regenerating={chat.sending}
            empty={
              <>
                <p className="ds-empty__title">今天想聊点什么？</p>
                <ChatSuggestions
                  items={textLabPrompts}
                  disabled={blocked}
                  onPick={pickPrompt}
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
                  onClick={() => void chat.regenerate()}
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
            prefill={prefill}
            user={auth.user}
            quota={auth.quota}
            onSend={chat.send}
            onStop={chat.stop}
          />
        </div>
      </div>
    </article>
  );
}
