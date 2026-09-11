"use client";

// 全站登录态：挂载时拉 /api/auth/me，暴露 user / quota 与注册、登录、登出。
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authApi from "./authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [quota, setQuota] = useState(null);
  const [ragQuota, setRagQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.fetchMe();
      setUser(data.user);
      setQuota(data.quota);
      setRagQuota(data.rag_quota);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAuth = useCallback((data) => {
    setUser(data.user);
    setQuota(data.quota);
    setRagQuota(data.rag_quota);
    setError("");
  }, []);

  const applyQuota = useCallback((value) => {
    if (value?.scope === "rag_daily") setRagQuota(value);
    else setQuota(value);
  }, []);

  const register = useCallback(
    async (username, password) => {
      applyAuth(await authApi.register(username, password));
    },
    [applyAuth]
  );

  const login = useCallback(
    async (username, password) => {
      applyAuth(await authApi.login(username, password));
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    await refresh();          // 取回匿名额度
  }, [refresh]);

  const uploadAvatar = useCallback(async (file) => {
    const data = await authApi.uploadAvatar(file);
    setUser(data.user);
  }, []);

  const value = {
    user,
    quota,
    ragQuota,
    loading,
    error,
    register,
    login,
    logout,
    uploadAvatar,
    refresh,
    applyQuota,
    setQuota,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return value;
}
