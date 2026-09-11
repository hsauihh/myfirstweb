"use client";

// 我的知识库：顶部 Tab 切换「知识库问答」（KnowledgeQna）与「来源管理」（KnowledgeSources）。
// 两个面板都保持挂载，切 Tab 不会打断正在生成的回答。
import { useCallback, useEffect, useState } from "react";
import KnowledgeQna from "./KnowledgeQna.jsx";
import KnowledgeSources from "./KnowledgeSources.jsx";
import PageHeading from "./PageHeading.jsx";
import { useAuth } from "./AuthContext.jsx";
import * as ragApi from "./ragApi.js";

const TABS = [
  { id: "qna", label: "知识库问答" },
  { id: "sources", label: "来源管理" },
];

export default function KnowledgeView() {
  const { user, loading: authLoading, error: authError, refresh } = useAuth();
  const [tab, setTab] = useState("qna");
  const [status, setStatus] = useState(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await ragApi.ragStatus());
    } catch {
      // 后端不可用时静默
    }
  }, []);

  useEffect(() => {
    if (user) refreshStatus();
  }, [user, refreshStatus]);

  if (authLoading) {
    return (
      <section className="dashboard-grid">
        <div className="panel-full">
          <PageHeading eyebrow="知识库" title="我的知识库" subtitle="加载中…" />
        </div>
      </section>
    );
  }

  if (!user) {
    // 接口连不上时不要伪装成「未登录」，直接说清楚是后端问题
    if (authError) {
      return (
        <section className="dashboard-grid">
          <div className="panel panel-full">
            <PageHeading
              eyebrow="知识库"
              title="后端未连接"
              subtitle={`读取登录态失败（${authError}）。请先启动后端：npm run back`}
            />
            <p style={{ marginTop: 20 }}>
              <button type="button" className="btn btn-primary" onClick={refresh}>
                重试
              </button>
            </p>
          </div>
        </section>
      );
    }
    return (
      <section className="dashboard-grid">
        <div className="panel panel-full">
          <PageHeading
            eyebrow="知识库"
            title="登录后使用知识库"
            subtitle="把自己的文章或他人的公开文章选进来，让 AI 基于它们回答。"
            cta={{ href: "/login", label: "去登录 / 注册" }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-grid">
      <div className="panel-full">
        <PageHeading
          eyebrow="知识库"
          title="我的知识库"
          subtitle="选文章入库，再基于知识库问答"
        />
        <div className="lab-tabs" role="tablist" aria-label="知识库模式">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={"lab-tab" + (tab === item.id ? " is-active" : "")}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={"tab-panel" + (tab === "qna" ? "" : " is-hidden")}>
        <KnowledgeQna status={status} onManageSources={() => setTab("sources")} />
      </div>
      <div className={"tab-panel" + (tab === "sources" ? "" : " is-hidden")}>
        <KnowledgeSources onChanged={refreshStatus} />
      </div>
    </section>
  );
}
