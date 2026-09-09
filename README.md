# zero-to-full · 零到全栈

个人主页 + 文字实验室 + 消息中心。文字实验室有「分析」和「AI 对话」两种模式，默认进入分析（分析页有引导条可一键切到 AI 对话）：AI 对话接 OpenAI 兼容接口、SSE 流式回复，会话与消息存 SQLite；分析模式做情感分析与拼音标注。账号用用户名 + 密码注册登录，匿名访客可免费聊 3 句，登录用户每天免费 20 条、登录后可上传头像；999 元/月开通「至尊无敌黄金VIP」不限量。AI 对话可开启「使用知识库」，基于本地 `RAGdata/` 资料回答（独立每天 5 条，VIP 不限量）。导航栏「消息」进入 `/messages` 消息中心：左侧导航（我的消息 / 系统通知 / 设置），中间会话列表，右侧微信式聊天窗口（REST 发送 + WebSocket 推送），带未读与在线状态；导航栏头像卡片悬停显示用户名、点击弹出添加好友，收到新消息时「消息」右上角显示红点（可在设置里关闭）。系统通知里可看公告（由独立脚本发布）与好友申请。主页内容由后端接口实时提供。前端 Next.js 与后端 FastAPI 独立运行，通过 HTTP / WebSocket 联调。

## 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Next.js 15（App Router）、React 19、animejs v4、react-markdown、WebSocket、手写 CSS |
| 后端 | Python ≥3.13、FastAPI、WebSocket、openai SDK、bcrypt、SnowNLP、pypinyin、SQLite、uv |

前端 `output: 'export'` 静态导出；animejs 用 v4 具名导入；中文字体霞鹜文楷 LXGW WenKai（简体，`css/fonts.css`）。

## 快速开始

后端(端口8001)

```bash
npm run back
```

前端（端口 3000）：

```bash
npm run dev
```

前端通过 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 定位后端（当前 `http://localhost:8001`）。构建：`npm run build`（产物在 `out/`，任意静态服务器托管；`next start` 与静态导出不兼容）。

## 公告发布

```bash
cd backend
uv run python announce.py notice.json                              # 默认推到 http://localhost:8001
uv run python announce.py notice.json --url http://localhost:8001   # 指定后端地址
```

`notice.json` 为 JSON 格式，`title` 必填、`body` 可选（`\n` 换行）：

```json
{ "title": "v1.3 更新公告", "body": "本次更新：\n- 头像支持裁剪" }
```

仓库自带模板 `backend/notice.json`，改完直接发布即可。密钥来自 `backend/.env` 的 `ANNOUNCE_KEY`（需自行填写随机字符串，未配置时发布接口返回 503）；发布后所有在线用户会在「系统通知 → 公告」实时看到。

## 知识库（RAG）

把 `.md` / `.txt` 放进项目根 `RAGdata/`，然后入库：

```bash
cd backend
uv run python ingest.py ../RAGdata --rebuild   # 首次或重建
uv run python ingest.py ../RAGdata             # 增量（按文件整篇替换）
```

- 向量化用本地 `fastembed` + `BAAI/bge-small-zh-v1.5`（约 90MB），首次运行自动下载到 `~/.cache/fastembed/`。下载不通时可用 `HF_ENDPOINT=https://hf-mirror.com HF_HUB_DISABLE_XET=1`，或手动下载 `fast-bge-small-zh-v1.5.tar.gz` 解压到该目录。
- 入库后 `GET /api/rag/status` 返回 `ready:true`；在 AI 对话里打开「使用知识库」即可基于资料提问。

## 目录结构

```
zero-to-full/
├── app/          # 路由页：/、/text-lab、/login、/messages、/about、/blog、/works
├── components/   # 页面与交互组件（Nav / NavAuth / Avatar / AuthContext / AuthView / AuthForm /
│                 #  WeatherWidget / ThemeToggle / WorksGrid / ChatPanel / ChatToolbar /
│                 #  ChatMessages / ChatComposer / ChatQuotaHint / VipModal / useVipBadge / ChatPromo /
│                 #  useChat / chatApi / paymentsApi / ragApi / AnalysisPanel /
│                 #  MessagesView / MessagesRail / ConversationList / SystemNotifications /
│                 #  AnnouncementList / SettingsPanel / ProfileSettings / AvatarCropModal /
│                 #  AddFriendModal / ChatWindow / AddFriend / FriendRequests / EmojiPicker /
│                 #  MessagesContext / useFriends / useFriendSocket / useMessageReminder /
│                 #  useAnnouncements / friendsApi / announcementsApi / cropImage）
├── data/         # 静态文案与打底数据（site.js、quotes.js）
├── css/          # 手写样式（chat.css AI 对话与 VIP，auth.css 登录页，
│                 #  messages.css / messages-panels.css 消息中心，chat-window.css 微信式聊天窗口）
├── backend/      # FastAPI 服务：main.py（接口层）、auth_api.py（认证与头像）、chat_api.py（AI 对话）、
│                 #  quotas.py（对话额度）、payments.py / payments_api.py（模拟支付与 VIP）、
│                 #  rag.py / rag_store.py / rag_api.py / ingest.py（本地知识库）、
│                 #  announcements_api.py（公告接口）、announce.py（公告发布脚本）、
│                 #  friends_api.py（好友接口）、friends_ws.py（好友 WebSocket）、auth.py（密码与登录态）、
│                 #  chat.py（模型层）、friends.py（好友关系）、friend_codes.py（好友码）、
│                 #  direct_messages.py（私聊消息）、announcements.py（公告存储）、avatars.py（头像文件）、
│                 #  db.py（连接/建表/归属）、users.py（用户与额度）、session.py（匿名 Cookie）、
│                 #  storage.py（数据层）、weather.py（天气）
├── next.config.mjs
└── .env.local
```

