// 好友接口封装：好友、申请、好友码、私聊消息。
import { apiError } from "./apiError.js";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(body, `请求失败：${res.status}`);
  return body;
}

export function listFriends() {
  return request("/api/friends");
}

export function listRequests() {
  return request("/api/friends/requests");
}

export function myCode() {
  return request("/api/friends/me/code");
}

export function lookup({ username, code }) {
  const params = new URLSearchParams();
  if (username) params.set("username", username);
  if (code) params.set("code", code);
  return request(`/api/friends/lookup?${params}`);
}

export function sendRequest({ username, code }) {
  return request("/api/friends/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, code }),
  });
}

export function acceptRequest(requestId) {
  return request(`/api/friends/requests/${requestId}/accept`, { method: "POST" });
}

export function deleteRequest(requestId) {
  return request(`/api/friends/requests/${requestId}`, { method: "DELETE" });
}

export function removeFriend(friendId) {
  return request(`/api/friends/${friendId}`, { method: "DELETE" });
}

export function listMessages(friendId, { before, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", String(before));
  return request(`/api/friends/${friendId}/messages?${params}`);
}

export function sendMessage(friendId, content) {
  return request(`/api/friends/${friendId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export function markRead(friendId) {
  return request(`/api/friends/${friendId}/read`, { method: "POST" });
}

export function clearConversation(friendId) {
  return request(`/api/friends/${friendId}/messages`, { method: "DELETE" });
}

export function clearAllMessages() {
  return request("/api/friends/messages", { method: "DELETE" });
}
