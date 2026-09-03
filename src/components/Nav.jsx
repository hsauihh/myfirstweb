// 顶部这一条（品牌 + 导航）——4.2 里它在 index.html 和 text-lab.html 各抄了一遍。
// 现在它是一个组件，整个项目只有这一份。
// 想加链接、改样式？只改这一处，两个页面自动一起跟着变。
export default function Nav({ current, onNavigate }) {
  const items = [
    { key: "home",    label: "个人主页" },
    { key: "textlab", label: "文字实验室" },
  ];

  return (
    <div className="hero-topline">
      <p className="brand-eyebrow">zero to tech</p>
      <nav className="inline-links hero-nav">
        {items.map((it) => (
          <a
            key={it.key}
            href="#"
            className={"nav-link" + (current === it.key ? " active" : "")}
            onClick={(e) => { e.preventDefault(); onNavigate(it.key); }}
          >
            {it.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
