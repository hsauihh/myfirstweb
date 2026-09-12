"use client";

// 聊天的状态与动作：会话列表、当前会话消息、发送/停止。
// 界面组件只管画，这里管数据流转。
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "./apiError";
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  regenerateChat,
  streamChat,
  type StreamChatOptions,
} from "./chatApi";
import type { ChatMessage, Conversation, ConversationKind, Quota } from "./types";

function upsertConversation(list: Conversation[], conversation: Conversation) {
  return [conversation, ...list.filter((item) => item.id !== conversation.id)];
}

interface UseChatOptions {
  kind?: ConversationKind;
  onQuota?: (quota: Quota | null) => void;
}

export default function useChat({ kind = "chat", onQuota }: UseChatOptions = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const localIdRef = useRef(0);

  const nextLocalId = useCallback(() => {
    localIdRef.current += 1;
    return `local-${localIdRef.current}`;
  }, []);

  const appendMessage = useCallback(
    (role: ChatMessage["role"], content: string) => {
      setMessages((prev) => [...prev, { id: nextLocalId(), role, content }]);
    },
    [nextLocalId]
  );

  const selectConversation = useCallback(async (id: number) => {
    setActiveId(id);
    setStreamingText("");
    setError("");
    try {
      setMessages(await listMessages(id));
    } catch (err) {
      setMessages([]);
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const items = await listConversations(kind);
        setConversations(items);
        if (items.length > 0) await selectConversation(items[0].id);
      } catch (err) {
        setError(errorMessage(err));
      }
    }
    load();
  }, [selectConversation, kind]);

  const newConversation = useCallback(async () => {
    setError("");
    try {
      const conversation = await createConversation(kind);
      setConversations((prev) => upsertConversation(prev, conversation));
      setActiveId(conversation.id);
      setMessages([]);
      setStreamingText("");
      return conversation.id;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    }
  }, [kind]);

  const removeConversation = useCallback(
    async (id: number) => {
      try {
        await deleteConversation(id);
        const remaining = conversations.filter((item) => item.id !== id);
        setConversations(remaining);
        if (activeId !== id) return;
        if (remaining.length > 0) await selectConversation(remaining[0].id);
        else {
          setActiveId(null);
          setMessages([]);
        }
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [conversations, activeId, selectConversation]
  );

  const resyncMessages = useCallback(async (id: number) => {
    try {
      setMessages(await listMessages(id));
    } catch {
      // 后端不可用时保持现状
    }
  }, []);

  // 流正常结束时：追加服务端消息、刷新会话（标题/排序）
  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof streamChat>>) => {
      if (result?.message) setMessages((prev) => [...prev, result.message]);
      if (result?.conversation) {
        setConversations((prev) => upsertConversation(prev, result.conversation));
      }
    },
    []
  );

  // 流出错时：有产出就保留本地文本，否则以后端为准
  const handleStreamError = useCallback(
    async (err: unknown, conversationId: number, reply: string) => {
      if (!(err instanceof Error) || err.name !== "AbortError") {
        setError(errorMessage(err));
      }
      if (reply) {
        appendMessage("assistant", reply);
        return;
      }
      await resyncMessages(conversationId);
    },
    [appendMessage, resyncMessages]
  );

  const send = useCallback(
    async (text: string, options: StreamChatOptions = {}) => {
      const content = text.trim();
      if (!content || sending) return;

      let targetId = activeId;
      if (targetId === null) {
        targetId = await newConversation();
        if (targetId === null) return;
      }

      setError("");
      setSending(true);
      setStreamingText("");
      appendMessage("user", content);

      const controller = new AbortController();
      abortRef.current = controller;
      let reply = "";

      try {
        const result = await streamChat(targetId, content, {
          ...options,
          signal: controller.signal,
          onDelta: (delta) => {
            reply += delta;
            setStreamingText(reply);
          },
        });
        applyResult(result);
        onQuota?.(result?.quota ?? null);
      } catch (err) {
        if (err instanceof ApiError && err.quota) onQuota?.(err.quota);
        await handleStreamError(err, targetId, reply);
      } finally {
        setStreamingText("");
        setSending(false);
        abortRef.current = null;
      }
    },
    [activeId, sending, newConversation, appendMessage, applyResult, handleStreamError, onQuota]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 重新生成最后一条回复：后端会替换掉旧回复，所以结束后按服务端重拉一次消息
  const regenerate = useCallback(
    async (options: StreamChatOptions = {}) => {
      const targetId = activeId;
      if (targetId === null || sending) return;

      setError("");
      setSending(true);
      setStreamingText("");
      // 旧回复立即从界面拿掉，避免流式内容叠在它下面
      setMessages((prev) =>
        prev.length > 0 && prev[prev.length - 1]!.role === "assistant"
          ? prev.slice(0, -1)
          : prev
      );

      const controller = new AbortController();
      abortRef.current = controller;
      let reply = "";

      try {
        const result = await regenerateChat(targetId, {
          ...options,
          signal: controller.signal,
          onDelta: (delta) => {
            reply += delta;
            setStreamingText(reply);
          },
        });
        if (result?.conversation) {
          setConversations((prev) => upsertConversation(prev, result.conversation!));
        }
        await resyncMessages(targetId);
        onQuota?.(result?.quota ?? null);
      } catch (err) {
        if (err instanceof ApiError && err.quota) onQuota?.(err.quota);
        if (!(err instanceof Error) || err.name !== "AbortError") {
          setError(errorMessage(err));
        }
        await resyncMessages(targetId);
      } finally {
        setStreamingText("");
        setSending(false);
        abortRef.current = null;
      }
    },
    [activeId, sending, resyncMessages, onQuota]
  );

  return {
    conversations,
    activeId,
    messages,
    streamingText,
    sending,
    error,
    newConversation,
    selectConversation,
    removeConversation,
    send,
    regenerate,
    stop,
  };
}
