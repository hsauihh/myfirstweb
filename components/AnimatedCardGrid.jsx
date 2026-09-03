"use client";

// 用法：<AnimatedCardGrid className="dashboard-grid">… hero + 几张卡片 …</AnimatedCardGrid>
// 和 4.4 一字未改——同一份"卡片飞入"动画。
// 因为用了 useEffect / anime.js，要在浏览器里跑，所以顶上标了 "use client"。
import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

export default function AnimatedCardGrid({ className, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const cards = ref.current.querySelectorAll(".card");
    animate(cards, {
      opacity: [0, 1],
      translateY: [24, 0],
      delay: stagger(120),     // 每张卡错开 120ms
      duration: 700,
      ease: "outBack",         // 弹性落地
    });
  }, []);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
