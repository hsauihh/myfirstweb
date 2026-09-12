"use client";

// 通用输入区（DeepSeek 版式）：一个圆角容器，里面是自适应高度的输入框，
// 底行左边是各面板自己的控件（controls 插槽），右边是圆形发送/停止按钮。
// Enter 发送、Shift+Enter 换行；生成中 Enter 只换行，不发送也不打断当前回复。
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import ChatQuotaHint from "./ChatQuotaHint";
import VipModal from "./VipModal";
import type { PublicUser, Quota } from "./types";

const MAX_LENGTH = 4000;
const MAX_ROWS_HEIGHT = 200;

const SendIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d="M12 19V5M12 5l-6 6M12 5l6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StopIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);

interface ChatComposerProps {
  sending: boolean;
  disabled: boolean;
  placeholder?: string;
  /** 输入框底行左侧的控件（知识库问答放模式/系统库开关/记一笔）。 */
  controls?: ReactNode;
  /** 外部预填（如从知识图谱点「用这个概念提问」）：nonce 变化时写入输入框并聚焦。 */
  prefill?: { text: string; nonce: number } | null;
  user: PublicUser | null;
  quota: Quota | null | undefined;
  useRag?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatComposer({
  sending,
  disabled,
  placeholder = "说点什么…",
  controls = null,
  prefill = null,
  user,
  quota,
  useRag = false,
  onSend,
  onStop,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [vipOpen, setVipOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const blocked = disabled && !sending;

  useEffect(() => {
    if (!prefill) return;
    setText(prefill.text);
    inputRef.current?.focus();
  }, [prefill]);

  // 自适应高度：先归零再按内容撑开，超过上限就交给滚动
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, MAX_ROWS_HEIGHT)}px`;
  }, [text]);

  function submit(event: FormEvent) {
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
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (sending) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  }

  return (
    <>
      <form className="ds-composer" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="ds-composer__input"
          rows={1}
          maxLength={MAX_LENGTH}
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={blocked}
        />
        <div className="ds-composer__bar">
          <div className="ds-composer__tools">{controls}</div>
          <div className="ds-composer__tail">
            <span className="ds-composer__count">
              {text.length}/{MAX_LENGTH}
            </span>
            {sending ? (
              <button
                type="button"
                className="ds-send is-stop"
                onClick={onStop}
                aria-label="停止生成"
                title="停止生成"
              >
                {StopIcon}
              </button>
            ) : (
              <button
                type="submit"
                className="ds-send"
                disabled={blocked || !text.trim()}
                aria-label="发送"
                title="发送"
              >
                {SendIcon}
              </button>
            )}
          </div>
        </div>
      </form>
      <div className="ds-composer-hint">
        <span>Enter 发送 · Shift+Enter 换行</span>
        <ChatQuotaHint
          user={user}
          quota={quota}
          useRag={useRag}
          onOpenVip={() => setVipOpen(true)}
        />
      </div>
      <VipModal open={vipOpen} onClose={() => setVipOpen(false)} />
    </>
  );
}
