"use client";

// 全站消息状态：好友、公告、WebSocket 与提醒开关。
// 导航栏红点、消息中心各面板都从这里取数据，保证只有一份连接与状态。
import { createContext, useCallback, useContext, useState } from "react";
import { useAuth } from "./AuthContext";
import useAnnouncements from "./useAnnouncements";
import useFriendSocket from "./useFriendSocket";
import useFriends from "./useFriends";
import useMessageReminder from "./useMessageReminder";
import useVipBadge from "./useVipBadge";

const MessagesContext = createContext(null);

export function MessagesProvider({ children }) {
  const { user } = useAuth();
  const friends = useFriends({ enabled: Boolean(user) });
  const announcements = useAnnouncements({ enabled: Boolean(user) });
  const { reminderEnabled, setReminderEnabled } = useMessageReminder();
  const { vipBadgeEnabled, setVipBadgeEnabled } = useVipBadge();
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [presetCode, setPresetCode] = useState("");

  const handleEvent = useCallback(
    (event) => {
      friends.handleSocketEvent(event);
      announcements.applyEvent(event);
    },
    [friends.handleSocketEvent, announcements.applyEvent]
  );

  const handleReconnect = useCallback(() => {
    friends.resync();
    announcements.refresh();
  }, [friends.resync, announcements.refresh]);

  useFriendSocket({
    enabled: Boolean(user),
    onEvent: handleEvent,
    onReconnect: handleReconnect,
  });

  const openAddFriend = useCallback((code = "") => {
    setPresetCode(code);
    setAddFriendOpen(true);
  }, []);

  const closeAddFriend = useCallback(() => setAddFriendOpen(false), []);

  const notificationCount =
    friends.requests.incoming.length + announcements.unreadCount;
  const totalUnread = friends.chatUnread + notificationCount;

  const value = {
    ...friends,
    announcements: announcements.items,
    announcementUnread: announcements.unreadCount,
    announcementError: announcements.error,
    markAnnouncementRead: announcements.markRead,
    notificationCount,
    totalUnread,
    reminderEnabled,
    setReminderEnabled,
    vipBadgeEnabled,
    setVipBadgeEnabled,
    addFriendOpen,
    presetCode,
    openAddFriend,
    closeAddFriend,
  };

  return (
    <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
  );
}

export function useMessages() {
  const value = useContext(MessagesContext);
  if (value === null) {
    throw new Error("useMessages 必须在 MessagesProvider 内使用");
  }
  return value;
}
