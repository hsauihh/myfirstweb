# zero-to-full · 零到全栈

个人主页 + 文字实验室 + 消息中心。文字实验室有「分析」和「AI 对话」两种模式，默认进入分析（分析页有引导条可一键切到 AI 对话）：AI 对话接 OpenAI 兼容接口、SSE 流式回复，会话与消息存 SQLite；分析模式做情感分析与拼音标注。账号用用户名 + 密码注册登录，匿名访客可免费聊 3 句，登录用户每天免费 20 条、登录后可上传头像；999 元/月开通「至尊无敌黄金VIP」不限量。AI 对话可开启「使用知识库」，基于本地 `RAGdata/` 资料回答（独立每天 5 条，VIP 不限量）。导航栏主导航平铺五项（首页 / 文字实验室 / 博客 / 作品 / 关于），右侧是天气、主题切换与账号入口：未登录显示「登录」，登录后点头像弹出账号菜单（消息 / 个人资料 / 添加好友 / 退出），有未读时头像右上角显示红点（可在设置里关闭）。「消息」进入 `/messages` 消息中心：左侧导航（我的消息 / 系统通知 / 设置），中间会话列表，右侧微信式聊天窗口（REST 发送 + WebSocket 推送），带未读与在线状态。系统通知里可看公告（由独立脚本发布）与好友申请。「博客」页所有登录用户都能写文章：草稿只有自己可见，发布后所有人（含游客）可读，正文用 Markdown 渲染，登录用户可点赞。主页内容由后端接口实时提供。前端 Next.js 与后端 FastAPI 独立运行，通过 HTTP / WebSocket 联调。

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

- 向量化用本地 `fastembed` + `BAAI/bge-small-zh-v1.5`（约 90MB），代码显式固定缓存目录 `~/.cache/fastembed/`，优先离线加载。下载不通时可用 `HF_ENDPOINT=https://hf-mirror.com HF_HUB_DISABLE_XET=1`，或手动下载 `fast-bge-small-zh-v1.5.tar.gz` 解压到该目录。
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
│                 #  useAnnouncements / friendsApi / announcementsApi / cropImage / BlogView /
│                 #  BlogPostView / BlogManageView / BlogEditor / BlogLikeButton / blogApi / blogDate）
├── data/         # 静态文案与打底数据（site.js、quotes.js）
├── docs/         # 系统架构图：system-architecture.html（自包含交互图）
│                 #  + system-architecture.json（生成用规格）与 visual-check 证据
├── css/          # 手写样式（chat.css AI 对话与 VIP，auth.css 登录页，
│                 #  messages.css / messages-panels.css 消息中心，chat-window.css 微信式聊天窗口）
├── backend/      # FastAPI 服务：main.py（接口层）、auth_api.py（认证与头像）、chat_api.py（AI 对话）、
│                 #  quotas.py（对话额度）、payments.py / payments_api.py（模拟支付与 VIP）、
│                 #  rag.py / rag_store.py / rag_api.py / ingest.py（本地知识库）、
│                 #  announcements_api.py（公告接口）、announce.py（公告发布脚本）、
│                 #  friends_api.py（好友接口）、friends_ws.py（好友 WebSocket）、auth.py（密码与登录态）、
│                 #  chat.py（模型层）、friends.py（好友关系）、friend_codes.py（好友码）、
│                 #  direct_messages.py（私聊消息）、announcements.py（公告存储）、avatars.py（头像文件）、
│                 #  db.py（连接/归属）、schema.py（建表与迁移）、blog.py / blog_api.py（博客）、users.py（用户与额度）、session.py（匿名 Cookie）、
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
| GET  | `/api/blog/posts` | `?limit=10&offset=0&sort=published` | 公开文章列表 `{ items, has_more }`（无需登录；`sort` 可选 `likes`） |
| GET  | `/api/blog/posts/{id}` | — | 文章详情；草稿 / 仅自己可见仅作者可见，其余 404 |
| GET  | `/api/blog/me/posts` | — | 我的全部文章（含草稿，需登录） |
| POST | `/api/blog/posts` | `{ title, content, visibility }` | 新建文章（visibility：draft/private/public） |
| PATCH | `/api/blog/posts/{id}` | `{ title?, content?, visibility? }` | 修改自己的文章；非作者 404 |
| DELETE | `/api/blog/posts/{id}` | — | 删除自己的文章；管理员可删除任意公开文章 |
| POST | `/api/blog/posts/{id}/like` | — | 切换点赞，返回 `{ liked, like_count }` |

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
- 导航：主导航平铺「首页 / 文字实验室 / 博客 / 作品 / 关于」；右侧为天气（窄屏隐藏）、主题切换与账号区——未登录显示「登录」，登录后点头像弹出账号菜单（消息 / 个人资料 / 添加好友 / 退出），其中「个人资料」直达 `/messages?section=settings`。有未读时头像右上角红点、菜单「消息」行显示数字，开关存浏览器 `localStorage`（默认开，只影响这些提示）。窄屏（≤900px）折叠为汉堡菜单，导航与账号操作都收进菜单。

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
- 聊天（AI 对话与好友聊天）气泡采用胶囊形（自己奶油色、对方暗色半透明），并应用本地「原神」字体 `public/fonts/genshin.ttf`；消息上方显示发送者用户名。
- 博客：所有登录用户可写；`visibility` 三态——`draft`（草稿，未发布，在草稿箱）/ `private`（已发布，仅自己可见）/ `public`（已发布，公开）；正文按 Markdown 渲染（GFM），详情走 `/blog/post?id=`（静态导出不支持动态路由）；`/blog` 可按「最新发布 / 最多点赞」排序；点赞为登录用户每人每篇一次、可取消。
- 管理员：`backend/.env` 的 `ADMIN_USERNAMES`（逗号分隔，默认 `ryaich`）命中的用户名即为管理员，可在 `/blog` 列表直接删除任意公开文章（不能删草稿 / 仅自己可见）；`/api/auth/me` 返回 `user.is_admin`。
- `css/markdown.css` 已改为跟随主题（浅色面板 / 暗色面板），暗色聊天气泡的浅色文字在 `.chat-bubble--markdown` 作用域内覆盖。

