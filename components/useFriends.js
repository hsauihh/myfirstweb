"use client";

// 好友页的状态与动作：好友列表、申请、当前会话消息、实时事件处理。
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./friendsApi.js";

function appendUnique(list, message) {
  if (list.some((item) => item.id === message.id)) return list;
  return [...list, message];
}

export default function useFriends({ enabled = true } = {}) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const activeIdRef = useRef(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const refresh = useCallback(async () => {
    try {
      const [friendList, requestList] = await Promise.all([
        api.listFriends(),
        api.listRequests(),
      ]);
      setFriends(friendList);
      setRequests(requestList);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setFriends([]);
      setRequests({ incoming: [], outgoing: [] });
      setActiveId(null);
      setMessages([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  const loadMessages = useCallback(async (id) => {
    try {
      const data = await api.listMessages(id);
      setMessages(data.messages);
      setHasMore(data.has_more);
      await api.markRead(id);
      setFriends((prev) =>
        prev.map((item) => (item.id === id ? { ...item, unread: 0 } : item))
      );
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const selectFriend = useCallback(
    async (id) => {
      setActiveId(id);
      setError("");
      await loadMessages(id);
    },
    [loadMessages]
  );

  const resync = useCallback(async () => {
    await refresh();
    if (activeIdRef.current !== null) await loadMessages(activeIdRef.current);
  }, [refresh, loadMessages]);

  const perform = useCallback(
    async (action) => {
      setError("");
      try {
        const result = await action();
        await refresh();
        return { ok: true, result };
      } catch (err) {
        setError(err.message);
        return { ok: false, message: err.message };
      }
    },
    [refresh]
  );

  const addFriend = useCallback(
    (payload) => perform(() => api.sendRequest(payload)),
    [perform]
  );

  const acceptRequest = useCallback(
    (id) => perform(() => api.acceptRequest(id)),
    [perform]
  );

  const deleteRequest = useCallback(
    (id) => perform(() => api.deleteRequest(id)),
    [perform]
  );

  const removeFriend = useCallback(
    async (id) => {
      const outcome = await perform(() => api.removeFriend(id));
      if (outcome.ok && activeIdRef.current === id) {
        setActiveId(null);
        setMessages([]);
        setHasMore(false);
      }
      return outcome;
    },
    [perform]
  );

  const send = useCallback(
    async (text) => {
      const content = text.trim();
      const targetId = activeIdRef.current;
      if (!content || targetId === null || sending) return;
      setSending(true);
      setError("");
      try {
        const { message } = await api.sendMessage(targetId, content);
        setMessages((prev) => appendUnique(prev, message));
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setSending(false);
      }
    },
    [sending, refresh]
  );

  const loadOlder = useCallback(async () => {
    const targetId = activeIdRef.current;
    if (targetId === null || !hasMore || messages.length === 0) return;
    try {
      const data = await api.listMessages(targetId, { before: messages[0].id });
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err.message);
    }
  }, [hasMore, messages]);

  const handleIncomingMessage = useCallback(
    (message) => {
      const active = activeIdRef.current;
      if (message.sender_id === active || message.recipient_id === active) {
        setMessages((prev) => appendUnique(prev, message));
        if (message.sender_id === active) api.markRead(active).catch(() => {});
      }
      refresh();
    },
    [refresh]
  );

  const handleSocketEvent = useCallback(
    (event) => {
      if (event.type === "message") {
        handleIncomingMessage(event.message);
        return;
      }
      if (event.type === "presence") {
        setFriends((prev) =>
          prev.map((item) =>
            item.id === event.user_id ? { ...item, online: event.online } : item
          )
        );
        return;
      }
      refresh();
    },
    [handleIncomingMessage, refresh]
  );

  const clearConversation = useCallback(
    async (friendId) => {
      const outcome = await perform(() => api.clearConversation(friendId));
      if (outcome.ok && activeIdRef.current === friendId) {
        setMessages([]);
        setHasMore(false);
      }
      return outcome;
    },
    [perform]
  );

  const clearAllConversations = useCallback(async () => {
    const outcome = await perform(() => api.clearAllMessages());
    if (outcome.ok) {
      setMessages([]);
      setHasMore(false);
    }
    return outcome;
  }, [perform]);

  const chatUnread = friends.reduce((sum, item) => sum + item.unread, 0);
  const totalUnread = chatUnread + requests.incoming.length;

  return {
    friends,
    requests,
    activeId,
    messages,
    hasMore,
    loading,
    sending,
    error,
    chatUnread,
    totalUnread,
    selectFriend,
    addFriend,
    acceptRequest,
    deleteRequest,
    removeFriend,
    send,
    loadOlder,
    clearConversation,
    clearAllConversations,
    handleSocketEvent,
    resync,
  };
}
