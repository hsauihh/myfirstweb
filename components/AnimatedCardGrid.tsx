"use client";

// 用法：<AnimatedCardGrid className="dashboard-grid">… hero + 几张卡片 …</AnimatedCardGrid>
// 和 4.4 一字未改——同一份"卡片飞入"动画。
// 因为用了 useEffect / anime.js，要在浏览器里跑，所以顶上标了 "use client"。
import { useEffect, useRef, type ReactNode } from "react";
import { animate, stagger } from "animejs";

export default function AnimatedCardGrid({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>(".card");
    // 先把「入场初始态」固化到这一轮卡片自己身上，再放开全局规则：
    // 之后再挂载的 .card（懒加载 / 条件渲染的面板）才不会被初始态永久留在透明。
    cards.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(24px)";
    });
    root.dataset.entered = "true";

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // 尊重系统「减少动态效果」：直接呈现最终状态，不播动画
      cards.forEach((card) => {
        card.style.opacity = "1";
        card.style.transform = "none";
      });
      return;
    }
    animate(cards, {
      opacity: [0, 1],
      translateY: [24, 0],
      delay: stagger(120),     // 每张卡错开 120ms
      duration: 700,
      ease: "outBack",         // 弹性落地
    });
  }, []);

  return (
    <section ref={ref} className={["animated-grid", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}
