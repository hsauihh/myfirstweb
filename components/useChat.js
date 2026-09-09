"use client";

// 聊天的状态与动作：会话列表、当前会话消息、发送/停止。
// 界面组件只管画，这里管数据流转。
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  streamChat,
} from "./chatApi.js";

function upsertConversation(list, conversation) {
  return [conversation, ...list.filter((item) => item.id !== conversation.id)];
}

export default function useChat({ onQuota } = {}) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const localIdRef = useRef(0);

  const nextLocalId = useCallback(() => {
    localIdRef.current += 1;
    return `local-${localIdRef.current}`;
  }, []);

  const appendMessage = useCallback(
    (role, content) => {
      setMessages((prev) => [...prev, { id: nextLocalId(), role, content }]);
    },
    [nextLocalId]
  );

  const selectConversation = useCallback(async (id) => {
    setActiveId(id);
    setStreamingText("");
    setError("");
    try {
      setMessages(await listMessages(id));
    } catch (err) {
      setMessages([]);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const items = await listConversations();
        setConversations(items);
        if (items.length > 0) await selectConversation(items[0].id);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [selectConversation]);

  const newConversation = useCallback(async () => {
    setError("");
    try {
      const conversation = await createConversation();
      setConversations((prev) => upsertConversation(prev, conversation));
      setActiveId(conversation.id);
      setMessages([]);
      setStreamingText("");
      return conversation.id;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const removeConversation = useCallback(
    async (id) => {
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
        setError(err.message);
      }
    },
    [conversations, activeId, selectConversation]
  );

  const resyncMessages = useCallback(async (id) => {
    try {
      setMessages(await listMessages(id));
    } catch {
      // 后端不可用时保持现状
    }
  }, []);

  // 流正常结束时：追加服务端消息、刷新会话（标题/排序）
  const applyResult = useCallback((result) => {
    if (result?.message) setMessages((prev) => [...prev, result.message]);
    if (result?.conversation) {
      setConversations((prev) => upsertConversation(prev, result.conversation));
    }
  }, []);

  // 流出错时：有产出就保留本地文本，否则以后端为准
  const handleStreamError = useCallback(
    async (err, conversationId, reply) => {
      if (err.name !== "AbortError") setError(err.message);
      if (reply) {
        appendMessage("assistant", reply);
        return;
      }
      await resyncMessages(conversationId);
    },
    [appendMessage, resyncMessages]
  );

  const send = useCallback(
    async (text, useRag = false) => {
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
          signal: controller.signal,
          useRag,
          onDelta: (delta) => {
            reply += delta;
            setStreamingText(reply);
          },
        });
        applyResult(result);
        onQuota?.(result?.quota ?? null);
      } catch (err) {
        if (err.quota) onQuota?.(err.quota);
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
    stop,
  };
}
