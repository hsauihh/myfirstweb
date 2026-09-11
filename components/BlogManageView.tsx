"use client";

// 我的文章：登录后管理「已发布」（公开 / 仅自己可见）与「草稿箱」；?edit=new|{id} 进入编辑器。
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import BlogEditor from "./BlogEditor";
import PageHeading from "./PageHeading";
import { useAuth } from "./AuthContext";
import { errorMessage } from "./apiError";
import { formatDateTime } from "./blogDate";
import * as blogApi from "./blogApi";
import type { BlogCard, Visibility } from "./types";

const TAGS: Record<Visibility, { text: string; className: string }> = {
  public: { text: "公开", className: "blog-tag--public" },
  private: { text: "仅自己可见", className: "blog-tag--private" },
  draft: { text: "草稿", className: "blog-tag--private" },
};

type ManageTab = "published" | "draft";

export default function BlogManageView() {
  const { user, loading: authLoading } = useAuth();
  const editParam = useSearchParams()?.get("edit") ?? null;
  const [tab, setTab] = useState<ManageTab>("published");
  const [items, setItems] = useState<BlogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await blogApi.listMyPosts();
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && editParam === null) refresh();
  }, [user, editParam, refresh]);

  async function remove(post: BlogCard) {
    if (!window.confirm(`确定删除《${post.title}》？`)) return;
    try {
      await blogApi.deletePost(post.id);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <section className="dashboard-grid">
        <div className="panel panel-full">
          <PageHeading
            eyebrow="博客"
            title="登录后写文章"
            subtitle="草稿只有你自己看得见，发布后所有人可读。"
            cta={{ href: "/login", label: "去登录 / 注册" }}
          />
        </div>
      </section>
    );
  }

  if (editParam !== null) {
    const numericId = Number(editParam);
    const postId = editParam === "new" || Number.isNaN(numericId) ? null : numericId;
    return <BlogEditor postId={postId} />;
  }

  const drafts = items.filter((post) => post.visibility === "draft");
  const published = items.filter((post) => post.visibility !== "draft");
  const counts: Record<ManageTab, number> = {
    published: published.length,
    draft: drafts.length,
  };
  const visible = tab === "draft" ? drafts : published;

  return (
    <section className="dashboard-grid">
      <div className="panel-full">
        <PageHeading eyebrow="博客" title="我的文章" subtitle="草稿只有你自己看得见" />
        <div className="blog-toolbar">
          <Link href="/blog" className="blog-back">
            ← 公开博客
          </Link>
          <Link href="/blog/manage?edit=new" className="btn btn-primary">
            写新文章
          </Link>
        </div>
      </div>

      <div className="panel-full">
        {error && <p className="lab-error">{error}</p>}

        <div className="blog-tabs" role="tablist" aria-label="文章分类">
          {(
            [
              { id: "published", label: "已发布" },
              { id: "draft", label: "草稿箱" },
            ] as { id: ManageTab; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={"blog-tab" + (tab === item.id ? " is-active" : "")}
              onClick={() => setTab(item.id)}
            >
              {item.label}（{counts[item.id]}）
            </button>
          ))}
        </div>

        {!loading && visible.length === 0 && (
          <p className="blog-empty">
            {tab === "draft" ? "草稿箱是空的。" : "还没有已发布的文章。"}
          </p>
        )}

        <div className="blog-manage-list">
          {visible.map((post) => {
            const tag = TAGS[post.visibility] || TAGS.draft;
            return (
              <div key={post.id} className="blog-row">
                <div className="blog-row__main">
                  <span className="blog-row__title">{post.title}</span>
                  <div className="blog-row__meta">
                    <span className={"blog-tag " + tag.className}>{tag.text}</span>
                    <span>更新于 {formatDateTime(post.updated_at)}</span>
                    <span>♡ {post.like_count}</span>
                  </div>
                </div>

                <div className="blog-row__actions">
                  {post.visibility !== "draft" && (
                    <Link href={`/blog/post?id=${post.id}`} className="btn btn-outline">
                      查看
                    </Link>
                  )}
                  <Link href={`/blog/manage?edit=${post.id}`} className="btn btn-outline">
                    编辑
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => remove(post)}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
