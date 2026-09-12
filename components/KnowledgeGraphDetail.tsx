"use client";

// 概念详情侧栏：类型、出现次数、所属分组、关系列表与命中片段。
// 个人来源的片段可跳原文；公共资料没有站点页面，只展示文件名与小节。
import Link from "next/link";
import type { RagGraphEntity } from "./types";

interface KnowledgeGraphDetailProps {
  name: string;
  detail: RagGraphEntity | null;
  loading: boolean;
  error: string;
  onSelect: (name: string) => void;
  onAsk: (name: string) => void;
  onClose: () => void;
}

export default function KnowledgeGraphDetail({
  name,
  detail,
  loading,
  error,
  onSelect,
  onAsk,
  onClose,
}: KnowledgeGraphDetailProps) {
  return (
    <aside className="kg-detail" aria-label={`${name} 详情`}>
      <div className="kg-detail__head">
        <div>
          <h3 className="kg-detail__title">{name}</h3>
          <p className="kg-detail__meta">
            {detail
              ? `${detail.kind || "概念"} · 出现 ${detail.degree} 次`
              : loading
                ? "加载中…"
                : "暂无数据"}
          </p>
        </div>
        <button
          type="button"
          className="kg-detail__close"
          aria-label="关闭详情"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {error && <p className="lab-error">{error}</p>}
      {detail && (
        <>
          {detail.groups.length > 0 && (
            <p className="kg-detail__groups">所属：{detail.groups.join(" / ")}</p>
          )}
          <button
            type="button"
            className="btn btn-primary kg-detail__ask"
            onClick={() => onAsk(name)}
          >
            用这个概念提问
          </button>

          <section className="kg-detail__block">
            <h4 className="kg-detail__label">直接关系（{detail.relations.length}）</h4>
            {detail.relations.length === 0 && (
              <p className="kg-detail__empty">没有直接相连的概念。</p>
            )}
            <ul className="kg-relations">
              {detail.relations.map((item) => {
                const source = item.direction === "out" ? name : item.name;
                const target = item.direction === "out" ? item.name : name;
                return (
                  <li key={`${item.direction}-${item.name}-${item.relation}`}>
                    <span className="kg-relation__text">
                      {source} →{" "}
                      <button
                        type="button"
                        className="kg-relation__link"
                        onClick={() => onSelect(item.name)}
                      >
                        {target}
                      </button>
                    </span>
                    <span className="kg-relation__tag">
                      {item.relation}
                      {item.weight > 1 ? ` ×${item.weight}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="kg-detail__block">
            <h4 className="kg-detail__label">命中片段</h4>
            {detail.chunks.map((chunk, index) => (
              <article key={index} className="kg-chunk">
                <p className="kg-chunk__head">
                  {chunk.post_id !== null ? (
                    <Link
                      className="kg-chunk__title"
                      href={`/blog/post?id=${chunk.post_id}`}
                    >
                      {chunk.title}
                    </Link>
                  ) : (
                    <span className="kg-chunk__title">{chunk.title}</span>
                  )}
                  {chunk.author && (
                    <span className="kg-chunk__author">{chunk.author}</span>
                  )}
                </p>
                {chunk.section && (
                  <p className="kg-chunk__section">{chunk.section}</p>
                )}
                <p className="kg-chunk__snippet">{chunk.snippet}</p>
              </article>
            ))}
          </section>
        </>
      )}
    </aside>
  );
}
