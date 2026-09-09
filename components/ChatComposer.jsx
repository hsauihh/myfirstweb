"use client";

// 输入区：Enter 发送、Shift+Enter 换行；发送中按钮变为「停止」。
// 匿名访客显示剩余额度，用尽后禁用输入并给出登录入口。
import Link from "next/link";
import { useState } from "react";

const MAX_LENGTH = 4000;

export default function ChatComposer({
  sending,
  disabled,
  quota,
  onSend,
  onStop,
}) {
  const [text, setText] = useState("");
  const blocked = disabled && !sending;

  function submit(event) {
    event.preventDefault();
    if (sending) {
      onStop();
      return;
    }
    if (blocked || !text.trim()) return;
    onSend(text);
    setText("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  }

  const placeholder = blocked
    ? "匿名额度已用完，登录后继续"
    : "说点什么…（Enter 发送，Shift+Enter 换行）";

  return (
    <form className="chat-form" onSubmit={submit}>
      <textarea
        rows="3"
        maxLength={MAX_LENGTH}
        placeholder={placeholder}
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
          {quota && (
            <span className="chat-quota">
              匿名剩余 {quota.remaining}/{quota.limit} 句
              {quota.remaining === 0 && (
                <>
                  {" · "}
                  <Link href="/login" className="chat-quota-link">
                    登录 / 注册
                  </Link>
                </>
              )}
            </span>
          )}
        </div>
        <button className="primary-button" type="submit" disabled={blocked}>
          {sending ? "停止" : "发送"}
        </button>
      </div>
    </form>
  );
}
