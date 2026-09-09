"use client";

// 好友 WebSocket：连接、事件分发、断线重连（3 秒起指数退避到 30 秒）。
import { useEffect, useRef } from "react";

const WS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/^http/, "ws");
const PING_INTERVAL_MS = 30000;
const BASE_RETRY_MS = 3000;
const MAX_RETRY_MS = 30000;

export default function useFriendSocket({ enabled, onEvent, onReconnect }) {
  const handlersRef = useRef({ onEvent, onReconnect });

  useEffect(() => {
    handlersRef.current = { onEvent, onReconnect };
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let socket = null;
    let closed = false;
    let retry = 0;
    let pingTimer = null;
    let retryTimer = null;

    function clearTimers() {
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
    }

    function connect() {
      socket = new WebSocket(`${WS_BASE}/ws/friends`);

      socket.onopen = () => {
        retry = 0;
        handlersRef.current.onReconnect?.();
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        try {
          handlersRef.current.onEvent?.(JSON.parse(event.data));
        } catch {
          // 忽略非 JSON 消息
        }
      };

      socket.onclose = () => {
        clearInterval(pingTimer);
        if (closed) return;
        const delay = Math.min(BASE_RETRY_MS * 2 ** retry, MAX_RETRY_MS);
        retry += 1;
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => socket?.close();
    }

    connect();
    return () => {
      closed = true;
      clearTimers();
      socket?.close();
    };
  }, [enabled]);
}
