"use client";

// 文字实验室页：居中 hero + 模式 Tab（分析 / AI 对话），默认进入分析。
// 两个模式都保持挂载（用 CSS 隐藏），这样首屏的卡片入场动画能覆盖到全部卡片。
import { useState } from "react";
import PageHeading from "./PageHeading";
import AnimatedCardGrid from "./AnimatedCardGrid";
import AnalysisPanel from "./AnalysisPanel";
import ChatPanel from "./ChatPanel";
import ChatPromo from "./ChatPromo";
import { textLab } from "../data/site";

const TABS = [
  { id: "analysis", label: "分析" },
  { id: "chat", label: "AI 对话" },
] as const;

type LabTab = (typeof TABS)[number]["id"];

export default function TextLabView() {
  const [tab, setTab] = useState<LabTab>("analysis");

  return (
    <AnimatedCardGrid className="dashboard-grid">
      <div className="panel-full">
        <PageHeading
          eyebrow="文字实验室"
          title={textLab.heroTitle}
          subtitle={textLab.heroSubtitle}
        />
        <div className="lab-tabs" role="tablist" aria-label="模式切换">
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

      <div className={"tab-panel" + (tab === "chat" ? "" : " is-hidden")}>
        <ChatPanel />
      </div>
      <div className={"tab-panel" + (tab === "analysis" ? "" : " is-hidden")}>
        <AnalysisPanel />
        <ChatPromo onSwitch={() => setTab("chat")} />
      </div>
    </AnimatedCardGrid>
  );
}
