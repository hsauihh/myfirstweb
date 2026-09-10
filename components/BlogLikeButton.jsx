"use client";

// 点赞按钮：登录用户每人每篇一次、可取消；未登录点击去登录。
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import * as blogApi from "./blogApi.js";

export default function BlogLikeButton({ postId, count, liked }) {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState({ count, liked });
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const data = await blogApi.toggleLike(postId);
      setState({ count: data.like_count, liked: data.liked });
    } catch {
      // 失败时保持原状态，不打断阅读
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={"blog-like" + (state.liked ? " is-liked" : "")}
      aria-pressed={state.liked}
      aria-label={state.liked ? "取消点赞" : "点赞"}
      disabled={busy}
      onClick={onClick}
    >
      <span aria-hidden="true">{state.liked ? "♥" : "♡"}</span>
      <span>{state.count}</span>
    </button>
  );
}
