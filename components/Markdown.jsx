"use client";

// AI 助手输出的 Markdown 渲染（GFM：表格 / 删除线 / 任务列表）。
// 默认不渲染原始 HTML，避免注入。
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ content }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
