// 页面顶部的大标题 + 副标题。
// 个人主页和文字实验室都用它——同一个组件，靠 props（title / subtitle）显示不同内容。
// 这就是"复用"：结构写一次，两页共享，只是喂进去的字不一样。
export default function PageHeading({ title, subtitle }) {
  return (
    <div className="hero-copy">
      <h1 className="hero-display">{title}</h1>
      <p className="hero-subtitle">{subtitle}</p>
    </div>
  );
}
