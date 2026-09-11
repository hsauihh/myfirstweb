// 个人知识库接口封装：来源列表、候选文章、增删与同步。
import { apiError } from "./apiError.js";

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

export function listSources() {
  return request("/api/kb/sources");
}

export function listCandidates(query = "", limit = 20, offset = 0) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
  });
  return request(`/api/kb/candidates?${params.toString()}`);
}

export function addSource(postId) {
  return request(
    "/api/kb/sources",
    json({ method: "POST", body: JSON.stringify({ post_id: postId }) })
  );
}

export function removeSource(postId) {
  return request(`/api/kb/sources/${postId}`, { method: "DELETE" });
}

export function syncSource(postId) {
  return request(`/api/kb/sources/${postId}/sync`, { method: "POST" });
}
