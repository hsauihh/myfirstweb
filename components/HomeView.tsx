"use client";

// 个人主页：顶部只留小字（分区名 + 一句话），内容按区域各成一张卡片。
// 版面 = 概览条（整行）+ 2×2 卡片网格：
//   第 1 行 随心一记（强调卡） | 公告
//   第 2 行 最新博客           | 最热博客
// 四张卡用显式网格定位，所以同行的上下边界严格对齐；DOM 顺序（随心一记 → 最新 → 公告 → 最热）
// 就是窄屏单栏的阅读顺序。动画只留引文淡入与行 hover。
import Link from "next/link";
import { useEffect, useState } from "react";
import DailyQuote from "./DailyQuote";
import HomeAnnouncements from "./HomeAnnouncements";
import { BellIcon, DocIcon, FlameIcon, GaugeIcon, NoteIcon } from "./HomeIcons";
import HomeNotes from "./HomeNotes";
import HomePostList from "./HomePostList";
import HomeStats from "./HomeStats";
import PageHeading from "./PageHeading";
import { home, type HomeContent } from "../data/site";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
// 两个博客榜条数一致：同行高度天然一致，不会出现一边高一边矮的空档
const POST_LIMIT = 5;

export default function HomeView() {
  const [data, setData] = useState<HomeContent>(home);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`${API}/api/profile`);
        if (!res.ok) throw new Error(`主页数据加载失败：${res.status}`);
        setData((await res.json()) as HomeContent);
      } catch (error) {
        console.error(error);
      }
    }
    loadProfile();
  }, []);

  return (
    <div className="home">
      <PageHeading
        eyebrow="个人主页"
        title={data.heroTitle}
        subtitle={
          data.identity?.learning
            ? `${data.heroSubtitle} · 正在学习 ${data.identity.learning}`
            : data.heroSubtitle
        }
      />

      <div className="home-strip">
        <span className="home-strip__label">今日</span>
        <DailyQuote />
      </div>

      <section className="panel card home-span">
        <div className="card-head">
          <h2 className="card-head__title">
            <GaugeIcon /> 知识库概览
          </h2>
          <span className="card-head__meta">随库更新，实时查询</span>
        </div>
        <HomeStats />
      </section>

      <div className="home-grid">
        <section className="panel card card--accent home-grid__note">
          <div className="card-head">
            <h2 className="card-head__title">
              <NoteIcon /> 随心一记
            </h2>
            <span className="card-head__meta">记一句话，问答里直接问</span>
          </div>
          <HomeNotes />
        </section>

        <section className="panel card home-grid__latest">
          <div className="card-head">
            <h2 className="card-head__title">
              <DocIcon /> 最新博客
            </h2>
            <Link className="card-head__action" href="/blog">
              全部 →
            </Link>
          </div>
          <HomePostList sort="published" limit={POST_LIMIT} empty="还没有文章。" />
        </section>

        <section className="panel card home-grid__notice">
          <div className="card-head">
            <h2 className="card-head__title">
              <BellIcon /> 公告
            </h2>
          </div>
          <HomeAnnouncements />
        </section>

        <section className="panel card home-grid__hot">
          <div className="card-head">
            <h2 className="card-head__title">
              <FlameIcon /> 最热博客
            </h2>
            <Link className="card-head__action" href="/blog">
              更多 →
            </Link>
          </div>
          <HomePostList sort="likes" limit={POST_LIMIT} ranked empty="还没有点赞。" />
        </section>
      </div>
    </div>
  );
}
