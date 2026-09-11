"use client";

// AI 助手/文章正文的 Markdown 渲染（GFM：表格 / 删除线 / 任务列表）。
// 默认不渲染原始 HTML，避免注入。
// 传入 sources 时，正文里的 [n] 会渲染成可点击的引用角标；标题一律带锚点 id。
import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCitations from "./remarkCitations";
import { headingSlug, nodeText } from "./slug";
import type { Citation } from "./types";
import type { ReactNode } from "react";

const CITATION_PREFIX = "#cite-";

function makeHeading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  function Heading({ children }: { children?: ReactNode }) {
    return <Tag id={headingSlug(nodeText(children))}>{children}</Tag>;
  }
  Heading.displayName = `Markdown${Tag.toUpperCase()}`;
  return Heading;
}

const HEADINGS = {
  h1: makeHeading("h1"),
  h2: makeHeading("h2"),
  h3: makeHeading("h3"),
  h4: makeHeading("h4"),
  h5: makeHeading("h5"),
  h6: makeHeading("h6"),
};

function makeLink(onCitation?: (index: number) => void) {
  function CitationOrLink({
    href,
    title,
    children,
  }: {
    href?: string;
    title?: string;
    children?: ReactNode;
  }) {
    if (typeof href === "string" && href.startsWith(CITATION_PREFIX)) {
      const index = Number(href.slice(CITATION_PREFIX.length));
      return (
        <button
          type="button"
          className="citation-mark"
          title="查看引用来源"
          onClick={() => onCitation?.(index)}
        >
          {children}
        </button>
      );
    }
    return (
      <a href={href} title={title}>
        {children}
      </a>
    );
  }
  return CitationOrLink;
}

interface MarkdownProps {
  content: string;
  className?: string;
  sources?: Citation[] | null;
  onCitation?: (index: number) => void;
}

export default function Markdown({
  content,
  className = "",
  sources,
  onCitation,
}: MarkdownProps) {
  const indexes = useMemo(
    () => new Set((sources || []).map((item) => item.index)),
    [sources]
  );
  const components = useMemo<Components>(
    () => ({ ...HEADINGS, a: makeLink(onCitation) }),
    [onCitation]
  );

  return (
    <div className={"markdown-body" + (className ? " " + className : "")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkCitations, { indexes }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
