// 认证接口封装：当前用户、注册、登录、登出。
import { apiError } from "./apiError.js";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(body, `请求失败：${res.status}`);
  return body;
}

export function fetchMe() {
  return request("/api/auth/me");
}

export function register(username, password) {
  return request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function login(username, password) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return request("/api/auth/session", { method: "DELETE" });
}
