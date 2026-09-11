// 公告接口封装：列表与标记已读。
import { apiRequest } from "./apiRequest";
import type { AnnouncementsResponse, ReadResult } from "./types";

export function listAnnouncements() {
  return apiRequest<AnnouncementsResponse>("/api/announcements");
}

export function markAnnouncementRead(announcementId: number | string) {
  return apiRequest<ReadResult>(`/api/announcements/${announcementId}/read`, {
    method: "POST",
  });
}
