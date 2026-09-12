# zero-to-full · 零到全栈

个人主页 + 文字实验室 + 消息中心。文字实验室有「分析」「AI 对话」两个模式，默认进入分析（分析页有引导条可一键切到 AI 对话）：AI 对话接 OpenAI 兼容接口、SSE 流式回复，会话与消息存 SQLite，并提供一排常用提示词快捷按钮；分析模式做情感分析与拼音标注。「知识库」页（`/knowledge`）分「知识库问答 / 随心一记 / 知识图谱 / 来源管理」四个 Tab：登录用户把自己或他人的公开文章选进个人库，也能用「随心一记」记一句话（如「钥匙放在玄关柜第二层」）直接进个人库，问答基于「个人知识库（含笔记）+ 站内公共资料（`RAGdata/`）」检索，可切换「问答（单轮，默认）/ 上下文（多轮）」模式与「使用系统知识库」开关（知识库独立每天 5 条，VIP 不限量）。问答界面是 DeepSeek 网页端同款版式：左侧会话列表、居中消息列（用户消息右对齐气泡、助手消息直接排 Markdown 无气泡）、圆角输入框 + 圆形发送/停止按钮，助手回复下方可复制或重新生成；配色仍用站点自己的米白 + 青绿与深浅色两套。账号用用户名 + 密码注册登录，匿名访客可免费聊 3 句，登录用户每天免费 20 条、登录后可上传头像；999 元/月开通「至尊无敌黄金VIP」不限量。导航栏主导航平铺六项（首页 / 文字实验室 / 博客 / 知识库 / 作品 / 关于），右侧是天气、主题切换与账号入口：未登录显示「登录」，登录后点头像弹出账号菜单（消息 / 个人资料 / 添加好友 / 退出），有未读时头像右上角显示红点（可在设置里关闭）。「消息」进入 `/messages` 消息中心：左侧导航（我的消息 / 系统通知 / 设置），中间会话列表，右侧微信式聊天窗口（REST 发送 + WebSocket 推送），带未读与在线状态。系统通知里可看公告（由独立脚本发布）与好友申请。「博客」页所有登录用户都能写文章：草稿只有自己可见，发布后所有人（含游客）可读，正文用 Markdown 渲染，登录用户可点赞。「首页」是文档式的两栏内容聚合页：hero 置顶居中（纯文字，无卡片、无跳转按钮）、下面一行「每日一句」自动轮播（点击可切下一条，没有标签、箭头与圆点）；主栏是「随心一记」快入口（登录后单行输入，Enter 保存，直接进个人知识库，可删最近几条）与「最新博客」，右侧栏是「公告」（公开只读，标题点击展开正文）与「最热博客」（按点赞）。首页不再放跳转卡片——导航里都有；内容由后端接口实时提供。前端 Next.js 与后端 FastAPI 独立运行，通过 HTTP / WebSocket 联调。

## 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Next.js 15（App Router）、React 19、**TypeScript（strict）**、animejs v4、react-markdown、@xyflow/react v12（知识图谱）、WebSocket、手写 CSS |
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

前端通过 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 定位后端（当前 `http://localhost:8001`）。构建：`npm run build`（产物在 `out/`，任意静态服务器托管；`next start` 与静态导出不兼容）。类型检查：`npm run typecheck`（`tsc --noEmit`，不写 `.next`，可与 dev 并存）。

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

## 知识库（RAG / GraphRAG）

把 `.md` / `.txt` 放进项目根 `RAGdata/`，然后入库：

```bash
cd backend
uv run python ingest.py ../RAGdata --rebuild   # 首次或重建（含实体关系抽取）
uv run python ingest.py ../RAGdata             # 增量（按文件整篇替换）
uv run python ingest.py ../RAGdata --no-graph  # 只做向量入库，不抽图
```

