// 页面顶部的大标题 + 副标题。和 4.4 一字未改。
// 它纯展示、不带任何交互，所以是个"服务端组件"——顶上不用写 "use client"。
export default function PageHeading({ title, subtitle }) {
  return (
    <div className="hero-copy">
      <h1 className="hero-display">{title}</h1>
      <p className="hero-subtitle">{subtitle}</p>
    </div>
  );
}
