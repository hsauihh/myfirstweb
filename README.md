# zero-to-full · 零到全栈

个人主页 + 文字实验室。输入中文，后端做情感分析与拼音标注、结果存入 SQLite；主页内容由后端接口实时提供。前端 Next.js 与后端 FastAPI 独立运行，通过 HTTP 联调。

## 技术栈

| 端 | 技术 |
|----|------|
| 前端 | Next.js 15（App Router）、React 19、animejs v4、手写 CSS|
| 后端 | Python ≥3.13、FastAPI、SnowNLP、pypinyin、SQLite、uv |

前端 `output: 'export'` 静态导出；animejs 用 v4 具名导入；中文字体霞鹜文楷 LXGW WenKai（简体，`css/fonts.css`）。

## 快速开始

后端（需在 `backend/` 目录下运行；端口从 `backend/.env` 的 `PORT` 读取，默认 8001）：

```bash
cd backend
uv run --env-file .env fastapi dev
```

> `fastapi dev` 的端口取自 `PORT` 环境变量，`uv run` 通过 `--env-file .env` 把 `backend/.env` 注入进程（uv 默认不自动读 `.env`）。若需换端口，改 `.env` 里的 `PORT` 即可。

前端（端口 3000）：

```bash
npm run dev
```

前端通过 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 定位后端（当前 `http://localhost:8001`）。构建：`npm run build`（产物在 `out/`，任意静态服务器托管；`next start` 与静态导出不兼容）。

## 目录结构

```
zero-to-full/
├── app/          # 路由页：/、/text-lab、/about、/blog、/works
├── components/   # 页面与交互组件（含 Nav 顶栏 / WeatherWidget 天气 / ThemeToggle 主题 / WorksGrid 作品网格）
├── data/         # 静态文案与打底数据（site.js、quotes.js）
├── css/          # 手写样式
├── backend/      # FastAPI 服务：main.py（接口层）、storage.py（SQLite 层）、weather.py（天气）
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

- 情感判定：score ≥ 0.6 偏积极，≤ 0.4 偏消极，其余中性。
- 历史按会话隔离（`session_id` Cookie，有效期 30 天）；`DELETE /api/history` 只清当前访客自己的记录。

## 说明

- CORS 允许 `http://localhost:3000`；改动前端端口需同步 `backend/main.py` 的 `allow_origins`。
- 后端不可用时前端回退 `data/site.js` 打底数据，页面不崩。
- `/api/analyze` 尚未校验空字符串 / 超长文本。
- 界面设计：霞鹜文楷字体、米白背景 + 青绿主色、实色卡片；支持浅色/暗色双模式（顶部导航切换，默认跟随系统偏好、记忆用户选择）。
- 天气卡片在全站顶部导航常驻：首次进入自动获取，点击卡片可刷新，悬停/聚焦展开湿度/风向/更新时间。
- 天气依赖高德开放平台：key 写在 `backend/.env`（已 gitignore），后端启动时自动加载；本地/无法定位的 IP 会回退到服务器出口定位；未配置或定位失败时接口返回 4xx/503，前端静默隐藏天气。

## 文档维护

- `AGENTS.md` 给 AI 编码助手（硬约束与约定），`README.md` 给人类。项目结构、接口、技术栈或职责变动时二者同步更新。
