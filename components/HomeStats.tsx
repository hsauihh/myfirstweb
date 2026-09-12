"use client";

// 首页概览：把知识库的真实规模摆出来（片段 / 实体 / 关系，登录后加「我的笔记」）。
// 数据来自公开的 /api/rag/status 与登录后的 /api/kb/notes；数字用等宽数字对齐。
import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import * as kbApi from "./kbApi";
import * as ragApi from "./ragApi";
import type { RagStatus } from "./types";

interface Metric {
  label: string;
  value: number;
  unit: string;
}

export default function HomeStats() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [notes, setNotes] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    ragApi
      .ragStatus()
      .then((data) => alive && setStatus(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setNotes(null);
      return undefined;
    }
    let alive = true;
    kbApi
      .listNotes(1, 0)
      .then((data) => alive && setNotes(data.total))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  if (!status) return <p className="home-list-state">加载中…</p>;

  const metrics: Metric[] = [
    {
      label: "知识库片段",
      value: status.public + status.personal,
      unit: "块",
    },
    { label: "图谱实体", value: status.entities, unit: "个" },
    { label: "图谱关系", value: status.relations, unit: "条" },
  ];
  if (user) {
    metrics.push({ label: "随心一记", value: notes ?? 0, unit: "条" });
  }

  return (
    <dl className="home-stats">
      {metrics.map((metric) => (
        <div className="home-stat" key={metric.label}>
          <dt className="home-stat__label">{metric.label}</dt>
          <dd className="home-stat__value">
            {metric.value.toLocaleString("zh-CN")}
            <span className="home-stat__unit">{metric.unit}</span>
          </dd>
        </div>
      ))}
      {!loading && !user && (
        <div className="home-stat home-stat--hint">
          <dt className="home-stat__label">我的知识库</dt>
          <dd className="home-stat__hint">登录后统计你自己的片段与笔记</dd>
        </div>
      )}
    </dl>
  );
}
