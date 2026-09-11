"use client";

// 我的知识库：站内公共资料（只读）+ 我添加的文章 + 从可读文章里挑选添加。
// 知识库问答会合并检索「站内公共库 + 我的个人库」。
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Avatar from "./Avatar.jsx";
import PageHeading from "./PageHeading.jsx";
import { useAuth } from "./AuthContext.jsx";
import * as kbApi from "./kbApi.js";

const SEARCH_DEBOUNCE_MS = 250;

const VISIBILITY_TAGS = {
  public: { text: "公开", className: "blog-tag--public" },
  private: { text: "仅自己可见", className: "blog-tag--private" },
  draft: { text: "草稿", className: "blog-tag--private" },
};

export default function KnowledgeView() {
  const { user, loading: authLoading } = useAuth();
  const [sources, setSources] = useState([]);
  const [publicCount, setPublicCount] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadSources = useCallback(async () => {
    const data = await kbApi.listSources();
    setSources(data.items);
    setPublicCount(data.public_documents);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    setLoading(true);
    loadSources()
      .then(() => alive && setError(""))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [user, loadSources]);

  // 候选文章：按标题搜索，输入停顿后再请求
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      kbApi
        .listCandidates(query)
        .then((data) => alive && setCandidates(data.items))
        .catch(() => {});
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [user, query]);

  async function add(postId) {
    setBusyId(postId);
    setError("");
    try {
      await kbApi.addSource(postId);
      await loadSources();
      setCandidates((prev) =>
        prev.map((item) => (item.post_id === postId ? { ...item, in_kb: true } : item))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(postId) {
    if (!window.confirm("从知识库移除这篇文章？")) return;
    setBusyId(postId);
    setError("");
    try {
      await kbApi.removeSource(postId);
      await loadSources();
      setCandidates((prev) =>
        prev.map((item) => (item.post_id === postId ? { ...item, in_kb: false } : item))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function sync(postId) {
    setBusyId(postId);
    setError("");
    try {
      await kbApi.syncSource(postId);
      await loadSources();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <section className="dashboard-grid">
        <div className="panel panel-full">
          <PageHeading
            eyebrow="知识库"
            title="登录后使用知识库"
            subtitle="把自己的文章或他人的公开文章选进来，让 AI 基于它们回答。"
            cta={{ href: "/login", label: "去登录 / 注册" }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-grid">
      <div className="panel-full">
        <PageHeading
          eyebrow="知识库"
          title="我的知识库"
          subtitle="把文章选进来，知识库问答会优先参考它们"
        />
      </div>

      <div className="panel panel-full card kb-public">
        <p className="section-kicker">站内公共资料</p>
        <p className="kb-public__count">已入库 {publicCount} 个片段</p>
        <p className="kb-public__note">
          随站点更新，始终参与回答，不需要也不能移除。
        </p>
      </div>

      <div className="panel panel-full card">
        <div className="kb-section__head">
          <h2 className="kb-section__title">我添加的文章（{sources.length}）</h2>
          <Link href="/text-lab" className="blog-back">
            去知识库问答 →
          </Link>
        </div>
        {error && <p className="lab-error">{error}</p>}
        {!loading && sources.length === 0 && (
          <p className="blog-empty">还没有添加文章，从下面挑一篇吧。</p>
        )}
        <div className="blog-manage-list">
          {sources.map((source) => (
            <div key={source.post_id} className="blog-row">
              <div className="blog-row__main">
                <Link
                  href={`/blog/post?id=${source.post_id}`}
                  className="blog-row__title"
                >
                  {source.title}
                </Link>
                <div className="blog-row__meta">
                  <span className="blog-author">
                    <Avatar
                      name={source.author.username}
                      src={source.author.avatar}
                      size={20}
                    />
                    {source.author.username}
                  </span>
                  <span>{source.chunks} 个片段</span>
                  {source.stale && <span className="kb-stale">待同步</span>}
                </div>
              </div>
              <div className="blog-row__actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busyId === source.post_id}
                  onClick={() => sync(source.post_id)}
                >
                  重新同步
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busyId === source.post_id}
                  onClick={() => remove(source.post_id)}
                >
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel panel-full card">
        <div className="kb-section__head">
          <h2 className="kb-section__title">添加文章</h2>
          <input
            type="search"
            className="kb-search"
            placeholder="搜索标题…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {candidates.length === 0 && (
          <p className="blog-empty">没有可添加的文章。</p>
        )}
        <div className="blog-manage-list">
          {candidates.map((item) => {
            const tag = VISIBILITY_TAGS[item.visibility] || VISIBILITY_TAGS.draft;
            return (
              <div key={item.post_id} className="blog-row">
                <div className="blog-row__main">
                  <Link
                    href={`/blog/post?id=${item.post_id}`}
                    className="blog-row__title"
                  >
                    {item.title}
                  </Link>
                  <div className="blog-row__meta">
                    <span className="blog-author">
                      <Avatar
                        name={item.author.username}
                        src={item.author.avatar}
                        size={20}
                      />
                      {item.author.username}
                    </span>
                    <span className={"blog-tag " + tag.className}>{tag.text}</span>
                  </div>
                </div>
                <div className="blog-row__actions">
                  <button
                    type="button"
                    className={"btn " + (item.in_kb ? "btn-outline" : "btn-primary")}
                    disabled={item.in_kb || busyId === item.post_id}
                    onClick={() => add(item.post_id)}
                  >
                    {item.in_kb ? "已加入" : "加入"}
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