- 向量化用本地 `fastembed` + `BAAI/bge-small-zh-v1.5`（约 90MB），代码显式固定缓存目录 `~/.cache/fastembed/`，优先离线加载。下载不通时可用 `HF_ENDPOINT=https://hf-mirror.com HF_HUB_DISABLE_XET=1`，或手动下载 `fast-bge-small-zh-v1.5.tar.gz` 解压到该目录。
- 入库同时会用 `CHAT_*` 配置的模型抽取实体与关系（可用 `GRAPH_MODEL` 单独指定模型），结果按块内容哈希缓存，重跑不会重复调模型；约 400 块的公共库首次建图需要几十次模型调用、几分钟。
- 入库后 `GET /api/rag/status` 返回 `ready:true` 与图谱规模；在「知识库问答」里提问即可，问答范围还会叠加你在 `/knowledge` 选入的个人文章（`--rebuild` 只重建站内公共库，不动个人库）。
- 「知识库 → 随心一记」页签记一句话就进个人库：笔记是 `kb_sources.kind='note'` 的独立来源，单块入库、**不切块也不抽图**（保存即时、不花模型调用），因此不出现在知识图谱页（没有实体提及）；问答命中时来源卡片显示笔记首行与片段（笔记没有网页可跳）。增删都在这个页签，「来源管理」里也能看到并删除；写笔记不消耗对话额度。
- 「知识库 → 知识图谱」页签把结构实时画出来：**章 / 来源作为分组骨架，节点是各组里提及最多的概念，边是图谱里真实抽取到的关系**；点概念可看它的关系、命中片段，并可一键切回问答预填问题。图随库变，不需要重新生成。

## 聊天字体分片

`.ttf` 源字体在 `assets/fonts/genshin.ttf`（不随站点发布），分片产物在 `public/fonts/genshin/`：

```bash
npm run fonts:subset   # 需要 uv；重新生成分片与 css/genshin-font.css
```

分片与生成的 CSS 已提交进仓库，所以构建与部署不需要联网或额外依赖；换字体时才需要重跑。

## 目录结构

