// 好友接口封装：好友、申请、好友码、私聊消息。
import { apiRequest, jsonRequest } from "./apiRequest";
import type {
  DirectMessage,
  DirectMessagePage,
  Friend,
  FriendLookup,
  FriendRequestResult,
  FriendRequests,
  PublicUser,
} from "./types";

export function listFriends() {
  return apiRequest<Friend[]>("/api/friends");
}

export function listRequests() {
  return apiRequest<FriendRequests>("/api/friends/requests");
}

export function myCode() {
  return apiRequest<{ code: string }>("/api/friends/me/code");
}

export function lookup(params: { username?: string; code?: string }) {
  const search = new URLSearchParams();
  if (params.username) search.set("username", params.username);
  if (params.code) search.set("code", params.code);
  return apiRequest<FriendLookup>(`/api/friends/lookup?${search}`);
}

export function sendRequest(payload: { username?: string; code?: string }) {
  return apiRequest<FriendRequestResult>(
    "/api/friends/requests",
    jsonRequest({ method: "POST", body: JSON.stringify(payload) })
  );
}

export function acceptRequest(requestId: number | string) {
  return apiRequest<{ friend: PublicUser }>(`/api/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
}

export function deleteRequest(requestId: number | string) {
  return apiRequest<{ ok: boolean }>(`/api/friends/requests/${requestId}`, {
    method: "DELETE",
  });
}

export function removeFriend(friendId: number | string) {
  return apiRequest<{ ok: boolean; deleted_messages: number }>(
    `/api/friends/${friendId}`,
    { method: "DELETE" }
  );
}

export function listMessages(
  friendId: number | string,
  { before, limit = 50 }: { before?: number; limit?: number } = {}
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", String(before));
  return apiRequest<DirectMessagePage>(`/api/friends/${friendId}/messages?${params}`);
}

export function sendMessage(friendId: number | string, content: string) {
  return apiRequest<{ message: DirectMessage }>(
    `/api/friends/${friendId}/messages`,
    jsonRequest({ method: "POST", body: JSON.stringify({ content }) })
  );
}

export function markRead(friendId: number | string) {
  return apiRequest<{ read: number }>(`/api/friends/${friendId}/read`, {
    method: "POST",
  });
}

export function clearConversation(friendId: number | string) {
  return apiRequest<{ deleted: number }>(`/api/friends/${friendId}/messages`, {
    method: "DELETE",
  });
}

export function clearAllMessages() {
  return apiRequest<{ deleted: number }>("/api/friends/messages", { method: "DELETE" });
}
