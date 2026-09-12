"use client";

// 我的知识库：顶部 Tab 切换「知识库问答」「随心一记」「知识图谱」与「来源管理」。
// 问答与来源面板保持挂载（切 Tab 不打断正在生成的回答）；图谱与笔记面板首次打开才加载，
// 因为 React Flow 体积不小、笔记列表也没必要进首屏请求。
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import AnimatedCardGrid from "./AnimatedCardGrid";
import KnowledgeQna from "./KnowledgeQna";
import KnowledgeSources from "./KnowledgeSources";
import PageHeading from "./PageHeading";
import { useAuth } from "./AuthContext";
import * as ragApi from "./ragApi";
import type { RagStatus } from "./types";

const KnowledgeGraph = dynamic(() => import("./KnowledgeGraph"), { ssr: false });
const NotesPanel = dynamic(() => import("./KnowledgeNotes"), { ssr: false });

const TABS = [
  { id: "qna", label: "知识库问答" },
  { id: "notes", label: "随心一记" },
  { id: "graph", label: "知识图谱" },
  { id: "sources", label: "来源管理" },
] as const;

type KnowledgeTab = (typeof TABS)[number]["id"];

export default function KnowledgeView() {
  const { user, loading: authLoading, error: authError, refresh } = useAuth();
  const [tab, setTab] = useState<KnowledgeTab>("qna");
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [graphOpened, setGraphOpened] = useState(false);
  const [notesOpened, setNotesOpened] = useState(false);
  const [ask, setAsk] = useState<{ text: string; nonce: number } | null>(null);
  // 笔记增删后 +1：问答页的「记一笔」、随心一记页签、来源管理里的笔记列表都看它同步
  const [notesNonce, setNotesNonce] = useState(0);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await ragApi.ragStatus());
    } catch {
      // 后端不可用时静默
    }
  }, []);

  const selectTab = useCallback((id: KnowledgeTab) => {
    setTab(id);
    if (id === "graph") setGraphOpened(true);
    if (id === "notes") setNotesOpened(true);
  }, []);

  // 图谱里「用这个概念提问」：切回问答页并把问题预填进输入框（不自动发送）
  const askAbout = useCallback((name: string) => {
    setAsk({ text: `${name} 是什么？`, nonce: Date.now() });
    setTab("qna");
  }, []);

  // 首页「全部 N 条 →」等入口用 /knowledge#notes 直接落到随心一记页签
  useEffect(() => {
    const applyHash = () => {
      if (window.location.hash === "#notes") selectTab("notes");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [selectTab]);

  const notesChanged = useCallback(() => {
    setNotesNonce((value) => value + 1);
    void refreshStatus();
  }, [refreshStatus]);

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
            subtitle="把自己的文章、随手记的一句话选进来，让 AI 基于它们回答。"
            cta={{ href: "/login", label: "去登录 / 注册" }}
          />
        </div>
      </section>
    );
  }

  return (
    <AnimatedCardGrid className="dashboard-grid">
      <div className="panel-full">
        <PageHeading
          eyebrow="知识库"
          title="我的知识库"
          subtitle="记一笔、选文章入库，再基于知识库问答"
        />
        <div className="lab-tabs" role="tablist" aria-label="知识库模式">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={"lab-tab" + (tab === item.id ? " is-active" : "")}
              onClick={() => selectTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={"tab-panel" + (tab === "qna" ? "" : " is-hidden")}>
        <KnowledgeQna
          status={status}
          prefill={ask}
          onManageSources={() => selectTab("sources")}
          onNotesChanged={notesChanged}
        />
      </div>
      <div className={"tab-panel" + (tab === "notes" ? "" : " is-hidden")}>
        {notesOpened && (
          <NotesPanel nonce={notesNonce} onChanged={notesChanged} />
        )}
      </div>
      <div className={"tab-panel" + (tab === "graph" ? "" : " is-hidden")}>
        {graphOpened && <KnowledgeGraph visible={tab === "graph"} onAsk={askAbout} />}
      </div>
      <div className={"tab-panel" + (tab === "sources" ? "" : " is-hidden")}>
        <KnowledgeSources onChanged={refreshStatus} notesNonce={notesNonce} />
      </div>
    </AnimatedCardGrid>
  );
}
