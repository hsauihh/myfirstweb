// 个人知识库接口封装：来源列表、候选文章、增删与同步，以及随心一记的笔记。
import { apiRequest, jsonRequest } from "./apiRequest";
import type {
  KbCandidatesResponse,
  KbNote,
  KbNotesResponse,
  KbSource,
  KbSourcesResponse,
} from "./types";

/** 与后端 kb.NOTE_MAX_LENGTH 一致（前端只用于计数与限长提示）。 */
export const NOTE_MAX_LENGTH = 500;

export const NOTE_PAGE_SIZE = 30;

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

export function listNotes(limit = NOTE_PAGE_SIZE, offset = 0) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return apiRequest<KbNotesResponse>(`/api/kb/notes?${params.toString()}`);
}

export function addNote(content: string) {
  return apiRequest<{ note: KbNote; created: boolean }>(
    "/api/kb/notes",
    jsonRequest({ method: "POST", body: JSON.stringify({ content }) })
  );
}

export function removeNote(noteId: number | string) {
  return apiRequest<{ deleted: number }>(`/api/kb/notes/${noteId}`, {
    method: "DELETE",
  });
}
