"use client";

// 普通 AI 对话面板：会话列表 + 消息区 + 输入区（含「文字实验室」常用提示词）。
// 知识库问答已移到 /knowledge，这里不涉及知识库。
import { useEffect, useRef } from "react";
import ChatComposer from "./ChatComposer";
import ChatMessages from "./ChatMessages";
import ChatToolbar from "./ChatToolbar";
import useChat from "./useChat";
import { useAuth } from "./AuthContext";
import { textLabPrompts } from "../data/site";

export default function ChatPanel() {
  const auth = useAuth();
  const chat = useChat({ kind: "chat", onQuota: auth.applyQuota });
  const listRef = useRef<HTMLDivElement | null>(null);
  const blocked =
    !auth.loading && !auth.user?.vip && (auth.quota?.remaining ?? 0) <= 0;

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

  function placeholder() {
    if (blocked) {
      return auth.user
        ? "今日免费次数已用完，开通 VIP 继续"
        : "额度已用完，登录后继续";
    }
    return "说点什么…（Enter 发送，Shift+Enter 换行）";
  }

  return (
    <article className="panel panel-full chat-panel card">
      <ChatToolbar
        kicker="AI 对话"
        title="和助手聊聊"
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
        selfName={auth.user?.username}
      />
      {chat.error && <p className="lab-error chat-error">{chat.error}</p>}
      <ChatComposer
        sending={chat.sending}
        disabled={blocked}
        placeholder={placeholder()}
        prompts={textLabPrompts}
        user={auth.user}
        quota={auth.quota}
        onSend={chat.send}
        onStop={chat.stop}
      />
    </article>
  );
}
