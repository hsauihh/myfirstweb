// 认证接口封装：当前用户、注册、登录、登出。
import { apiRequest, jsonRequest } from "./apiRequest";
import type { AuthPayload, PublicUser } from "./types";

export function fetchMe() {
  return apiRequest<AuthPayload>("/api/auth/me");
}

export function register(username: string, password: string) {
  return apiRequest<AuthPayload>(
    "/api/auth/register",
    jsonRequest({ method: "POST", body: JSON.stringify({ username, password }) })
  );
}

export function login(username: string, password: string) {
  return apiRequest<AuthPayload>(
    "/api/auth/login",
    jsonRequest({ method: "POST", body: JSON.stringify({ username, password }) })
  );
}

export function logout() {
  return apiRequest<{ ok: boolean }>("/api/auth/session", { method: "DELETE" });
}

/** 注意：这个返回里没有 is_admin（后端只回 public_user）。 */
export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<{ user: PublicUser }>("/api/auth/avatar", {
    method: "POST",
    body: form,
  });
}
