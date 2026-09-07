"use client";

// 文字实验室页：居中 hero + 输入卡片 + 结果卡片 + 历史弹窗。
import { useState } from "react";
import PageHeading from "./PageHeading.jsx";
import AnimatedCardGrid from "./AnimatedCardGrid.jsx";
import InputCard from "./InputCard.jsx";
import ResultCard from "./ResultCard.jsx";
import HistoryModal from "./HistoryModal.jsx";
import { textLab } from "../data/site.js";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function TextLabView() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function openHistory() {
    setHistoryOpen(true);
    try {
      const res = await fetch(`${API}/api/history`, { credentials: "include" });
      setHistory(await res.json());
    } catch {
      // 后端没起来时不让页面崩掉，弹窗显示"还没有记录"
    }
  }

  return (
    <AnimatedCardGrid className="dashboard-grid">
      <div className="panel-full">
        <PageHeading
          eyebrow="文字实验室"
          title={textLab.heroTitle}
          subtitle={textLab.heroSubtitle}
        />
      </div>

      <InputCard onResult={setResult} />
      <ResultCard result={result} onOpenHistory={openHistory} />

      <HistoryModal
        open={historyOpen}
        items={history}
        onClose={() => setHistoryOpen(false)}
      />
    </AnimatedCardGrid>
  );
}
