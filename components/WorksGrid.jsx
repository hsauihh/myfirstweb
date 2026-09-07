"use client";

// 作品区：静态卡片网格（参考站「课程系列」卡片式），用 data/site.js 的 featuredWorks。
// 卡片带 badge + 标题 + 描述 + 底部跳转按钮，网格响应式（3 / 2 / 1 列）。
import Link from "next/link";
import { featuredWorks } from "../data/site.js";

export default function WorksGrid() {
  return (
    <div className="works-grid">
      {featuredWorks.map((work) => (
        <article className="work-card card" key={work.title}>
          <span className="work-card__badge">{work.kicker}</span>
          <h3 className="work-card__title">{work.title}</h3>
          <p className="work-card__desc">{work.copy}</p>
          <div className="work-card__footer">
            <Link href={work.href} className="btn btn-outline">
              {work.linkLabel}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
