"use client";

// 文字实验室页。这一节把"结果"这份 state 提到了这里——因为 InputCard 负责发请求、
// ResultCard 负责显示，两个兄弟组件要共享同一份结果，就放到它们共同的父组件里
//（4.4 学过的"状态提升"）。用了 useState，所以顶上写了 "use client"。
import { useState } from "react";
import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import InputCard from "./InputCard.jsx";
import ResultCard from "./ResultCard.jsx";
import { textLab } from "../data/site.js";

export default function TextLabView() {
  const [result, setResult] = useState(null);

  return (
    <AnimatedCardGrid className="dashboard-grid">
      <article className="hero-stage panel-full">
        <Nav />
        <PageHeading title={textLab.heroTitle} subtitle={textLab.heroSubtitle} />
      </article>

      <InputCard onResult={setResult} />
      <ResultCard result={result} />
    </AnimatedCardGrid>
  );
}
