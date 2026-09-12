"use client";

// 首页公告栏：走公开只读接口（游客可见），不带已读状态；
// 标题点击原地展开/收起正文——公告没有独立详情页。加载时用骨架屏占位。
import { useEffect, useState } from "react";
import * as api from "./announcementsApi";
import { ChevronIcon } from "./HomeIcons";
import type { PublicAnnouncement } from "./types";

const FRESH_DAYS = 7;

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function isFresh(iso: string): boolean {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time < FRESH_DAYS * 24 * 60 * 60 * 1000;
}

export default function HomeAnnouncements({ limit = 4 }: { limit?: number }) {
  const [items, setItems] = useState<PublicAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listPublicAnnouncements(limit)
      .then((data) => alive && setItems(data.items))
      .catch(() => alive && setError("公告加载失败"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [limit]);

  if (loading) {
    return (
      <ul className="home-rows" aria-busy="true">
        {Array.from({ length: 2 }, (_value, index) => (
          <li key={index} className="skel-row skel-row--notice">
            <span className="skel skel--date" />
            <span className="skel skel--title" />
          </li>
        ))}
      </ul>
    );
  }
  if (error) return <p className="home-list-state">{error}</p>;
  if (items.length === 0) return <p className="home-list-state">暂无公告。</p>;

  return (
    <ul className="home-rows">
      {items.map((item) => {
        const expanded = openId === item.id;
        const hasBody = item.body.trim().length > 0;
        return (
          <li key={item.id} className="home-notice">
            <button
              type="button"
              className="home-notice__head"
              aria-expanded={expanded}
              disabled={!hasBody}
              onClick={() => setOpenId(expanded ? null : item.id)}
            >
              <time className="home-row__date" dateTime={item.created_at}>
                {formatDay(item.created_at)}
              </time>
              <span className="home-row__title">
                {isFresh(item.created_at) && (
                  <span className="home-notice__new" aria-label="新公告">
                    新
                  </span>
                )}
                {item.title}
              </span>
              {hasBody && (
                <span className={"home-notice__toggle" + (expanded ? " is-open" : "")}>
                  <ChevronIcon size={13} />
                </span>
              )}
            </button>
            {hasBody && expanded && <p className="home-notice__body">{item.body}</p>}
          </li>
        );
      })}
    </ul>
  );
}
