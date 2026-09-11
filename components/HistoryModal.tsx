"use client";

// 历史记录弹窗。这一节新增的组件：点结果卡右上角的"历史记录"，把 /api/history
// 拿到的数组逐条列出来。用弹窗而不是再加一张卡，是为了不把页面撑得太长。
// 它只管"把拿到的数组画出来"——这个数组是全站的、还是某个访客自己的，它不关心。
import { useEffect } from "react";
import type { HistoryEntry } from "./types";

// 后端存的是 UTC 时间（6.3 立的规矩：存 UTC，显示时再转本地）。
// 这里就是"转本地"的那一步——浏览器知道用户在哪个时区，交给它换算。
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface HistoryModalProps {
  open: boolean;
  items: HistoryEntry[];
  onClose: () => void;
  onClear: () => void;
}

export default function HistoryModal({
  open,
  items,
  onClose,
  onClear,
}: HistoryModalProps) {
  // 按 Esc 关闭
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 清空是不可逆操作，先确认再动手
  function handleClear() {
    if (window.confirm("确定清空全部历史记录吗？此操作不可恢复。")) {
      onClear();
    }
  }

  if (!open) return null;

  return (
    // 点遮罩关闭；点弹窗本体时 stopPropagation，免得误关
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="section-kicker">历史记录</p>
            <h3>最近的分析</h3>
          </div>
          <div className="modal-actions">
            {items.length > 0 && (
              <button
                type="button"
                className="ghost-button danger"
                onClick={handleClear}
              >
                清空
              </button>
            )}
            <button type="button" className="modal-close" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="history-empty">还没有记录，先分析一句试试。</p>
        ) : (
          <div className="history-list">
            {/* 列表渲染：照着数组逐条长出来。key 用数据库发的那个唯一 id */}
            {items.map((item) => (
              <div className="history-item" key={item.id}>
                <p className="history-text">{item.text}</p>
                <span className="history-meta">
                  {item.score} · {item.label} · {formatTime(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
