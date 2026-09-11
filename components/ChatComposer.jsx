"use client";

// 通用输入区：Enter 发送、Shift+Enter 换行。
// prompts 非空时在输入框上方渲染常用提示词（点击填入）；controls 是 footer 里的自定义控件插槽。
import { useRef, useState } from "react";
import ChatQuotaHint from "./ChatQuotaHint";
import VipModal from "./VipModal";

const MAX_LENGTH = 4000;

export default function ChatComposer({
  sending,
  disabled,
  placeholder = "说点什么…（Enter 发送，Shift+Enter 换行）",
  prompts = [],
  controls = null,
  user,
  quota,
  useRag = false,
  onSend,
  onStop,
}) {
  const [text, setText] = useState("");
  const [vipOpen, setVipOpen] = useState(false);
  const inputRef = useRef(null);
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

  // 生成中不抢 Enter：让浏览器默认换行，既不发送也不中断当前回答
  function handleKeyDown(event) {
    if (sending) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  }

  function pickPrompt(prompt) {
    setText(prompt);
    inputRef.current?.focus();
  }

  return (
    <>
      <form className="chat-form" onSubmit={submit}>
        {prompts.length > 0 && (
          <div className="prompt-chips" role="group" aria-label="常用提示词">
            {prompts.map((item) => (
              <button
                key={item.label}
                type="button"
                className="prompt-chip"
                disabled={blocked}
                onClick={() => pickPrompt(item.prompt)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          rows="3"
          maxLength={MAX_LENGTH}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={blocked}
        />
        <div className="chat-form-footer">
          <div className="chat-form-meta">
            <span className="lab-count">
              {text.length}/{MAX_LENGTH}
            </span>
            {controls}
            <ChatQuotaHint
              user={user}
              quota={quota}
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
