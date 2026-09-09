"use client";

// 分析模式下的引导条：对分析结果不满意时，一键切到 AI 聊天。
export default function ChatPromo({ onSwitch }) {
  return (
    <article className="panel panel-full chat-promo card">
      <div>
        <p className="section-kicker">换个方式</p>
        <h3>分析的不准？</h3>
        <p className="section-subtitle">
          试试 AI 聊天，能理解上下文，回答更自然。
        </p>
      </div>
      <button type="button" className="primary-button" onClick={onSwitch}>
        去 AI 聊天
      </button>
    </article>
  );
}
