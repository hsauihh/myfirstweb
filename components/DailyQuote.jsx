"use client";

// 每日一句：预设文案 8 秒自动轮播，也支持手动切换（左右箭头、圆点、点击引文）。
// 因为要用 useState / setInterval，所以是客户端组件。
// 引文切换用 CSS 淡入（widgets.css 里 key 变化触发 animation），
// prefers-reduced-motion 下会禁用动画（见 widgets.css）。
import { useEffect, useState } from "react";
import { quotes } from "../data/quotes.js";

const ArrowLeft = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const ArrowRight = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function DailyQuote({ label = "每日一句", interval = 8000 }) {
  const [index, setIndex] = useState(0);
  const count = quotes.length;

  const goTo = (i) => setIndex(((i % count) + count) % count);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // 每次 index 变化（自动或手动）都重置计时器，这样手动切换后不会立刻被自动切走。
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(timer);
  }, [index, count, interval]);

  return (
    <div className="identity-item daily-quote-item">
      <p className="section-kicker">{label}</p>
      <div className="daily-quote" role="group" aria-label={label}>
        <button className="quote-arrow" type="button" onClick={prev} aria-label="上一条">
          {ArrowLeft}
        </button>

        <figure className="quote-stage" aria-live="polite">
          {/* key 变化让这句重新挂载，触发淡入动画；本身也可点击/键盘切换 */}
          <blockquote
            key={index}
            className="quote-text"
            role="button"
            tabIndex={0}
            onClick={next}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                next();
              }
            }}
            title="点击切换下一条"
          >
            “{quotes[index]}”
          </blockquote>
          <figcaption className="quote-dots" aria-hidden="true">
            {quotes.map((_, i) => (
              <button
                key={i}
                type="button"
                className={"quote-dot" + (i === index ? " is-active" : "")}
                onClick={() => goTo(i)}
                aria-label={`第 ${i + 1} 条`}
              />
            ))}
          </figcaption>
        </figure>

        <button className="quote-arrow" type="button" onClick={next} aria-label="下一条">
          {ArrowRight}
        </button>
      </div>
    </div>
  );
}