## API

| 方法 | 路径 | 入参 | 说明 |
|------|------|------|------|
| GET  | `/api/profile` | — | 主页内容 |
| POST | `/api/analyze` | `{ text }` | 情感分析 + 拼音，写库并返回结果 |
| GET  | `/api/history` | `?limit=10` | 当前会话的历史记录，按时间倒序 |
| DELETE | `/api/history` | — | 清空当前会话的全部历史，返回 `{ "cleared": N }` |
| GET  | `/api/weather` | — | 按客户端 IP 定位的当地实况天气（城市/天气/温度） |
| POST | `/api/auth/register` | `{ username, password }` | 注册并自动登录；重名 409，校验失败 422 |
| POST | `/api/auth/login` | `{ username, password }` | 登录；失败 401 |
| GET  | `/api/auth/me` | — | 当前用户与匿名额度 `{ user, quota }` |
| POST | `/api/auth/avatar` | `file`（multipart） | 上传头像（jpg/png/webp，≤2MB），返回 `{ user }` |
| DELETE | `/api/auth/session` | — | 退出登录，返回 `{ "ok": true }` |
| POST | `/api/chat/conversations` | — | 新建会话 |
| GET  | `/api/chat/conversations` | `?limit=20` | 会话列表，按更新时间倒序 |
| GET  | `/api/chat/conversations/{id}/messages` | — | 会话消息（正序） |
| DELETE | `/api/chat/conversations/{id}` | — | 删除会话及其消息，返回 `{ "deleted": N }` |
| POST | `/api/chat/conversations/{id}/messages` | `{ content }` | SSE 流式回复；事件 `delta` / `done` / `error` |
| GET  | `/api/friends` | — | 好友列表（含 `online` / `unread` / `last_message_at`） |
| GET  | `/api/friends/requests` | — | `{ incoming, outgoing }` 好友申请 |
| GET  | `/api/friends/me/code` | — | 我的好友码 `{ code }` |
| GET  | `/api/friends/lookup` | `?username=` 或 `?code=` | `{ user, relationship }`；查不到 404 |
| POST | `/api/friends/requests` | `{ username? }` 或 `{ code? }` | 发申请；互发直接成好友 |
| POST | `/api/friends/requests/{id}/accept` | — | 接受申请，返回 `{ friend }` |
| DELETE | `/api/friends/requests/{id}` | — | 拒绝 / 撤回申请 |
| DELETE | `/api/friends/{id}` | — | 删好友并清空聊天记录，返回 `{ ok, deleted_messages }` |
| GET  | `/api/friends/{id}/messages` | `?limit=50&before=<id>` | `{ messages: 正序, has_more }` |
| POST | `/api/friends/{id}/messages` | `{ content }` | 发消息并实时推送 |
| POST | `/api/friends/{id}/read` | — | 标记已读，返回 `{ read: N }` |
| DELETE | `/api/friends/messages` | — | 清空与所有好友的聊天记录，返回 `{ deleted: N }` |
| DELETE | `/api/friends/{id}/messages` | — | 清空与某好友的聊天记录，返回 `{ deleted: N }` |
| WS   | `/ws/friends` | — | 好友实时事件（见下） |
| GET  | `/api/announcements` | — | 公告列表 `{ items, unread }`（需登录） |
| POST | `/api/announcements/{id}/read` | — | 标记公告已读，返回 `{ ok, unread }` |
| POST | `/api/announcements` | `{ title, body }` + 头 `X-Announce-Key` | 发布公告（脚本用），并 WebSocket 广播 |
| GET  | `/api/pay/orders` | — | 我的订单列表（需登录） |
| POST | `/api/pay/orders` | `{ product }` | 创建订单（vip_month，1 分），返回 `{ order }` |
| POST | `/api/pay/orders/{id}/confirm` | — | 模拟支付成功并开通/续费 VIP，返回 `{ order, user }` |
| GET  | `/api/rag/status` | — | 知识库状态 `{ ready, documents }` |

