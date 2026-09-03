import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import InputCard from "./InputCard.jsx";
import ResultCard from "./ResultCard.jsx";

// 整页就是几块积木拼起来的：导航、标题、输入卡、结果卡。
// TextLabPage 这个"大组件"，把这些小组件摆在一起，拼成一整页。
export default function TextLabPage({ current, onNavigate }) {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      {/* 顶部 hero：导航 + 大标题，两块都是两页共用的组件 */}
      <article className="hero-stage panel-full">
        <Nav current={current} onNavigate={onNavigate} />
        <PageHeading title="文字实验室" subtitle="拼音和情绪，挖掘中文里的细节" />
      </article>

      <InputCard />
      <ResultCard />
    </AnimatedCardGrid>
  );
}
