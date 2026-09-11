"use client";

// 个人主页。结构向参考站靠拢：居中 hero（eyebrow + 标题 + 副标题 + CTA）→
// 作品卡片网格（带 section-heading）→ 身份面板（每日一句 + 正在学习）。
import { useEffect, useState } from "react";
import PageHeading from "./PageHeading";
import AnimatedCardGrid from "./AnimatedCardGrid";
import DailyQuote from "./DailyQuote";
import CloudButton from "./CloudButton";
import WorksGrid from "./WorksGrid";
import { home } from "../data/site";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function HomeView() {
  const [data, setData] = useState(home);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`${API}/api/profile`);
        if (!res.ok) throw new Error(`主页数据加载失败：${res.status}`);
        setData(await res.json());
      } catch (error) {
        console.error(error);
      }
    }
    loadProfile();
  }, []);

  return (
    <AnimatedCardGrid className="dashboard-grid">
      <div className="panel-full">
        <PageHeading
          eyebrow="个人主页"
          title={data.heroTitle}
          subtitle={data.heroSubtitle}
          cta={{ href: "/text-lab", label: "进入文字实验室" }}
        />
      </div>

      <div className="panel-full section-heading">
        <p className="eyebrow">作品</p>
        <h2 className="section-title">看看我在做什么</h2>
      </div>

      <div className="panel-full">
        <WorksGrid />
      </div>

      <article className="panel panel-full identity-panel card">
        <DailyQuote label="每日一句" />
        <div className="identity-item">
          <p className="section-kicker">正在学习</p>
          <p className="identity-value">{data.identity.learning}</p>
        </div>
      </article>
    </AnimatedCardGrid>
  );
}
