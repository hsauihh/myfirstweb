import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import { home } from "../data/site.js";

// 注意：这个组件里几乎一个"内容"都没写死——
// 标题、副标题、作品文案、座右铭……全部从 site.js 的 home 里读。
// 想改文案？打开 src/data/site.js 改一行，这个文件一个字都不用动。
export default function HomePage({ current, onNavigate }) {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      {/* 复用：Nav 和 PageHeading 都和文字实验室共享，只是 PageHeading 的 props 换了内容 */}
      <article className="hero-stage panel-full">
        <Nav current={current} onNavigate={onNavigate} />
        <PageHeading title={home.heroTitle} subtitle={home.heroSubtitle} />
      </article>

      {/* 下面这两张卡只在首页用、也不复杂，就直接写在这儿——不必为了拆而拆 */}
      <article className="panel panel-full featured-work-panel card">
        <p className="section-kicker">{home.featuredWork.kicker}</p>
        <p className="featured-title">{home.featuredWork.title}</p>
        <p className="featured-copy">{home.featuredWork.copy}</p>
        <a
          className="featured-link"
          href="#"
          onClick={(e) => { e.preventDefault(); onNavigate("textlab"); }}
        >
          <span className="featured-link-label">{home.featuredWork.linkLabel}</span>
          <span className="arrow">›</span>
        </a>
      </article>

      <article className="panel panel-full identity-panel card">
        <div className="identity-item">
          <p className="section-kicker">座右铭</p>
          <p className="identity-value identity-quote">{home.identity.motto}</p>
        </div>
        <div className="identity-item">
          <p className="section-kicker">正在学习</p>
          <p className="identity-value">{home.identity.learning}</p>
        </div>
      </article>
    </AnimatedCardGrid>
  );
}
