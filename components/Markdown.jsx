"use client";

// AI 助手/文章正文的 Markdown 渲染（GFM：表格 / 删除线 / 任务列表）。
// 默认不渲染原始 HTML，避免注入。
// 传入 sources 时，正文里的 [n] 会渲染成可点击的引用角标；标题一律带锚点 id。
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCitations from "./remarkCitations.js";
import { headingSlug, nodeText } from "./slug.js";

const CITATION_PREFIX = "#cite-";

function makeHeading(Tag) {
  function Heading({ children }) {
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

function makeLink(onCitation) {
  function CitationOrLink({ href, title, children }) {
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

export default function Markdown({ content, className = "", sources, onCitation }) {
  const indexes = useMemo(
    () => new Set((sources || []).map((item) => item.index)),
    [sources]
  );
  const components = useMemo(
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
