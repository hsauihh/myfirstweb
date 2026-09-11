"use client";

// 公告状态：列表、未读数、标记已读，以及 WebSocket 新公告事件。
import { useCallback, useEffect, useState } from "react";
import * as api from "./announcementsApi";
import { errorMessage } from "./apiError";
import type { Announcement, FriendSocketEvent } from "./types";

interface AnnouncementsOptions {
  enabled?: boolean;
}

export default function useAnnouncements({ enabled = true }: AnnouncementsOptions = {}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await api.listAnnouncements();
      setItems(data.items);
      setUnreadCount(data.unread);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  const markRead = useCallback(async (announcementId: number) => {
    try {
      const data = await api.markAnnouncementRead(announcementId);
      setUnreadCount(data.unread);
      setItems((prev) =>
        prev.map((item) =>
          item.id === announcementId ? { ...item, read: true } : item
        )
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  const applyEvent = useCallback((event: FriendSocketEvent) => {
    if (event.type !== "announcement") return;
    setItems((prev) => [{ ...event.announcement, read: false }, ...prev]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  return { items, unreadCount, error, refresh, markRead, applyEvent };
}
