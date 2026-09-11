// 知识库接口封装。
import { apiRequest } from "./apiRequest";
import type { RagStatus } from "./types";

export function ragStatus() {
  return apiRequest<RagStatus>("/api/rag/status");
}
