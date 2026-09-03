"use client";

// 结果区卡片。这一节从"写死假数据"改成"显示父组件传来的 result"。
// 没有结果时（result 为 null）先显示一份默认占位；有结果就显示后端返回的内容。
// 拼音、情感分数目前后端还是占位/粗略值，模块 6 会换成真的。
import { useEffect, useRef } from "react";
import { animate, scrambleText } from "animejs";

export default function ResultCard({ result }) {
  const cardRef = useRef(null);
  const scoreRef = useRef(null);

  const original = result
    ? result.text
    : "今天的风很轻，适合把脑海里的想法慢慢写下来。";
  const pinyin = result ? result.pinyin : "jīn tiān de fēng hěn qīng …";
  const score = result ? result.score : 0.86;
  const label = result ? result.label : "偏积极";

  useEffect(() => {
    // 卡片自己淡入：.card 默认 opacity:0，这张卡负责把自己显出来
    animate(cardRef.current, {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 700,
      ease: "outBack",
    });
    // 情感分数滚动归位
    animate(scoreRef.current, {
      innerHTML: scrambleText({ chars: "0-9" }),
      duration: 1500,
    });
  }, []);

  return (
    <article ref={cardRef} className="panel panel-half lab-panel result-panel card">
      <div className="panel-heading">
        <p className="section-kicker">结果区</p>
        <h3>分析结果</h3>
      </div>
      <div className="result-stack">
        <div className="result-item">
          <span>原文</span>
          <p>{original}</p>
        </div>
        <div className="result-item">
          <span>拼音</span>
          <p>{pinyin}</p>
        </div>
        <div className="result-grid">
          <div className="result-badge">
            <span>情感分数</span>
            <strong data-score ref={scoreRef}>{score}</strong>
          </div>
          <div className="result-badge">
            <span>情感判断</span>
            <strong>{label}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
