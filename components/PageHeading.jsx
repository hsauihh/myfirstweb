// 页面顶部的大标题 + 副标题，包进一张玻璃卡片（「每个文字部分都加卡片」）。
// 它纯展示、不带任何交互，所以是个"服务端组件"——顶上不用写 "use client"。
export default function PageHeading({ title, subtitle }) {
  return (
    <article className="panel card hero-copy-card">
      <div className="hero-copy">
        <h1 className="hero-display">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
      </div>
    </article>
  );
}
