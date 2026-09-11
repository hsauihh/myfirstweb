// 博客接口封装：公开列表/详情、我的文章增删改、点赞。
import { apiError } from "./apiError";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(body, `请求失败：${res.status}`);
  return body;
}

function json(options) {
  return { ...options, headers: { "Content-Type": "application/json" } };
}

export function listPosts(offset = 0, limit = 10, sort = "published") {
  return request(`/api/blog/posts?limit=${limit}&offset=${offset}&sort=${sort}`);
}

export function getPost(postId) {
  return request(`/api/blog/posts/${postId}`);
}

export function listMyPosts(offset = 0, limit = 50) {
  return request(`/api/blog/me/posts?limit=${limit}&offset=${offset}`);
}

export function createPost(payload) {
  return request("/api/blog/posts", json({ method: "POST", body: JSON.stringify(payload) }));
}

export function updatePost(postId, payload) {
  return request(
    `/api/blog/posts/${postId}`,
    json({ method: "PATCH", body: JSON.stringify(payload) })
  );
}

export function deletePost(postId) {
  return request(`/api/blog/posts/${postId}`, { method: "DELETE" });
}

export function toggleLike(postId) {
  return request(`/api/blog/posts/${postId}/like`, { method: "POST" });
}
