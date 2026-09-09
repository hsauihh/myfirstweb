// 知识库接口封装。
import { apiError } from "./apiError.js";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(body, `请求失败：${res.status}`);
  return body;
}

export function ragStatus() {
  return request("/api/rag/status");
}