```
zero-to-full/
├── app/          # 路由页（.tsx）：/、/text-lab、/login、/messages、/about、/blog、/knowledge、/works
├── components/   # 页面与交互组件（.tsx）与数据钩子/接口层（.ts，共约 60 个文件：
│                 #  types.ts 领域与 DTO 类型、apiRequest.ts 统一请求入口、apiError.ts、
│                 #  各 *Api.ts、use*.ts、及 Nav / Chat*（含 Sidebar/Header/Suggestions）/ Knowledge* / Blog* / Messages* 等组件）
├── data/         # 静态文案与打底数据（site.ts、quotes.ts）
├── docs/         # 系统架构图：system-architecture.html（自包含交互图）
│                 #  + system-architecture.json（生成用规格）与 visual-check 证据
├── css/          # 手写样式（chat.css AI 对话与 VIP，auth.css 登录页，knowledge.css 我的知识库，
│                 #  messages.css / messages-panels.css 消息中心，chat-window.css 微信式聊天窗口，
│                 #  chat-ds.css / chat-ds-messages.css 对话版式（左栏会话列表、消息列、圆角输入区），
│                 #  home.css / home-notes.css 首页版面（hero、每日一句、行式列表）与随心一记快入口，
│                 #  genshin-font.css 聊天字体分片声明（由 scripts/subset_genshin.py 生成））
├── assets/       # 源资源（不入发布目录）：fonts/genshin.ttf 聊天字体源文件
├── scripts/      # 构建/生成脚本：sync-architecture.mjs、subset_genshin.py
├── tsconfig.json # strict 前端类型配置（allowJs 已关闭，不留 JS 文件）
├── backend/      # FastAPI 服务：main.py（接口层）、auth_api.py（认证与头像）、chat_api.py（AI 对话）、
│                 #  quotas.py（对话额度）、payments.py / payments_api.py（模拟支付与 VIP）、
│                 #  rag.py / rag_store.py / rag_api.py / ingest.py（本地知识库，向量存 document_vectors）、
│                 #  graph.py / graph_store.py（GraphRAG 实体关系抽取与图谱存储）、
│                 #  rag_graph.py / rag_graph_detail.py（知识图谱页：结构图与概念详情查询）、
│                 #  kb.py / kb_api.py（个人知识库：文章选入与同步）、
│                 #  announcements_api.py（公告接口）、announce.py（公告发布脚本）、
│                 #  friends_api.py（好友接口）、friends_ws.py（好友 WebSocket）、auth.py（密码与登录态）、
│                 #  chat.py（模型层）、friends.py（好友关系）、friend_codes.py（好友码）、
│                 #  direct_messages.py（私聊消息）、announcements.py（公告存储）、avatars.py（头像文件）、
│                 #  db.py（连接/归属）、schema.py / schema_rag.py（建表与迁移）、blog.py / blog_api.py（博客）、
│                 #  users.py（用户与额度）、session.py（匿名 Cookie）、storage.py（数据层）、weather.py（天气）
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
| POST | `/api/chat/conversations` | `?kind=chat\|rag` | 新建会话（kind 默认 chat；rag = 知识库问答） |
| GET  | `/api/chat/conversations` | `?limit=20&kind=chat\|rag` | 会话列表，按更新时间倒序；按 kind 隔离 |
| GET  | `/api/chat/conversations/{id}/messages` | — | 会话消息（正序）；助手消息带 `sources`（来源引用，无引用时为 `null`） |
| DELETE | `/api/chat/conversations/{id}` | — | 删除会话及其消息，返回 `{ "deleted": N }` |
| POST | `/api/chat/conversations/{id}/messages` | `{ content, mode?, include_system? }` | SSE 流式回复；事件 `delta` / `done` / `error`。`kind=rag` 时 `mode`（qa 单轮/context 多轮，默认 qa）与 `include_system`（是否检索站内公共库，默认 true）生效；`done.message.sources` 带回来源引用；生成期间输入框仍可继续输入 |
| POST | `/api/chat/conversations/{id}/regenerate` | `{ mode?, include_system? }` | 重新生成**最后一条**回复（删掉旧回复并按原问题重跑，SSE 事件同发送）；额度与发送一致，额度不足 403 且不动旧回复；没有可重生成的问题 422 |
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
| GET  | `/api/announcements/public` | `?limit=4` | 首页公告栏用：公开只读 `{ items: [{ id, title, body, created_at }] }`，无需登录、不带已读状态；`limit` 上限 20 |
| POST | `/api/announcements/{id}/read` | — | 标记公告已读，返回 `{ ok, unread }` |
| POST | `/api/announcements` | `{ title, body }` + 头 `X-Announce-Key` | 发布公告（脚本用），并 WebSocket 广播 |
| GET  | `/api/pay/orders` | — | 我的订单列表（需登录） |
| POST | `/api/pay/orders` | `{ product }` | 创建订单（vip_month，1 分），返回 `{ order }` |
| POST | `/api/pay/orders/{id}/confirm` | — | 模拟支付成功并开通/续费 VIP，返回 `{ order, user }` |
| GET  | `/api/rag/status` | — | 知识库状态 `{ ready, documents, personal, public, entities, relations }`（按登录用户统计，图谱计数为全局） |
| GET  | `/api/rag/graph` | — | 知识库结构图 `{ groups, nodes, edges, stats }`（章 / 来源骨架 + 核心概念 + 关系；未登录只看站内公共库） |
| GET  | `/api/rag/graph/entities/{id}` | — | 概念详情 `{ name, kind, degree, groups, relations, chunks }`；实体对该用户不可见时 404 |
| GET  | `/api/blog/posts` | `?limit=10&offset=0&sort=published` | 公开文章列表 `{ items, has_more }`（无需登录；`sort` 可选 `likes`） |
| GET  | `/api/blog/posts/{id}` | — | 文章详情；草稿 / 仅自己可见仅作者可见，其余 404 |
| GET  | `/api/blog/me/posts` | — | 我的全部文章（含草稿，需登录） |
| POST | `/api/blog/posts` | `{ title, content, visibility }` | 新建文章（visibility：draft/private/public） |
| PATCH | `/api/blog/posts/{id}` | `{ title?, content?, visibility? }` | 修改自己的文章；非作者 404 |
| DELETE | `/api/blog/posts/{id}` | — | 删除自己的文章；管理员可删除任意公开文章 |
| POST | `/api/blog/posts/{id}/like` | — | 切换点赞，返回 `{ liked, like_count }` |
| GET  | `/api/kb/sources` | — | 我的知识库来源列表 + 公共库片段数（需登录，顺手懒同步） |
| GET  | `/api/kb/candidates` | `?q=&limit=20&offset=0` | 可加入知识库的文章（我的全部 + 他人公开），带 `in_kb` |
| POST | `/api/kb/sources` | `{ post_id }` | 加入我的知识库，返回 `{ source, created }`；不可见 404、过短 422 |
| DELETE | `/api/kb/sources/{post_id}` | — | 从我的知识库移除来源 |
| POST | `/api/kb/sources/{post_id}/sync` | — | 强制重建单个来源 |
| GET  | `/api/kb/notes` | `?limit=30&offset=0` | 我的随心一记笔记（时间倒序）`{ items, total, has_more }`（需登录） |
| POST | `/api/kb/notes` | `{ content }` | 记一条笔记（1–500 字），入库即可被问答检索，返回 `{ note, created }`；空/超长 422 |
| DELETE | `/api/kb/notes/{id}` | — | 删除我的笔记（级联删块与向量），返回 `{ deleted }`；非本人 404 |

- 情感判定：score ≥ 0.6 偏积极，≤ 0.4 偏消极，其余中性。
- 数据归属：已登录按账号（`user_id`），匿名按 `session_id` Cookie（有效期 30 天）；接口只读写当前归属的数据，越权访问返回 404。登录/注册时把该浏览器的匿名对话与历史绑到账号。
- 匿名访客累计可发 3 条 AI 消息（`anonymous_usage` 计数，删会话不会重置）；登录用户每天免费 20 条（`chat_daily_usage` 按 Asia/Shanghai 自然日计数，删会话不重置），用尽返回 403 `code=chat_quota_exceeded`；VIP 不限量。分析模式匿名可用且不占额度。
- VIP：999 元/月，到期后回到每日 20 条；续费从当前到期时间顺延 30 天。支付目前是**模拟**（点微信/支付宝即视为成功），订单表与确认接口按真实网关形状预留。
- 知识库（RAG / GraphRAG）：在「知识库 → 知识库问答」提问，检索范围 = 个人知识库（用户在「来源管理」选入的博客文章 + 随心一记的笔记）+ 站内公共资料（项目根 `RAGdata/`，可用「使用系统知识库」开关关掉），用本地 `fastembed`（`BAAI/bge-small-zh-v1.5`）向量化，向量单独存 `document_vectors`（float32 BLOB，检索时整库矩阵常驻内存、库变了才重建）。检索分两步：先向量召回 top-6 作为种子，再从「种子块提到的实体」出发做**一跳图谱扩展**，把向量分不高但共享实体的块一并拿进上下文（最多 8 块，另附命中的实体关系）。图谱数据缺失时自动降级为纯向量检索。模式分「问答」（单轮，不带历史，默认）与「上下文」（多轮，带历史）。个人库来源可增删、可手动重新同步；文章被编辑后下次问答前自动重建向量与图谱，被删除或被作者改为非公开时自动移除（作者自己的那份保留）。RAG 独立每天 5 条，VIP 不限量，不占普通 20 条；知识库为空时请求返回 409。
- 随心一记：笔记与文章共用一张来源表（`kb_sources.kind` 区分 `post` / `note`），所以可见性、配额、引用规则完全同一套；笔记写一个块（不走 ATX 切块，也就不会被「不足 30 字丢弃」的规则吃掉），向量化失败会回滚不留脏行。**不抽图**：没有实体提及，知识图谱页自然不会出现它；被问答检索到时，引用 `kind="note"`、`note_id` 是来源 id、标题取笔记首行，卡片点开只弹命中片段（笔记没有原文网页）。上限 500 字，可随时增删，不消耗对话额度。
- 重新生成：助手回复下方提供「复制」与「重新生成」，**重新生成只作用于最后一条回复**（避免回滚后续会话），后端删掉旧回复并按原问题重跑（含重新检索），消耗一次对话额度；额度不足返回 403 且不动旧回复；上次生成失败（没有助手消息）时同一个按钮充当重试。
- 对话界面版式：`/knowledge` 知识库问答与 `/text-lab` 的 AI 对话共用同一套组件，都是 DeepSeek 网页端同款版式（左栏会话列表 + 居中消息列 + 圆角输入区），配色沿用站点 token；好友聊天（`/messages`）仍用 `chat-window.css` 的胶囊气泡，不受影响。
- 切块与来源引用：入库时按 ATX 标题切块（小节之间不合块，块带「标题路径」存 `documents.section`），所以回答能精确到「哪篇文章的哪一节」。模型被要求用 `[n]` 标注依据，`n` 就是参考资料序号；这组引用（文章 / 小节 / 命中片段 / 是否可跳）随助手消息存入 `messages.sources`，前端把 `[n]` 渲染成可点击角标，气泡下方按文章聚合出来源卡片；点个人来源直达 `/blog/post?id=N#小节` 并高亮该标题，站内公共资料（`RAGdata/` 不随站点发布）则弹出命中片段。
- 图谱构建：实体/关系由 `backend/graph.py` 在**入库时**调用模型抽取（`ingest.py` 默认开、`--no-graph` 可关；个人库在加入/重新同步时抽，单篇最多 24 块），落 `graph_entities` / `graph_mentions` / `graph_relations`，抽取结果按块内容哈希缓存在 `graph_extractions`。用户可见性靠 `chunk_id` 连回 `documents` 判断，与向量检索共用同一套归属规则。抽图是增强项：失败只打日志，不影响入库、来源同步状态与问答。
- 知识图谱页：「知识库 → 知识图谱」页签请求 `GET /api/rag/graph`，用 `@xyflow/react` 的分组节点画成结构图（章 / 来源为框、概念为节点、关系为连线），点概念再取 `GET /api/rag/graph/entities/{id}` 看类型、关系与命中片段。图是**实时查库**出来的（不是静态导出），公共资料与个人库变了刷新即见效；选取与截断规则见 `RAG.md` 第 14 节。
- 账号规则：用户名 3-20 位、字母开头、仅字母数字下划线；密码恰好 8 位字符、不含空格；密码用 bcrypt 哈希存储，登录态为 HttpOnly `auth_token` Cookie（30 天）。
- 对话上下文 = 系统提示词 + 最近 20 条消息；会话标题取首条用户消息前 20 字。
- 单条消息限 4000 字；`CHAT_API_KEY` 未配置时发消息返回 503。
- 好友与私聊全部需要登录；消息为纯文本 + 本地表情，单条 1-2000 字，仅好友之间可发。删除好友会一并删除双方聊天记录。
- WebSocket `/ws/friends` 握手用 `auth_token` Cookie 鉴权（无效关闭码 4401）；服务端事件：`ready` / `message` / `presence` / `friend_request` / `friend_accepted` / `friend_request_removed` / `friend_removed`；客户端每 30 秒发 `{"type":"ping"}` 保活。在线状态为单进程内存态，后端重启即清空。
- 好友码为 8 位（去易混字符），邀请链接为相对路径 `/messages?code=XXXX`。
- 消息中心 `/messages`：左侧「我的消息」（会话列表 + 微信式聊天）/「系统通知」（公告 + 好友申请）/「设置」（个人资料换头像 + 消息设置）；好友、公告与 WebSocket 由 `MessagesProvider` 全站共享，只有一份连接。
- 头像：登录后可在「设置 → 个人资料」选图 → 裁剪 → 上传。前端用 `react-easy-crop` 拖拽缩放，输出 256×256 JPEG；后端限制 jpg/png/webp 且 ≤2MB，存 `backend/avatars/`（gitignore），访问路径 `/avatars/xxx`；换新头像会删旧文件。
- 公告：`announce.py` 读取 JSON 文件（`title` 必填、`body` 可选）发布；未读按用户记，点开标题标记已读；发布时通过 WebSocket 广播给所有在线用户。
- 首页：hero 与副标题来自 `/api/profile`（数据驱动，改文案动 `backend/main.py` 的 `profile`）；最新/最热博客走公开的 `/api/blog/posts`（`sort=published|likes`），公告走公开的 `/api/announcements/public`，游客都能看；「随心一记」需要登录（未登录只显示一行提示，且不请求接口），完整管理（分页、全量列表）在 `/knowledge#notes`。首页不使用卡片动画（只留 hero 与引文淡入、列表行 hover），动画预算刻意压到最小。
- 导航：主导航平铺「首页 / 文字实验室 / 博客 / 知识库 / 作品 / 关于」；右侧为天气、主题切换与账号区——未登录显示「登录」，登录后点头像弹出账号菜单（消息 / 个人资料 / 添加好友 / 退出），其中「个人资料」直达 `/messages?section=settings`。有未读时头像右上角红点、菜单「消息」行显示数字，开关存浏览器 `localStorage`（默认开，只影响这些提示）。窄屏（≤900px）折叠为汉堡菜单，导航与账号操作都收进菜单；天气在各宽度常驻，≤480px 只留「城市+温度」、≤380px 只留温度。

