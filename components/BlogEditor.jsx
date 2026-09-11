"use client";

// 博客编辑器：标题 + Markdown 正文 + 实时预览，保存为草稿或发布。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Markdown from "./Markdown";
import * as blogApi from "./blogApi";

const TITLE_MAX_LENGTH = 100;

export default function BlogEditor({ postId }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) return;
    let alive = true;
    blogApi
      .getPost(postId)
      .then((post) => {
        if (!alive) return;
        if (!post.can_edit) {
          setError("无权编辑这篇文章");
          return;
        }
        setTitle(post.title);
        setContent(post.content);
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

  async function save(visibility) {
    if (!title.trim() || !content.trim()) {
      setError("标题和正文都不能为空");
      return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), content, visibility };
      if (postId) await blogApi.updatePost(postId, payload);
      else await blogApi.createPost(payload);
      router.push("/blog/manage");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!postId || !window.confirm("确定删除这篇文章？")) return;
    setSaving(true);
    try {
      await blogApi.deletePost(postId);
      router.push("/blog/manage");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="blog-loading">加载中…</p>;

  return (
    <section className="dashboard-grid">
      <div className="panel panel-full blog-editor">
        <div className="blog-toolbar">
          <Link href="/blog/manage" className="blog-back">
            ← 我的文章
          </Link>
          <span className="section-kicker">{postId ? "编辑文章" : "写新文章"}</span>
        </div>

        {error && <p className="lab-error">{error}</p>}

        <div className="blog-field">
          <label htmlFor="blog-title">标题</label>
          <input
            id="blog-title"
            type="text"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="给文章起个标题"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="blog-editor__grid">
          <div className="blog-field">
            <label htmlFor="blog-content">正文（Markdown）</label>
            <textarea
              id="blog-content"
              value={content}
              placeholder={"# 标题\n\n支持 **加粗**、*斜体*、列表、引用、代码、链接等 Markdown 语法。"}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <div className="blog-preview">
            <p className="blog-preview__label">预览</p>
            {content.trim() ? (
              <Markdown content={content} />
            ) : (
              <p className="blog-empty">左边写点什么，这里实时预览。</p>
            )}
          </div>
        </div>

        <div className="blog-editor__foot">
          <span className="lab-count">{content.length} 字</span>
          <div className="blog-editor__actions">
            {postId && (
              <button type="button" className="btn btn-outline" onClick={remove} disabled={saving}>
                删除
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => save("draft")}
              disabled={saving}
            >
              保存草稿
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => save("private")}
              disabled={saving}
            >
              仅自己可见
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => save("public")}
              disabled={saving}
            >
              {saving ? "保存中…" : "公开发布"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