## 开发避坑（踩过的坑）

- **不要同时跑 `npm run dev` 和 `npm run build`**：两者共用 `.next` 目录，会互相覆盖，报 `missing required error components, refreshing...` 或 `ENOENT: no such file or directory ... .next/server/app/blog/page.js`。要打包先停 dev，打包后再重启 dev；遇到该报错重启 dev 即可恢复。
- **同一项目只保留一个 `next dev`**：多个实例共用同一个 `.next`，会互相删掉对方编译产物（同样是上面的 `ENOENT`）。用 `fuser -k 3000/tcp` 关掉占用端口的实例后再启动。
- **清理数据库测试数据只用精确条件**：不要用 `DELETE FROM users WHERE username LIKE 'a%'` 这类模糊匹配，会连带删掉真实账号及其文章（外键级联删除）。只按自己创建的确切用户名删，操作前先备份 `backend/history.db`。
- **向量模型必须放在持久目录**：fastembed 默认缓存是系统临时目录 `/tmp/fastembed_cache`，重启/清理即丢；丢了之后加载会去联网下载（国内会被墙），表现为「开启知识库对话后一直无输出」。`backend/rag.py` 已固定 `cache_dir=~/.cache/fastembed` 并优先离线加载；换机器/上线时把该模型目录一并带上（或重新执行预热）。

## 架构图维护

架构图（`docs/system-architecture.html`）是项目的**总纲**：

- **新增功能、重构、优化之前**，先对照架构图想清楚改动落在哪个组件、哪条链路上；**改完必须回写架构图**，让它始终代表项目最新全貌。
- 只改源文件 `docs/system-architecture.json`（archify 规格），**不要手改 `system-architecture.html`**——HTML 由它生成。
- 生成与校验（archify 技能在 `~/.pi/agent/skills/archify/`）：

  ```bash
  A=~/.pi/agent/skills/archify/bin/archify.mjs
  node $A validate architecture docs/system-architecture.json --quality showcase --repo-root .
  node $A deliver  architecture docs/system-architecture.json docs/system-architecture.html --quality showcase --repo-root .
  ARCHIFY_CHROME=$(ls ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | head -1) \
    node $A visual-check docs/system-architecture.html --json
  ```

- **必须更新**：新增独立组件或外部服务（加节点）、新增数据表或链路（补连线 / 卡片）、部署形态变化（改 boundary）。
- **粒度约定**：架构图是基础设施级全貌；聊天 / 好友 / 认证 / 博客这类**功能级模块不单独画节点**，归到 `api` + `sqlite`，需要点出时写进底部卡片。
- 提交时把 `docs/` 下的 json、html、visual-check 证据一起带上。

## 文档维护

- `AGENTS.md` 给 AI 编码助手（硬约束与约定），`README.md` 给人类。项目结构、接口、技术栈或职责变动时二者同步更新。
- 上线部署见 `DEPLOY.md`；一键脚本 `deploy/deploy.sh`，配置模板 `deploy/nginx.conf`、`deploy/zero-to-full.service`。
