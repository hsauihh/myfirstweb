"use client";

// 消息提醒开关：只控制导航栏「消息」右上角的红点，按设备记忆（localStorage）。
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "message-reminder";

export default function useMessageReminder() {
  const [reminderEnabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabled(stored === "true");
    } catch {
      // 隐私模式下 localStorage 不可用，保持默认开启
    }
  }, []);

  const setReminderEnabled = useCallback((value) => {
    setEnabled(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // 忽略持久化失败
    }
  }, []);

  return { reminderEnabled, setReminderEnabled };
}
