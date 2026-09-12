// 公告接口封装：列表（含首页用的公开只读列表）与标记已读。
import { apiRequest } from "./apiRequest";
import type {
  AnnouncementsResponse,
  PublicAnnouncementsResponse,
  ReadResult,
} from "./types";

export function listAnnouncements() {
  return apiRequest<AnnouncementsResponse>("/api/announcements");
}

/** 首页公告栗：公开只读，不需要登录。 */
export function listPublicAnnouncements(limit = 4) {
  return apiRequest<PublicAnnouncementsResponse>(
    `/api/announcements/public?limit=${limit}`
  );
}

export function markAnnouncementRead(announcementId: number | string) {
  return apiRequest<ReadResult>(`/api/announcements/${announcementId}/read`, {
    method: "POST",
  });
}