## 说明

- CORS 允许 `http://localhost:3000`；改动前端端口需同步 `backend/main.py` 的 `allow_origins`。
- 后端不可用时前端回退 `data/site.js` 打底数据，页面不崩。
- `/api/analyze` 尚未校验空字符串 / 超长文本。
- 界面设计：霞鹜文楷字体、米白背景 + 青绿主色、实色卡片；支持浅色/暗色双模式（顶部导航切换，默认跟随系统偏好、记忆用户选择）。
- 天气卡片在全站顶部导航常驻：首次进入自动获取，点击卡片可刷新，悬停/聚焦展开湿度/风向/更新时间。
- 天气依赖高德开放平台：key 写在 `backend/.env`（已 gitignore），后端启动时自动加载；本地/无法定位的 IP 会回退到服务器出口定位；未配置或定位失败时接口返回 4xx/503，前端静默隐藏天气。
- AI 对话读取 `backend/.env` 的 `CHAT_BASE_URL` / `CHAT_API_KEY` / `CHAT_MODEL` / `CHAT_SYSTEM_PROMPT`，默认 DeepSeek（`https://api.deepseek.com/v1` + `deepseek-chat`）；换厂商只改这组变量。图谱抽取复用 `CHAT_BASE_URL` / `CHAT_API_KEY`，可用 `GRAPH_MODEL` 单独指定模型（不配则用 `CHAT_MODEL`）。
- 公告发布读取 `backend/.env` 的 `ANNOUNCE_KEY`；该接口只校验密钥、不依赖登录态，供 `announce.py` 调用。
- RAG 方案与取舍见 `RAG.md`；已实现阶段 1（站内/本地 Markdown 入库 + 向量检索 + 注入）、「个人知识库」（博客文章选入 + 来源管理 + 懒同步 + 单轮/多轮模式 + 系统库开关）、阶段 5（GraphRAG：LLM 抽实体关系 + 一跳图谱扩展，降级策略见 `graph.py`）、阶段 6/7（可溯源引用、知识图谱页）与阶段 8（随心一记：一句话笔记即时入库）。
- AI 对话的助手回复按 Markdown 渲染（GFM：标题 / 列表 / 代码块 / 表格 / 引用），用户输入保持纯文本；好友聊天不渲染 Markdown。
- 聊天（AI 对话与好友聊天）气泡采用胶囊形（自己奶油色、对方暗色半透明），并应用本地「原神」字体；消息上方显示发送者用户名。该字体按使用频率分片（`public/fonts/genshin/`，常用字一片 ~550KB），字体 CSS 只挂在 `/text-lab`、`/knowledge`、`/messages` 三条路由上，其他页面不下载任何分片。
- AI 对话流式生成期间输入框保持可编辑（可先写好下一句），Enter 只换行不发送、也不会中断当前回复；要中断点「停止」，生成结束后草稿保留、按钮恢复「发送」。
- 博客：所有登录用户可写；`visibility` 三态——`draft`（草稿，未发布，在草稿箱）/ `private`（已发布，仅自己可见）/ `public`（已发布，公开）；正文按 Markdown 渲染（GFM），详情走 `/blog/post?id=`（静态导出不支持动态路由）；`/blog` 可按「最新发布 / 最多点赞」排序；点赞为登录用户每人每篇一次、可取消。
- 管理员：`backend/.env` 的 `ADMIN_USERNAMES`（逗号分隔，默认 `ryaich`）命中的用户名即为管理员，可在 `/blog` 列表直接删除任意公开文章（不能删草稿 / 仅自己可见）；`/api/auth/me` 返回 `user.is_admin`。
- `css/markdown.css` 已改为跟随主题（浅色面板 / 暗色面板），暗色聊天气泡的浅色文字在 `.chat-bubble--markdown` 作用域内覆盖。

