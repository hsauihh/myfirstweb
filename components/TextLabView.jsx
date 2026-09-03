// 文字实验室页。结构和 4.4 的 TextLabPage 一模一样（只是改了名 TextLabPage → TextLabView）。
// 它只是把几块积木摆在一起：导航、标题、输入卡、结果卡——自己没用任何交互，
// 所以是个"服务端组件"，顶上不用写 "use client"。
// （真正带交互的 InputCard / ResultCard 各自顶上写了 "use client"。）
import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import InputCard from "./InputCard.jsx";
import ResultCard from "./ResultCard.jsx";
import { textLab } from "../data/site.js";

export default function TextLabView() {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      <article className="hero-stage panel-full">
        <Nav />
        <PageHeading title={textLab.heroTitle} subtitle={textLab.heroSubtitle} />
      </article>

      <InputCard />
      <ResultCard />
    </AnimatedCardGrid>
  );
}
