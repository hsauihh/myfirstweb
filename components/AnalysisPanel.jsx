"use client";

// 文字实验室的「分析」模式：输入卡 + 结果卡 + 历史弹窗，逻辑与拆分前一致。
import { useState } from "react";
import InputCard from "./InputCard";
import ResultCard from "./ResultCard";
import HistoryModal from "./HistoryModal";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function AnalysisPanel() {
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

  async function clearHistory() {
    try {
      await fetch(`${API}/api/history`, {
        method: "DELETE",
        credentials: "include",
      });
      setHistory([]);
    } catch {
      // 后端不可用时保留现有列表，不清空
    }
  }

  return (
    <>
      <InputCard onResult={setResult} />
      <ResultCard result={result} onOpenHistory={openHistory} />
      <HistoryModal
        open={historyOpen}
        items={history}
        onClose={() => setHistoryOpen(false)}
        onClear={clearHistory}
      />
    </>
  );
}
