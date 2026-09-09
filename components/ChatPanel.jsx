"use client";

// AI 对话面板：组合操作栏、消息区、输入区；数据与请求都在 useChat 里。
import { useEffect, useRef, useState } from "react";
import ChatComposer from "./ChatComposer.jsx";
import ChatMessages from "./ChatMessages.jsx";
import ChatToolbar from "./ChatToolbar.jsx";
import useChat from "./useChat.js";
import { useAuth } from "./AuthContext.jsx";

export default function ChatPanel() {
  const auth = useAuth();
  const chat = useChat({ onQuota: auth.applyQuota });
  const listRef = useRef(null);
  const [useRag, setUseRag] = useState(false);
  const activeQuota = useRag ? auth.ragQuota : auth.quota;
  const blocked =
    !auth.loading && !auth.user?.vip && (activeQuota?.remaining ?? 0) <= 0;

  // 新消息或流式增量出现时滚到底部
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

  return (
    <article className="panel panel-full chat-panel card">
      <ChatToolbar
        conversations={chat.conversations}
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
      />
      {chat.error && <p className="lab-error chat-error">{chat.error}</p>}
      <ChatComposer
        sending={chat.sending}
        disabled={blocked}
        quota={auth.quota}
        ragQuota={auth.ragQuota}
        user={auth.user}
        useRag={useRag}
        onToggleRag={setUseRag}
        onSend={chat.send}
        onStop={chat.stop}
      />
    </article>
  );
}
