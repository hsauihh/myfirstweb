// 个人主页。结构、文案和 4.4 的 HomePage 一模一样（只是改了名 HomePage → HomeView）。
// 内容照旧从 site.js 的 home 里读——"数据与界面分离"原样保留，site.js 一字未改。
// 它本身纯展示、不带交互，是个"服务端组件"，顶上不用写 "use client"。
// 唯一的变化：4.4 那个"打开作品"靠 onNavigate 回调跳页，这里换成 Next 的 <Link>。
import Link from "next/link";
import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import { home } from "../data/site.js";

export default function HomeView() {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      <article className="hero-stage panel-full">
        <Nav />
        <PageHeading title={home.heroTitle} subtitle={home.heroSubtitle} />
      </article>

      <article className="panel panel-full featured-work-panel card">
        <p className="section-kicker">{home.featuredWork.kicker}</p>
        <p className="featured-title">{home.featuredWork.title}</p>
        <p className="featured-copy">{home.featuredWork.copy}</p>
        <Link className="featured-link" href="/text-lab">
          <span className="featured-link-label">{home.featuredWork.linkLabel}</span>
          <span className="arrow">›</span>
        </Link>
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
