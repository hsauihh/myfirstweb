// 前端领域模型与接口 DTO 的唯一定义源。
//
// 字段逐个对照后端源码（backend/*.py）写明，不凭记忆：
// - 可空性是事实描述，不是愿望：例如 /api/auth/avatar 只返回 public_user、不带 is_admin，
//   所以 is_admin 标为可选；好友列表也不返回 online，它只由 WebSocket presence 事件补上。
// - 这里只声明前端真正用到的字段；后端多返回的字段不在此罗列。
// - 唯一的运行时未校验缝隙是 apiRequest 里的 `res.json() as T`（本次不引运行时校验库）。

export type Visibility = "draft" | "private" | "public";
export type ConversationKind = "chat" | "rag";
export type RagMode = "qa" | "context";
export type MessageRole = "user" | "assistant";
export type QuotaScope = "anonymous" | "daily" | "rag_daily";
export type OrderStatus = "pending" | "paid";
export type CitationKind = "post" | "public" | "note";
export type CitationVia = "vector" | "graph";

/** 最小用户信息（头像、好友、候选文章等处复用）。 */
export interface UserBrief {
  id: number;
  username: string;
  avatar: string | null;
}

/** public_user：登录态、文章作者、好友等处的完整用户结构。 */
export interface PublicUser extends UserBrief {
  vip: boolean;
  vip_expires_at: string | null;
  created_at: string;
  /** 只有 /api/auth/me 与注册/登录返回它；上传头像的返回里没有。 */
  is_admin?: boolean;
}

/** 好友申请里内嵌的用户（比 public_user 少 vip 字段）。 */
export interface RequestUser extends UserBrief {
  created_at: string;
}

export interface Quota {
  scope: QuotaScope;
  used: number;
  limit: number;
  remaining: number;
}

/** /api/auth/me、注册、登录的统一返回；VIP 的知识库额度为 null。 */
export interface AuthPayload {
  user: PublicUser | null;
  quota: Quota | null;
  rag_quota: Quota | null;
}

export interface AnalysisResult {
  text: string;
  score: number;
  label: string;
  pinyin: string;
  created_at: string;
}

export interface HistoryEntry extends AnalysisResult {
  id: number;
}

export interface Conversation {
  id: number;
  title: string;
  kind: ConversationKind;
  created_at: string;
  updated_at: string;
}

/** 一条来源引用；index 与正文里的 [n] 角标、以及上下文里的参考资料序号一致。 */
export interface Citation {
  index: number;
  kind: CitationKind;
  title: string;
  author: string | null;
  label: string;
  section: string;
  post_id: number | null;
  /** 随心一记的笔记来源 id（笔记没有网页可跳，用弹层展示片段）。 */
  note_id: number | null;
  snippet: string;
  score: number | null;
  via: CitationVia;
}

/** 聊天消息。本地乐观追加的消息用 `local-N` 字符串 id，且没有 sources。 */
export interface ChatMessage {
  id: number | string;
  role: MessageRole;
  content: string;
  sources?: Citation[] | null;
  created_at?: string;
}

// ---------- 博客 ----------

export interface BlogAuthor extends UserBrief {}

/** 列表卡片（/api/blog/posts、/api/blog/me/posts）。 */
export interface BlogCard {
  id: number;
  title: string;
  excerpt: string;
  author: BlogAuthor;
  visibility: Visibility;
  published_at: string | null;
  updated_at: string;
  like_count: number;
  liked_by_me: boolean;
}

/** 文章详情。in_kb 只在已登录时返回。 */
export interface BlogPostDetail {
  id: number;
  title: string;
  content: string;
  visibility: Visibility;
  author: BlogAuthor;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  like_count: number;
  liked_by_me: boolean;
  can_edit: boolean;
  in_kb?: boolean;
}

export interface BlogListResponse {
  items: BlogCard[];
  has_more: boolean;
}

