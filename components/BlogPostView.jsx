"use client";

// 文章详情：读 ?id=，渲染 Markdown 正文、点赞与编辑入口。
// 静态导出不能有动态路由，所以详情走 query 参数（外层用 Suspense 包住）。
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "./Avatar.jsx";
import BlogLikeButton from "./BlogLikeButton.jsx";
import Markdown from "./Markdown.jsx";
import { formatDate } from "./blogDate.js";
import { useAuth } from "./AuthContext.jsx";
import * as blogApi from "./blogApi.js";
import * as kbApi from "./kbApi.js";

export default function BlogPostView() {
  const { user } = useAuth();
  const postId = useSearchParams().get("id");
  const [post, setPost] = useState(null);
  const [inKb, setInKb] = useState(false);
  const [kbBusy, setKbBusy] = useState(false);
  const [kbError, setKbError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    blogApi
      .getPost(postId)
      .then((data) => {
        if (!alive) return;
        setPost(data);
        setInKb(Boolean(data.in_kb));
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  async function addToKnowledge() {
    setKbBusy(true);
    setKbError("");
    try {
      await kbApi.addSource(post.id);
      setInKb(true);
    } catch (err) {
      setKbError(err.message);
    } finally {
      setKbBusy(false);
    }
  }

  if (loading) return <p className="blog-loading">加载中…</p>;

  if (error || !post) {
    return (
      <section className="dashboard-grid">
        <div className="panel panel-full">
          <p className="section-kicker">博客</p>
          <h1 className="blog-article__title">文章不存在或不可见</h1>
          <p className="section-subtitle">{error || "链接可能已失效。"}</p>
          <p style={{ marginTop: 20 }}>
            <Link href="/blog" className="btn btn-primary">
              返回博客
            </Link>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-grid">
      <article className="panel panel-full blog-article">
        <h1 className="blog-article__title">{post.title}</h1>

        <div className="blog-article__meta">
          <span className="blog-author">
            <Avatar name={post.author.username} src={post.author.avatar} size={26} />
            {post.author.username}
          </span>
          <span className="blog-date">
            {formatDate(post.published_at || post.created_at)}
          </span>
          {post.can_edit && post.visibility !== "public" && (
            <span className="blog-tag blog-tag--private">
              {post.visibility === "draft" ? "草稿" : "仅自己可见"}
            </span>
          )}
        </div>

        <div className="blog-article__body">
          <Markdown content={post.content} />
        </div>

        <div className="blog-article__foot">
          <BlogLikeButton
            postId={post.id}
            count={post.like_count}
            liked={post.liked_by_me}
          />
          <div className="blog-editor__actions">
            {user && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={kbBusy || inKb}
                onClick={addToKnowledge}
              >
                {inKb ? "已在知识库" : "加入知识库"}
              </button>
            )}
            {post.can_edit && (
              <Link href={`/blog/manage?edit=${post.id}`} className="btn btn-outline">
                编辑
              </Link>
            )}
            <Link href="/blog" className="blog-back">
              ← 返回列表
            </Link>
          </div>
        </div>
        {kbError && <p className="lab-error">{kbError}</p>}
      </article>
    </section>
  );
}
