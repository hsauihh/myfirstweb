// 页面顶部 hero：eyebrow 小标签 + 大标题 + 副标题 + 可选 CTA 按钮。
// 纯展示、无交互，服务端组件。cta 为 { href, label } 时显示按钮。
import Link from "next/link";

interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
}

export default function PageHeading({ eyebrow, title, subtitle, cta }: PageHeadingProps) {
  return (
    <section className="hero">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="hero-title">{title}</h1>
      {subtitle && <p className="hero-subtitle">{subtitle}</p>}
      {cta && (
        <Link href={cta.href} className="btn btn-primary hero-cta">
          {cta.label}
        </Link>
      )}
    </section>
  );
}