/** 创建/更新文章返回的原始文章结构（后端 _post_payload，不含摘录与点赞）。 */
export interface PostRecord {
  id: number;
  author_id: number;
  title: string;
  content: string;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PostWritePayload {
  title?: string;
  content?: string;
  visibility?: Visibility;
}

export interface LikeResult {
  liked: boolean;
  like_count: number;
}

// ---------- 个人知识库 ----------

export interface KbSource {
  post_id: number;
  title: string;
  author: UserBrief;
  visibility: Visibility;
  chunks: number;
  added_at: string;
  stale: boolean;
}

export interface KbCandidate {
  post_id: number;
  title: string;
  author: UserBrief;
  visibility: Visibility;
  published_at: string | null;
  updated_at: string;
  in_kb: boolean;
}

export interface KbSourcesResponse {
  items: KbSource[];
  personal_documents: number;
  public_documents: number;
  ready: boolean;
}

export interface KbCandidatesResponse {
  items: KbCandidate[];
  has_more: boolean;
}

/** 随心一记的一条笔记（一句/一段自由文本，已入库可被问答检索）。 */
export interface KbNote {
  id: number;
  content: string;
  created_at: string;
  /** 入库片段数：正常为 1，未同步成功时为 0。 */
  chunks: number;
}

export interface KbNotesResponse {
  items: KbNote[];
  total: number;
  has_more: boolean;
}

export interface RagStatus {
  ready: boolean;
  documents: number;
  personal: number;
  public: number;
  entities: number;
  relations: number;
}

// ---------- 知识图谱 ----------

export interface RagGraphGroup {
  key: string;
  label: string;
  kind: "chapter" | "source";
  nodes: number;
}

export interface RagGraphNode {
  id: string;
  entity_id: number;
  name: string;
  kind: string;
  group: string;
  degree: number;
}

export interface RagGraphEdge {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface RagGraphStats {
  chunks: number;
  entities: number;
  relations: number;
  nodes: number;
  edges: number;
  truncated: boolean;
}

export interface RagGraph {
  groups: RagGraphGroup[];
  nodes: RagGraphNode[];
  edges: RagGraphEdge[];
  stats: RagGraphStats;
}

export interface RagGraphRelation {
  /** out = 概念是关系的起点，in = 概念是关系的终点。 */
  direction: "out" | "in";
  name: string;
  relation: string;
  weight: number;
}

export interface RagGraphChunk {
  kind: "post" | "public";
  label: string;
  title: string;
  author: string | null;
  post_id: number | null;
  section: string;
  snippet: string;
}

export interface RagGraphEntity {
  entity_id: number;
  name: string;
  kind: string;
  degree: number;
  groups: string[];
  relations: RagGraphRelation[];
  chunks: RagGraphChunk[];
}

// ---------- 好友与私聊 ----------

export interface Friend extends UserBrief {
  unread: number;
  last_message_at: string | null;
  last_message: string | null;
  last_message_sender_id: number | null;
  /** 只由 WebSocket presence 事件补上；首次加载时不存在（按离线展示）。 */
  online?: boolean;
}

export interface FriendRequest {
  id: number;
  created_at: string;
  user: RequestUser;
}

export interface FriendRequests {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  created_at: string;
  read_at: string | null;
}

export interface DirectMessagePage {
  messages: DirectMessage[];
  has_more: boolean;
}

export interface FriendLookup {
  user: UserBrief;
  relationship: string;
}

/** 发好友申请的返回：互发时直接成好友。 */
export type FriendRequestResult =
  | { status: "friends"; friend: PublicUser }
  | { status: "pending" };

// ---------- 公告与支付 ----------

export interface Announcement {
  id: number;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

export interface AnnouncementsResponse {
  items: Announcement[];
  unread: number;
}

/** 首页公告栗用的公开条目：没有已读状态（未读只对登录用户有意义）。 */
export type PublicAnnouncement = Omit<Announcement, "read">;

export interface PublicAnnouncementsResponse {
  items: PublicAnnouncement[];
}

/** WebSocket 新公告事件里的公告（刚创建，还没有 read 标记）。 */
export type AnnouncementDraft = Omit<Announcement, "read">;

export interface ReadResult {
  ok: boolean;
  unread: number;
}

export interface Order {
  id: number;
  product: string;
  amount_cents: number;
  status: OrderStatus;
  created_at: string;
  paid_at: string | null;
}

// ---------- 错误 ----------

/** 后端错误响应体；detail 可能是字符串或 FastAPI 校验错误数组。 */
export interface ApiErrorBody {
  detail?: string | { msg?: string }[];
  code?: string;
  quota?: Quota | null;
}

// ---------- 实时事件 ----------

/** 好友 WebSocket 事件（与后端 manager.send 的载荷一一对应）。
 *  未命中任何类型时前端只需拉起一次刷新；后端新增事件类型时在这里补一条即可。 */
export type FriendSocketEvent =
  | { type: "pong" }
  | { type: "ready"; user: PublicUser }
  | { type: "message"; message: DirectMessage }
  | { type: "presence"; user_id: number; online: boolean }
  | { type: "announcement"; announcement: AnnouncementDraft }
  | { type: "friend_request"; request: PushedFriendRequest }
  | { type: "friend_accepted"; friend: PublicUser }
  | { type: "friend_request_removed"; request_id: number }
  | { type: "friend_removed"; user_id: number };

/** 实时推送的好友申请（内嵌的是 public_user，与 REST 列表略有差别）。 */
export interface PushedFriendRequest {
  id: number;
  created_at: string;
  user: PublicUser;
}

/** 聊天 SSE 事件（chatApi 解析后）。 */
export type ChatStreamEvent =
  | { name: "delta"; data: { text: string } }
  | {
      name: "done";
      data: { message: ChatMessage; conversation: Conversation; quota: Quota | null };
    }
  | { name: "error"; data: { detail: string } };