- 情感判定：score ≥ 0.6 偏积极，≤ 0.4 偏消极，其余中性。
- 数据归属：已登录按账号（`user_id`），匿名按 `session_id` Cookie（有效期 30 天）；接口只读写当前归属的数据，越权访问返回 404。登录/注册时把该浏览器的匿名对话与历史绑到账号。
- 匿名访客累计可发 3 条 AI 消息（`anonymous_usage` 计数，删会话不会重置）；登录用户每天免费 20 条（`chat_daily_usage` 按 Asia/Shanghai 自然日计数，删会话不重置），用尽返回 403 `code=chat_quota_exceeded`；VIP 不限量。分析模式匿名可用且不占额度。
- VIP：999 元/月，到期后回到每日 20 条；续费从当前到期时间顺延 30 天。支付目前是**模拟**（点微信/支付宝即视为成功），订单表与确认接口按真实网关形状预留。
- 知识库（RAG）：数据来自项目根 `RAGdata/`（`.md` / `.txt`）；AI 对话开启「使用知识库」后，用本地 `fastembed`（`BAAI/bge-small-zh-v1.5`）向量化并检索 top-4 注入提示词，回答标注来源。RAG 独立每天 5 条，VIP 不限量，不占普通 20 条；知识库未入库时请求返回 409。
- 账号规则：用户名 3-20 位、字母开头、仅字母数字下划线；密码恰好 8 位字符、不含空格；密码用 bcrypt 哈希存储，登录态为 HttpOnly `auth_token` Cookie（30 天）。
- 对话上下文 = 系统提示词 + 最近 20 条消息；会话标题取首条用户消息前 20 字。
- 单条消息限 4000 字；`CHAT_API_KEY` 未配置时发消息返回 503。
- 好友与私聊全部需要登录；消息为纯文本 + 本地表情，单条 1-2000 字，仅好友之间可发。删除好友会一并删除双方聊天记录。
- WebSocket `/ws/friends` 握手用 `auth_token` Cookie 鉴权（无效关闭码 4401）；服务端事件：`ready` / `message` / `presence` / `friend_request` / `friend_accepted` / `friend_request_removed` / `friend_removed`；客户端每 30 秒发 `{"type":"ping"}` 保活。在线状态为单进程内存态，后端重启即清空。
- 好友码为 8 位（去易混字符），邀请链接为相对路径 `/messages?code=XXXX`。
- 消息中心 `/messages`：左侧「我的消息」（会话列表 + 微信式聊天）/「系统通知」（公告 + 好友申请）/「设置」（个人资料换头像 + 消息设置）；好友、公告与 WebSocket 由 `MessagesProvider` 全站共享，只有一份连接。
- 头像：登录后可在「设置 → 个人资料」选图 → 裁剪 → 上传。前端用 `react-easy-crop` 拖拽缩放，输出 256×256 JPEG；后端限制 jpg/png/webp 且 ≤2MB，存 `backend/avatars/`（gitignore），访问路径 `/avatars/xxx`；换新头像会删旧文件。
- 公告：`announce.py` 读取 JSON 文件（`title` 必填、`body` 可选）发布；未读按用户记，点开标题标记已读；发布时通过 WebSocket 广播给所有在线用户。
- 导航栏头像卡片悬停显示用户名，点击弹出添加好友弹窗（用户名 / 好友码 / 邀请链接）；「我的消息」只用于收发消息。收到新消息时「消息」右上角红点数字，开关存浏览器 `localStorage`（默认开，只影响该红点）。

## 说明

- CORS 允许 `http://localhost:3000`；改动前端端口需同步 `backend/main.py` 的 `allow_origins`。
- 后端不可用时前端回退 `data/site.js` 打底数据，页面不崩。
- `/api/analyze` 尚未校验空字符串 / 超长文本。
- 界面设计：霞鹜文楷字体、米白背景 + 青绿主色、实色卡片；支持浅色/暗色双模式（顶部导航切换，默认跟随系统偏好、记忆用户选择）。
- 天气卡片在全站顶部导航常驻：首次进入自动获取，点击卡片可刷新，悬停/聚焦展开湿度/风向/更新时间。
- 天气依赖高德开放平台：key 写在 `backend/.env`（已 gitignore），后端启动时自动加载；本地/无法定位的 IP 会回退到服务器出口定位；未配置或定位失败时接口返回 4xx/503，前端静默隐藏天气。
- AI 对话读取 `backend/.env` 的 `CHAT_BASE_URL` / `CHAT_API_KEY` / `CHAT_MODEL` / `CHAT_SYSTEM_PROMPT`，默认 DeepSeek（`https://api.deepseek.com/v1` + `deepseek-chat`）；换厂商只改这组变量。
- 公告发布读取 `backend/.env` 的 `ANNOUNCE_KEY`；该接口只校验密钥、不依赖登录态，供 `announce.py` 调用。
- RAG 方案与取舍见 `RAG.md`；已实现阶段 1（站内/本地 Markdown 入库 + 暴力检索 + 注入）。
- AI 对话的助手回复按 Markdown 渲染（GFM：标题 / 列表 / 代码块 / 表格 / 引用），用户输入保持纯文本；好友聊天不渲染 Markdown。

## 文档维护

- `AGENTS.md` 给 AI 编码助手（硬约束与约定），`README.md` 给人类。项目结构、接口、技术栈或职责变动时二者同步更新。
