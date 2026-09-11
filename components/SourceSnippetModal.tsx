"use client";

// 站内公共资料的引用弹层：RAGdata 原文不随站点发布（没有网页可跳），
// 所以这里只展示命中片段本身。
import { useEffect } from "react";
import { lastSection } from "./slug";
import type { Citation } from "./types";

interface SourceSnippetModalProps {
  source: Citation | null;
  onClose: () => void;
}

export default function SourceSnippetModal({ source, onClose }: SourceSnippetModalProps) {
  useEffect(() => {
    if (!source) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [source, onClose]);

  if (!source) return null;

  // 个人文章的小节有时就是文章标题（正文只有一个标题），不必重复显示
  const leaf = lastSection(source.section);
  const showSection = Boolean(leaf) && leaf !== source.title;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel source-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="section-kicker">参考资料</p>
            <h3>{source.title}</h3>
            <p className="source-modal__path">
              {source.label}
              {showSection ? ` · ${source.section}` : ""}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="source-modal__snippet">{source.snippet}</p>
      </div>
    </div>
  );
}
