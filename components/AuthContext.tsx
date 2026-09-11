"use client";

// 全站登录态：挂载时拉 /api/auth/me，暴露 user / quota 与注册、登录、登出。
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import * as authApi from "./authApi";
import { errorMessage } from "./apiError";
import type { AuthPayload, PublicUser, Quota } from "./types";

export interface AuthContextValue {
  user: PublicUser | null;
  quota: Quota | null;
  ragQuota: Quota | null;
  loading: boolean;
  error: string;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  refresh: () => Promise<void>;
  applyQuota: (value: Quota | null | undefined) => void;
  setQuota: Dispatch<SetStateAction<Quota | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [ragQuota, setRagQuota] = useState<Quota | null>(null);
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
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAuth = useCallback((data: AuthPayload) => {
    setUser(data.user);
    setQuota(data.quota);
    setRagQuota(data.rag_quota);
    setError("");
  }, []);

  // 流式回复结束时把新额度写回：知识库额度与普通额度分开更新
  const applyQuota = useCallback((value: Quota | null | undefined) => {
    if (value?.scope === "rag_daily") setRagQuota(value);
    else setQuota(value ?? null);
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      applyAuth(await authApi.register(username, password));
    },
    [applyAuth]
  );

  const login = useCallback(
    async (username: string, password: string) => {
      applyAuth(await authApi.login(username, password));
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    await refresh(); // 取回匿名额度
  }, [refresh]);

  const uploadAvatar = useCallback(async (file: File) => {
    const data = await authApi.uploadAvatar(file);
    // 上传头像的返回不含 is_admin，这里按后端返回原样写入
    setUser(data.user);
  }, []);

  const value: AuthContextValue = {
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

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return value;
}
