// app/about/page.jsx → 网站路径 "/about"
// 关于页：站点简介 + 项目架构图入口。
// 架构图由 scripts/sync-architecture.mjs（predev/prebuild）从 docs/ 发布到 /architecture.html。
import type { Metadata } from "next";
import PageHeading from "../../components/PageHeading";

export const metadata: Metadata = {
  title: "关于 · zero to tech",
  description: "关于我与这个站，以及项目系统架构图",
};

export default function Page() {
  return (
    <section className="dashboard-grid">
      <div className="panel-full">
        <PageHeading eyebrow="关于" title="关于我" subtitle="关于我，关于这个站" />
      </div>

      <article className="panel panel-full">
        <p className="section-kicker">项目架构图</p>
        <h3 className="section-title">零到全栈 · 系统架构</h3>
        <p className="section-subtitle">
          前端 Next.js 静态导出，nginx 托管静态文件并反向代理 FastAPI；账号、对话、好友、博客与知识库向量都落在同一个
          SQLite。打开后可在图上切换「请求主链路 / AI 对话与知识库 / 好友实时推送」等视图，支持深浅色与缩放。
        </p>
        <p className="about-actions">
          <a
            className="btn btn-primary"
            href="/architecture.html"
            target="_blank"
            rel="noreferrer"
          >
            打开架构图
          </a>
        </p>
      </article>
    </section>
  );
}
