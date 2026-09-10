"use client";

// 对话面板：组合操作栏、消息区、输入区；数据与请求都在 useChat 里。
// kind 决定会话空间（chat = 普通 AI 对话 / rag = 知识库问答），forceRag 表示知识库专用面板。
import { useEffect, useRef, useState } from "react";
import ChatComposer from "./ChatComposer.jsx";
import ChatMessages from "./ChatMessages.jsx";
import ChatToolbar from "./ChatToolbar.jsx";
import useChat from "./useChat.js";
import * as ragApi from "./ragApi.js";
import { useAuth } from "./AuthContext.jsx";

const HEADINGS = {
  chat: { kicker: "AI 对话", title: "和助手聊聊" },
  rag: { kicker: "知识库问答", title: "基于站内资料回答" },
};

export default function ChatPanel({ kind = "chat", forceRag = false }) {
  const auth = useAuth();
  const chat = useChat({ kind, onQuota: auth.applyQuota });
  const listRef = useRef(null);
  const [useRag, setUseRag] = useState(forceRag);
  const [ragStatus, setRagStatus] = useState(null);
  const activeRag = forceRag || useRag;
  const activeQuota = activeRag ? auth.ragQuota : auth.quota;
  const blocked =
    !auth.loading && !auth.user?.vip && (activeQuota?.remaining ?? 0) <= 0;
  const heading = HEADINGS[kind] || HEADINGS.chat;

  // 知识库面板：取一次入库状态，用于顶部提示
  useEffect(() => {
    if (!forceRag) return undefined;
    let alive = true;
    ragApi
      .ragStatus()
      .then((data) => {
        if (alive) setRagStatus(data);
      })
      .catch(() => {
        // 后端不可用时静默
      });
    return () => {
      alive = false;
    };
  }, [forceRag]);

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
        kicker={heading.kicker}
        title={heading.title}
        conversations={chat.conversations}
        activeId={chat.activeId}
        sending={chat.sending}
        onSelect={chat.selectConversation}
        onCreate={chat.newConversation}
        onRemove={handleRemove}
      />
      {forceRag && ragStatus && (
        <p className="chat-quota">
          {ragStatus.ready
            ? `知识库已入库 ${ragStatus.documents} 个片段`
            : "知识库尚未入库，请先运行 ingest.py"}
        </p>
      )}
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
        quota={auth.quota}
        ragQuota={auth.ragQuota}
        user={auth.user}
        useRag={activeRag}
        showRagToggle={!forceRag}
        onToggleRag={setUseRag}
        onSend={chat.send}
        onStop={chat.stop}
      />
    </article>
  );
}
