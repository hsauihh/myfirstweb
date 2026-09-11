"use client";

// 头像 VIP 标识开关：按设备记忆（localStorage），默认开。
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vip-badge";

export default function useVipBadge() {
  const [vipBadgeEnabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabled(stored === "true");
    } catch {
      // 隐私模式下 localStorage 不可用，保持默认开启
    }
  }, []);

  const setVipBadgeEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // 忽略持久化失败
    }
  }, []);

  return { vipBadgeEnabled, setVipBadgeEnabled };
}
