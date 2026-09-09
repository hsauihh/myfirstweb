"use client";

// 全站消息状态：好友列表、申请、当前会话、WebSocket 与提醒开关。
// 导航栏红点、消息中心各面板都从这里取数据，保证只有一份连接与状态。
import { createContext, useCallback, useContext, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import useFriendSocket from "./useFriendSocket.js";
import useFriends from "./useFriends.js";
import useMessageReminder from "./useMessageReminder.js";

const MessagesContext = createContext(null);

export function MessagesProvider({ children }) {
  const { user } = useAuth();
  const friends = useFriends({ enabled: Boolean(user) });
  const { reminderEnabled, setReminderEnabled } = useMessageReminder();
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [presetCode, setPresetCode] = useState("");

  useFriendSocket({
    enabled: Boolean(user),
    onEvent: friends.handleSocketEvent,
    onReconnect: friends.resync,
  });

  const openAddFriend = useCallback((code = "") => {
    setPresetCode(code);
    setAddFriendOpen(true);
  }, []);

  const closeAddFriend = useCallback(() => setAddFriendOpen(false), []);

  const value = {
    ...friends,
    reminderEnabled,
    setReminderEnabled,
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
