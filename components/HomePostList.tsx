"use client";

// 首页博客列表（最新 / 最热共用一份实现，只差排序与展示的元信息）。
// 数据来自公开接口 /api/blog/posts，游客也能看；加载时用骨架屏占位（不跳动）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "./apiError";
import * as blogApi from "./blogApi";
import { ChevronIcon, HeartIcon } from "./HomeIcons";
import type { BlogCard } from "./types";

type Sort = "published" | "likes";

interface HomePostListProps {
  sort: Sort;
  limit: number;
  /** 最热榜展示排名序号，最新榜展示日期与作者。 */
  ranked?: boolean;
  empty?: string;
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function HomePostList({
  sort,
  limit,
  ranked = false,
  empty = "还没有文章。",
}: HomePostListProps) {
  const [posts, setPosts] = useState<BlogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    blogApi
      .listPosts(0, limit, sort)
      .then((data) => alive && setPosts(data.items))
      .catch((err) => alive && setError(errorMessage(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sort, limit]);

  if (loading) {
    return (
      <ul className="home-rows" aria-busy="true">
        {Array.from({ length: 3 }, (_value, index) => (
          <li key={index} className="skel-row">
            <span className="skel skel--date" />
            <span className="skel skel--title" />
            <span className="skel skel--meta" />
          </li>
        ))}
      </ul>
    );
  }
  if (error) return <p className="home-list-state">{error}</p>;
  if (posts.length === 0) return <p className="home-list-state">{empty}</p>;

  return (
    <ul className="home-rows">
      {posts.map((post, index) => (
        <li key={post.id}>
          <Link className="home-row" href={`/blog/post?id=${post.id}`}>
            {ranked ? (
              <span
                className={"home-row__rank" + (index < 3 ? " is-top" : "")}
                aria-label={`第 ${index + 1} 名`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : (
              <time className="home-row__date" dateTime={post.published_at ?? undefined}>
                {formatDay(post.published_at)}
              </time>
            )}
            <span className="home-row__title">{post.title}</span>
            <span
              className="home-row__meta"
              aria-label={ranked ? `${post.like_count} 个赞` : undefined}
            >
              {ranked ? (
                <>
                  <HeartIcon /> {post.like_count}
                </>
              ) : (
                post.author.username
              )}
              <ChevronIcon size={13} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
