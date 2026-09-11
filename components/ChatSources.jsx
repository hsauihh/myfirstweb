"use client";

// 助手回答下方的参考来源：同一次回答命中的多个片段按文章聚合，
// 每篇文章下面列出命中的小节（角标编号与正文里的 [n] 一致）。
// 个人文章点击直达原文对应小节；站内公共资料没有网页，点击弹出命中片段。
import Link from "next/link";
import { headingSlug, lastSection } from "./slug";

function groupSources(sources) {
  const groups = new Map();
  for (const item of sources) {
    const key = item.post_id ? `post:${item.post_id}` : `public:${item.label}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: item.title,
        author: item.author,
        post_id: item.post_id,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }
  const list = [...groups.values()];
  list.forEach((group) => group.items.sort((a, b) => a.index - b.index));
  return list.sort((a, b) => a.items[0].index - b.items[0].index);
}

function anchorHref(item) {
  const base = `/blog/post?id=${item.post_id}`;
  const heading = lastSection(item.section);
  return heading ? `${base}#${headingSlug(heading)}` : base;
}

function MarkLabel({ item }) {
  return (
    <>
      [{item.index}] {lastSection(item.section) || "正文"}
    </>
  );
}

export default function ChatSources({ sources, onOpen }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="chat-sources" aria-label="参考来源">
      <p className="chat-sources__title">参考来源</p>
      {groupSources(sources).map((group) => (
        <div key={group.key} className="chat-source-card">
          <div className="chat-source-card__head">
            <span className="chat-source-card__icon" aria-hidden="true">
              📄
            </span>
            <span className="chat-source-card__title">{group.title}</span>
            {group.author && (
              <span className="chat-source-card__author">{group.author}</span>
            )}
            <span className="chat-source-card__count">
              命中 {group.items.length} 处
            </span>
          </div>
          <div className="chat-source-card__marks">
            {group.items.map((item) =>
              item.post_id ? (
                <Link
                  key={item.index}
                  className="chat-source-card__mark"
                  href={anchorHref(item)}
                >
                  <MarkLabel item={item} />
                </Link>
              ) : (
                <button
                  key={item.index}
                  type="button"
                  className="chat-source-card__mark"
                  onClick={() => onOpen(item)}
                >
                  <MarkLabel item={item} />
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
