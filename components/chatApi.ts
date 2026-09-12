// 聊天接口封装：会话 CRUD + SSE 流式解析。
// 所有请求都带 credentials，让后端的 session_id Cookie 生效。
import { ApiError, apiError } from "./apiError";
import { API, apiRequest } from "./apiRequest";
import type {
  ChatMessage,
  ChatStreamEvent,
  Conversation,
  ConversationKind,
  Quota,
  RagMode,
} from "./types";

export function listConversations(kind: ConversationKind = "chat") {
  return apiRequest<Conversation[]>(`/api/chat/conversations?kind=${kind}`);
}

export function createConversation(kind: ConversationKind = "chat") {
  return apiRequest<Conversation>(`/api/chat/conversations?kind=${kind}`, {
    method: "POST",
  });
}

export function listMessages(conversationId: number | string) {
  return apiRequest<ChatMessage[]>(`/api/chat/conversations/${conversationId}/messages`);
}

export function deleteConversation(conversationId: number | string) {
  return apiRequest<{ deleted: number }>(`/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

/** 流正常结束时 done 事件里的数据。 */
export interface ChatStreamResult {
  message: ChatMessage;
  conversation: Conversation;
  quota: Quota | null;
}

export interface StreamChatOptions {
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
  /** qa 单轮问答 / context 多轮；includeSystem 控制是否检索站内公共库。 */
  mode?: RagMode;
  includeSystem?: boolean;
}

// 发送消息并消费 SSE 流：onDelta 收到每个文本增量，返回 done 事件的数据。
export async function streamChat(
  conversationId: number | string,
  content: string,
  { onDelta, signal, mode = "qa", includeSystem = true }: StreamChatOptions = {}
): Promise<ChatStreamResult | null> {
  const res = await fetch(
    `${API}/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, mode, include_system: includeSystem }),
      signal,
    }
  );
  return consumeStream(res, { onDelta }, `发送失败：${res.status}`);
}

/**
 * 重新生成最后一条回复：后端会删掉旧回复并按原问题重跑（额度与发送一致）。
 * 返回的 done 数据与发送相同，只是它是替换而非追加。
 */
export async function regenerateChat(
  conversationId: number | string,
  { onDelta, signal, mode = "qa", includeSystem = true }: StreamChatOptions = {}
): Promise<ChatStreamResult | null> {
  const res = await fetch(
    `${API}/api/chat/conversations/${conversationId}/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mode, include_system: includeSystem }),
      signal,
    }
  );
  return consumeStream(res, { onDelta }, `重新生成失败：${res.status}`);
}

/** 两个流式接口共用：校验响应、解析 SSE、只在 done 时返回数据。 */
async function consumeStream(
  res: Response,
  { onDelta }: Pick<StreamChatOptions, "onDelta">,
  fallbackMessage: string
): Promise<ChatStreamResult | null> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw apiError(body, fallbackMessage);
  }
  if (!res.body) throw new ApiError("响应没有可读的数据流");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: ChatStreamResult | null = null;

  while (true) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 以空行分隔事件，最后一段可能不完整，留到下一轮
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
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

function parseEvent(block: string): ChatStreamEvent | null {
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const index = line.indexOf(": ");
    if (index === -1) continue;
    fields[line.slice(0, index)] = line.slice(index + 2);
  }
  if (!fields.event || !fields.data) return null;
  // 与 apiRequest 同一取舍：SSE 载荷按声明的事件联合类型断言，不做运行时校验
  return { name: fields.event, data: JSON.parse(fields.data) } as ChatStreamEvent;
}
