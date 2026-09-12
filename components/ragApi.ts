// 知识库接口封装。
import { apiRequest } from "./apiRequest";
import type { RagGraph, RagGraphEntity, RagStatus } from "./types";

export function ragStatus() {
  return apiRequest<RagStatus>("/api/rag/status");
}

export function ragGraph() {
  return apiRequest<RagGraph>("/api/rag/graph");
}

export function ragGraphEntity(entityId: number) {
  return apiRequest<RagGraphEntity>(`/api/rag/graph/entities/${entityId}`);
}
