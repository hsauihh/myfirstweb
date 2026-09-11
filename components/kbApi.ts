// 个人知识库接口封装：来源列表、候选文章、增删与同步。
import { apiRequest, jsonRequest } from "./apiRequest";
import type { KbCandidatesResponse, KbSource, KbSourcesResponse } from "./types";

export function listSources() {
  return apiRequest<KbSourcesResponse>("/api/kb/sources");
}

export function listCandidates(query = "", limit = 20, offset = 0) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
  });
  return apiRequest<KbCandidatesResponse>(`/api/kb/candidates?${params.toString()}`);
}

export function addSource(postId: number | string) {
  return apiRequest<{ source: KbSource; created: boolean }>(
    "/api/kb/sources",
    jsonRequest({ method: "POST", body: JSON.stringify({ post_id: postId }) })
  );
}

export function removeSource(postId: number | string) {
  return apiRequest<{ deleted: number }>(`/api/kb/sources/${postId}`, {
    method: "DELETE",
  });
}

export function syncSource(postId: number | string) {
  return apiRequest<{ source: KbSource }>(`/api/kb/sources/${postId}/sync`, {
    method: "POST",
  });
}
