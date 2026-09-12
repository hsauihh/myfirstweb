"use client";

// 每日一句：预设文案 8 秒自动轮播；只渲染文字本身（无标签、无左右箭头、无圆点）。
// 点击文字可手动切下一条（保留键盘可达）。切换用 CSS 淡入（key 变化触发 animation，
// prefers-reduced-motion 下会禁用，见 css/home.css）。
import { useEffect, useState } from "react";
import { quotes } from "../data/quotes";

interface DailyQuoteProps {
  interval?: number;
}

export default function DailyQuote({ interval = 8000 }: DailyQuoteProps) {
  const [index, setIndex] = useState(0);
  const count = quotes.length;

  const next = () => setIndex((i) => (i + 1) % count);

  // 每次 index 变化（自动或手动）都重置计时器，手动切换后不会立刻被自动切走
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(timer);
  }, [index, count, interval]);

  return (
    <blockquote
      key={index}
      className="home-quote"
      role="button"
      tabIndex={0}
      aria-live="polite"
      title="点击切换下一条"
      onClick={next}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          next();
        }
      }}
    >
      {quotes[index]}
    </blockquote>
  );
}
