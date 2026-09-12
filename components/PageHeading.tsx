// 页面顶部：只有小字（分区名 + 一句话说明），不再渲染大标题。
// 标题仍以 <h1 class="sr-only"> 保留，文档大纲与 SEO 不受影响。
// cta 存在时作为右侧的小按钮（登录引导等），不是导航替代品。
import Link from "next/link";

interface PageHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
}

export default function PageHeading({ eyebrow, title, subtitle, cta }: PageHeadingProps) {
  return (
    <section className="page-top">
      <h1 className="sr-only">{title}</h1>
      <div className="page-top__main">
        {eyebrow && <p className="page-top__label">{eyebrow}</p>}
        {subtitle && <p className="page-top__subtitle">{subtitle}</p>}
      </div>
      {cta && (
        <Link href={cta.href} className="btn btn-outline page-top__cta">
          {cta.label}
        </Link>
      )}
    </section>
  );
}
