// 聊天接口封装：会话 CRUD + SSE 流式解析。
// 所有请求都带 credentials，让后端的 session_id Cookie 生效。
import { apiError } from "./apiError.js";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw apiError(body, `请求失败：${res.status}`);
  }
  return res.json();
}

export function listConversations() {
  return request("/api/chat/conversations");
}

export function createConversation() {
  return request("/api/chat/conversations", { method: "POST" });
}

export function listMessages(conversationId) {
  return request(`/api/chat/conversations/${conversationId}/messages`);
}

export function deleteConversation(conversationId) {
  return request(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
}

// 发送消息并消费 SSE 流：onDelta 收到每个文本增量，返回 done 事件的数据。
export async function streamChat(
  conversationId,
  content,
  { onDelta, signal, useRag = false } = {}
) {
  const res = await fetch(
    `${API}/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, use_rag: useRag }),
      signal,
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw apiError(body, `发送失败：${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = null;

  while (true) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 以空行分隔事件，最后一段可能不完整，留到下一轮
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop();
    for (const block of blocks) {
      const event = parseEvent(block);
      if (!event) continue;
      if (event.name === "delta") {
        onDelta?.(event.data.text);
      } else if (event.name === "done") {
        done = event.data;
      } else if (event.name === "error") {
        await reader.cancel();
        throw new Error(event.data.detail);
      }
    }
  }
  return done;
}

function parseEvent(block) {
  const fields = {};
  for (const line of block.split("\n")) {
    const index = line.indexOf(": ");
    if (index === -1) continue;
    fields[line.slice(0, index)] = line.slice(index + 2);
  }
  if (!fields.event || !fields.data) return null;
  return { name: fields.event, data: JSON.parse(fields.data) };
}
