"use client";

// 主页「作品」模块轮播：多条作品 8 秒自动切换，也能手动切换（左右箭头 + 圆点）。
// 每条的最终链接用 <Link 跳转>（因为结果区有跳转，点击轮播不放在整块内容上，避免和跳转冲突）。
// 因为要用 useState / setInterval，所以是客户端组件。
import { useEffect, useState } from "react";
import Link from "next/link";
import { featuredWorks } from "../data/site.js";

const ArrowLeft = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const ArrowRight = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export default function FeaturedWorkCarousel({ interval = 8000 }) {
  const [index, setIndex] = useState(0);
  const count = featuredWorks.length;

  const goTo = (i) => setIndex(((i % count) + count) % count);
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // 每次 index 变化都重置计时器，手动切换后不会立刻被自动切走。
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(timer);
  }, [index, count, interval]);

  const work = featuredWorks[index];

  return (
    <article className="panel panel-full featured-work-panel card featured-carousel" aria-label="作品轮播">
      {/* 右上角：上一件 / 计数 / 下一件 */}
      <div className="featured-carousel-controls">
        <button className="carousel-arrow" type="button" onClick={prev} aria-label="上一件">
          {ArrowLeft}
        </button>
        <span className="carousel-count">
          {index + 1} / {count}
        </span>
        <button className="carousel-arrow" type="button" onClick={next} aria-label="下一件">
          {ArrowRight}
        </button>
      </div>

      {/* key 变化让这块内容重新挂载，触发淡入动画 */}
      <div key={index} className="featured-content featured-fade" aria-live="polite">
        <p className="section-kicker">{work.kicker}</p>
        <p className="featured-title">{work.title}</p>
        <p className="featured-copy">{work.copy}</p>
        <Link className="featured-link" href={work.href}>
          <span className="featured-link-label">{work.linkLabel}</span>
          <span className="arrow">›</span>
        </Link>
      </div>

      {/* 底部圆点：点击跳到对应一件 */}
      <div className="featured-dots" aria-hidden="true">
        {featuredWorks.map((_, i) => (
          <button
            key={i}
            type="button"
            className={"featured-dot" + (i === index ? " is-active" : "")}
            onClick={() => goTo(i)}
            aria-label={`第 ${i + 1} 件`}
          />
        ))}
      </div>
    </article>
  );
}