## 开发避坑（踩过的坑）

- **不要同时跑 `npm run dev` 和 `npm run build`**：两者共用 `.next` 目录，会互相覆盖，报 `missing required error components, refreshing...` 或 `ENOENT: no such file or directory ... .next/server/app/blog/page.js`。要打包先停 dev，打包后再重启 dev；遇到该报错重启 dev 即可恢复。特别注意 `rm -rf .next && npm run build` 会把正在跑的 dev 彻底弄坏（页面卡在预渲染状态、静态资源 404），必须重启 dev。
- **前端导入不要写扩展名**：指向项目内模块的相对导入一律写成 `./Foo`（不写 `.js`/`.jsx`），`.css` 与包名导入保留后缀。tsconfig 用 `moduleResolution: bundler` + `allowJs: false`，写扩展名或新增 `.js` 前端文件都会被编译器拒绝。
- **接口类型只有一处未校验缝隙**：`components/apiRequest.ts` 里的 `res.json() as T`。后端改了字段名，TS 不会发现（它只防前端内部不一致与手误）；要防跨服务漂移就得加运行时校验。
- **同一项目只保留一个 `next dev`**：多个实例共用同一个 `.next`，会互相删掉对方编译产物（同样是上面的 `ENOENT`）。用 `fuser -k 3000/tcp` 关掉占用端口的实例后再启动。
- **清理数据库测试数据只用精确条件**：不要用 `DELETE FROM users WHERE username LIKE 'a%'` 这类模糊匹配，会连带删掉真实账号及其文章（外键级联删除）。只按自己创建的确切用户名删，操作前先备份 `backend/history.db`。
- **本地验证用的临时账号不必删除**：跑需要登录态的浏览器校验时，用接口临时注册一个账号即可，例如现有的 `kgtmp_probe / probe123`（只存在于本地 `backend/history.db`，该库已 gitignore，不会随部署上线）。这类账号留着可以反复复用，不用每次新建、也不用每轮清理；确实要清时按确切用户名删（见上一条）。
- **SQLite 改不了列约束，改结构只能重建表**：`kb_sources` 从「只存文章」升级成多态来源表（加 `kind`/`note_content`、`post_id` 改可空）走的就是重建。重建时必须 `PRAGMA foreign_keys=OFF`：`documents.source_id` 是 `ON DELETE CASCADE`，开着外键 `DROP TABLE` 会把**所有块**（含站内公共库）级联删光。同时要 `PRAGMA legacy_alter_table=ON`，否则改名时会被其他表里指向旧表的引用卡住。重建后要**逐行保留 id**（`documents.source_id` 就靠它），并用「有没有块失去来源行」来校验（`schema_rag._orphan_chunks`）。改这段前先拿 `history.db` 副本跑一遍。
- **笔记不能走文章那条切块路径**：`ingest.chunk_markdown` 按 ATX 标题切块，并且丢弃清洗后不足 `MIN_CHUNK=30` 字的内容——「钥匙在玄关柜」这种一句话会被直接丢掉。随心一记因此自己写单块（`kb.add_note`），不要去复用文章入库的函数。
- **向量模型必须放在持久目录**：fastembed 默认缓存是系统临时目录 `/tmp/fastembed_cache`，重启/清理即丢；丢了之后加载会去联网下载（国内会被墙），表现为「开启知识库对话后一直无输出」。`backend/rag.py` 已固定 `cache_dir=~/.cache/fastembed` 并优先离线加载；换机器/上线时把该模型目录一并带上（或重新执行预热）。
- **`.card` 的入场初始态必须同时满足两个条件**：限定在 `AnimatedCardGrid`（`.animated-grid`）里，并靠根节点的 `data-entered` 在它接管动画后失效。曾经 `.card { opacity: 0 }` 全局生效，导致没包在 `AnimatedCardGrid` 里的页面（如初版知识库页）整块卡片隐身；后来只限定在 `.animated-grid .card` 又漏了后挂载的卡片——动画只在挂载时扫一遍当时的 `.card`，懒加载的面板（知识图谱页签）既没被动画，又被初始态按住，表现为「切到该页签后一片空白」。排查时不能只量 `getBoundingClientRect()` 或数 DOM 节点（透明元素宽高照常非 0、节点也照常在），要同时看 `getComputedStyle(el).opacity`。
- **Tab 面板不要用 `display: contents`**：Safari/WebKit 对「作为网格子项的 `display: contents`」支持有缺陷，会让整个面板不参与布局。面板容器要自己开一层 12 列网格（`.tab-panel { grid-column: span 12; display: grid; … }`）。
- **图谱的悬停高亮不要在节点 `mouseleave` 里清除**：只要有一个激活节点，其余 50+ 个节点就会淡化到 `opacity .3`；没有激活节点则全图正常。把清除挂在节点 `mouseleave` 上，指针在图上移动时每跨过一次节点边界就会整图「正常 ↔ 全暗」跳一次——实测淡化节点数在 0↔53 之间振荡约 5 次/秒、4 秒内重绘 160 帧，看起来就是高频闪烁。现在只在离开整张画布（`.kg-canvas` 的 `mouseleave`）或点空白处才清除，指针在画布内移动只切换激活节点（变化收敛在邻域差集，约 9 个节点）。
- **图谱抽取失败也必须更新 `post_updated_at`**：`kb._write_chunks` 里的抽图调用要包 try/except，但 `post_updated_at` 必须照常写。否则 `sync_user` 会认为来源一直「待同步」，每次问答都重试抽图，把一次模型故障放大成持续成本。同理，抽图失败不能影响块入库与来源可见性。
- **字体分片的 `unicode-range` 必须互不重叠**：重叠时，常用字也会命中生僻字分片（浏览器按范围匹配），等于又把整份字体拉下来。`scripts/subset_genshin.py` 按「常用层优先取走码点」分层，就是为了保证不重叠；改分层逻辑时务必保留这个顺序。
- **聊天字体 CSS 不要放回全局 `app/layout.jsx`**：它是 87KB 的 range 列表，放全局会变成全站关键 CSS。它只该被 `/text-lab`、`/knowledge`、`/messages` 三个 page 引入。
- **不要再把 `.ttf` 放进 `public/`**：`public/` 下的一切都会随静态导出发布。字体源文件放 `assets/fonts/`，只有分片产物进 `public/fonts/`。
- **向量不要写回 `documents`**：向量存 `document_vectors`（float32 BLOB），检索层用「整库矩阵 + 指纹缓存」（`rag._vector_index`），库变了才重建。历史上把向量以 JSON 字符串存在 `documents.embedding`，418 块就有约 3MB JSON，每次提问都要全部解析一遍。改存储形态时记得同步 `rag_store.all_vectors` / `vector_fingerprint` / `schema_rag.migrate`。
- **切块不得跨小节合并**：`ingest.chunk_markdown` 按 ATX 标题分段，小节之间独立成块。一旦合并，`documents.section` 就只能标到块开头的那个节，引用精度直接丢失。
- **引用角标 `[n]` 与上下文序号强绑定**：`[n]` 的 n 就是 `build_context` 里的参考资料序号（1..`MAX_CONTEXT_CHUNKS`），`rag.citations` 按同一顺序产出。调种子数/上限时不要动这个对应关系；前端只把本轮真实存在的编号渲染成角标，其余 `[1]`、`[2024]` 保持纯文本。
- **标题锚点前后端各算一半**：后端只存 `documents.section`（标题路径文本），前端用「取 section 末级（分隔符是带空格的 ` / `）+ `headingSlug`」得到锚点 id。改 slug 规则时必须同时想到引用链接，否则跳转会静默失败（找不到元素就不滚，不报错）。
- **`conversations.user_id` 没有外键级联**：删用户不会删掉他的会话与消息（`messages` 跟着会话走）。清理测试账号时要按该用户 id 手动删会话和消息，否则留下孤儿会话。
- **导入 `backend/main.py` 就会对真实 `history.db` 执行 `init_db()`**：`main.py` 顶层调用了建表/迁移，所以跑 `pytest`（用例里 `import main`）或启动后端都会直接改真实库。写迁移时要保证幂等；别把测试数据写进真实库。
- 「关于」页（`/about`）提供项目架构图入口，新标签打开 `/architecture.html`。

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
- **面向站点发布**：`npm run sync:arch`（`predev` / `prebuild` 自动执行）会把 `docs/system-architecture.html` 复制到 `public/architecture.html`，站点通过 `/architecture.html` 访问（「关于」页入口）；该产物已 gitignore。
- **粒度约定**：架构图是基础设施级全貌；聊天 / 好友 / 认证 / 博客这类**功能级模块不单独画节点**，归到 `api` + `sqlite`，需要点出时写进底部卡片。
- 提交时把 `docs/` 下的 json、html、visual-check 证据一起带上。

## 文档维护

- `AGENTS.md` 给 AI 编码助手（硬约束与约定），`README.md` 给人类。项目结构、接口、技术栈或职责变动时二者同步更新。
- 上线部署见 `DEPLOY.md`；一键脚本 `deploy/deploy.sh`，配置模板 `deploy/nginx.conf`、`deploy/zero-to-full.service`。
