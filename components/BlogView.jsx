"use client";

// 博客公开列表：所有人的公开文章，可按发布时间 / 点赞量排序，支持「加载更多」。
// 管理员（user.is_admin）可在卡片上直接删除公开文章。
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Avatar from "./Avatar";
import PageHeading from "./PageHeading";
import { useAuth } from "./AuthContext";
import { formatDate } from "./blogDate";
import * as blogApi from "./blogApi";

const PAGE_SIZE = 10;
const SORTS = [
  { id: "published", label: "最新发布" },
  { id: "likes", label: "最多点赞" },
];

export default function BlogView() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [sort, setSort] = useState("published");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (offset, activeSort) => {
    setLoading(true);
    try {
      const data = await blogApi.listPosts(offset, PAGE_SIZE, activeSort);
      setItems((prev) => (offset === 0 ? data.items : [...prev, ...data.items]));
      setHasMore(data.has_more);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setHasMore(false);
    load(0, sort);
  }, [sort, load]);

  async function removePost(post) {
    if (!window.confirm(`删除《${post.title}》？`)) return;
    try {
      await blogApi.deletePost(post.id);
      load(0, sort);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="dashboard-grid">
      <div className="panel-full">
        <PageHeading eyebrow="博客" title="零碎的想法" subtitle="慢慢写，慢慢积累" />
        <div className="blog-toolbar">
          <div className="blog-sort" role="group" aria-label="排序方式">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={"blog-sort__btn" + (sort === option.id ? " is-active" : "")}
                aria-pressed={sort === option.id}
                onClick={() => setSort(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Link href="/blog/manage?edit=new" className="btn btn-primary">
            写文章
          </Link>
        </div>
      </div>

      <div className="panel-full">
        {error && <p className="lab-error">{error}</p>}

        {!error && !loading && items.length === 0 && (
          <p className="blog-empty">还没有公开的文章。</p>
        )}

        <div className="blog-list">
          {items.map((post) => (
            <article key={post.id} className="blog-card">
              <Link href={`/blog/post?id=${post.id}`} className="blog-card__title">
                {post.title}
              </Link>
              {post.excerpt && <p className="blog-card__excerpt">{post.excerpt}</p>}
              <div className="blog-card__foot">
                <div className="blog-card__meta">
                  <span className="blog-author">
                    <Avatar name={post.author.username} src={post.author.avatar} size={22} />
                    {post.author.username}
                  </span>
                  <span className="blog-date">{formatDate(post.published_at)}</span>
                </div>
                <div className="blog-card__actions">
                  <span className="blog-date">♡ {post.like_count}</span>
                  {user?.is_admin && (
                    <button
                      type="button"
                      className="blog-delete"
                      onClick={() => removePost(post)}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {hasMore && (
          <div className="blog-more">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => load(items.length, sort)}
              disabled={loading}
            >
              {loading ? "加载中…" : "加载更多"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
