// 占位页视图：套用主页的 hero + 卡片布局，里面放一张「内容建设中」卡片。
// 纯展示、无交互，所以是服务端组件（不用 "use client"）；
// 它内部用到的 Nav / AnimatedCardGrid 是客户端组件，服务端可以直接引用。
import Nav from "./Nav.jsx";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";

export default function PlaceholderView({ title, subtitle }) {
  return (
    <AnimatedCardGrid className="dashboard-grid">
      <article className="hero-stage panel-full">
        <Nav />
        <PageHeading title={title} subtitle={subtitle} />
      </article>

      <article className="panel panel-full card placeholder-panel">
        <p className="section-kicker">页面建设中</p>
        <p className="featured-copy">这里的内容正在准备中，敬请期待。</p>
      </article>
    </AnimatedCardGrid>
  );
}
