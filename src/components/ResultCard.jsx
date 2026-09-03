import { useEffect, useRef } from "react";
import { animate, scrambleText } from "animejs";

// 一个完整的 React 组件：它自己 import 要用的 anime，自己 export 出去。
// 一挂载（出现在页面上），就自己淡入、并把情感分数滚动归位——这是它自带的"入场动画"。
// （点"开始分析"再去驱动分析，是"数据驱动界面"的活儿，留到 4.4。）
export default function ResultCard() {
  const cardRef = useRef(null);
  const scoreRef = useRef(null);

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
          <p>今天的风很轻，适合把脑海里的想法慢慢写下来。</p>
        </div>
        <div className="result-item">
          <span>拼音</span>
          <p>jīn tiān de fēng hěn qīng …</p>
        </div>
        <div className="result-grid">
          <div className="result-badge">
            <span>情感分数</span>
            <strong data-score ref={scoreRef}>0.86</strong>
          </div>
          <div className="result-badge">
            <span>情感判断</span>
            <strong>偏积极</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
