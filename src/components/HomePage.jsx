import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";

export default function HomePage({ current, onNavigate }) {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      {/* 复用：Nav 和 PageHeading 都和文字实验室共享，只是 PageHeading 的 props 换了内容 */}
      <article className="hero-stage panel-full">
        <Nav current={current} onNavigate={onNavigate} />
        <PageHeading title="关于我" subtitle="项目，创意，灵感，心得，我的作品" />
      </article>

      {/* 下面这两张卡只在首页用、也不复杂，就直接写在这儿——不必为了拆而拆 */}
      <article className="panel panel-full featured-work-panel card">
        <p className="section-kicker">作品</p>
        <p className="featured-title">文字实验室</p>
        <p className="featured-copy">拼音和情绪，挖掘中文里的细节</p>
        <a
          className="featured-link"
          href="#"
          onClick={(e) => { e.preventDefault(); onNavigate("textlab"); }}
        >
          <span className="featured-link-label">打开作品</span>
          <span className="arrow">›</span>
        </a>
      </article>

      <article className="panel panel-full identity-panel card">
        <div className="identity-item">
          <p className="section-kicker">座右铭</p>
          <p className="identity-value identity-quote">已识乾坤大，尤怜草木青</p>
        </div>
        <div className="identity-item">
          <p className="section-kicker">正在学习</p>
          <p className="identity-value">零到全栈</p>
        </div>
      </article>
    </AnimatedCardGrid>
  );
}
