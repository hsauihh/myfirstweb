"use client";

// 输入区：Enter 发送、Shift+Enter 换行；可切换「使用知识库」。
import { useState } from "react";
import ChatQuotaHint from "./ChatQuotaHint.jsx";
import VipModal from "./VipModal.jsx";

const MAX_LENGTH = 4000;

export default function ChatComposer({
  sending,
  disabled,
  quota,
  ragQuota,
  user,
  useRag,
  onToggleRag,
  onSend,
  onStop,
}) {
  const [text, setText] = useState("");
  const [vipOpen, setVipOpen] = useState(false);
  const ragNeedsLogin = useRag && !user;
  const blocked = (disabled && !sending) || ragNeedsLogin;

  function submit(event) {
    event.preventDefault();
    if (sending) {
      onStop();
      return;
    }
    if (blocked || !text.trim()) return;
    onSend(text, useRag);
    setText("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  }

  function placeholder() {
    if (ragNeedsLogin) return "登录后可使用知识库";
    if (blocked) {
      return user ? "今日免费次数已用完，开通 VIP 继续" : "匿名额度已用完，登录后继续";
    }
    return "说点什么…（Enter 发送，Shift+Enter 换行）";
  }

  return (
    <>
      <form className="chat-form" onSubmit={submit}>
        <textarea
          rows="3"
          maxLength={MAX_LENGTH}
          placeholder={placeholder()}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending || blocked}
        />
        <div className="chat-form-footer">
          <div className="chat-form-meta">
            <span className="lab-count">
              {text.length}/{MAX_LENGTH}
            </span>
            <div className="rag-toggle">
              <button
                type="button"
                role="switch"
                aria-checked={useRag}
                aria-label="使用知识库"
                className={"switch switch--sm" + (useRag ? " is-on" : "")}
                onClick={() => onToggleRag(!useRag)}
              >
                <span className="switch-knob" />
              </button>
              <span className="rag-toggle-label">使用知识库</span>
            </div>
            <ChatQuotaHint
              user={user}
              quota={useRag ? ragQuota : quota}
              useRag={useRag}
              onOpenVip={() => setVipOpen(true)}
            />
          </div>
          <button className="primary-button" type="submit" disabled={blocked}>
            {sending ? "停止" : "发送"}
          </button>
        </div>
      </form>
      <VipModal open={vipOpen} onClose={() => setVipOpen(false)} />
    </>
  );
}
