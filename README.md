# zero-to-full · 零到全栈

个人主页 + 文字实验室。输入一段中文，后端用 SnowNLP 做情感分析、用 pypinyin 生成拼音，结果存入 SQLite 并返回展示；主页内容从后端接口实时获取。

项目分为前端（Next.js）和后端（FastAPI）两部分，各自独立运行、通过 HTTP 联调。

## 技术栈

- **前端**：Next.js 15（App Router）/ React 19 / animejs，手写 CSS 设计体系，`output: 'export'` 静态导出。animejs 用 **v4 具名导入**（`import { animate, stagger } from "animejs"`）。
- **后端**：Python ≥3.13，FastAPI + pypinyin + snownlp + requests，SQLite 存储，uv 管理依赖。

## 目录结构

```
zero-to-full/
├── app/                # Next.js 路由：/（主页）、/text-lab（文字实验室）
├── components/         # 前端组件（HomeView / TextLabView / InputCard / ResultCard / Nav / PageHeading / AnimatedCardGrid）
├── data/site.js        # 静态内容，后端数据失败时的打底
├── css/                # 手写样式（reset / variables / layout / hero / nav / cards / lab / responsive）
├── backend/            # Python 后端（uv 项目）
│   ├── main.py         # FastAPI 应用（API 层，见下）
│   ├── storage.py      # SQLite 层（所有 SQL 集中在此）
│   ├── handmade.py     # 旧版 http.server 原型，已废弃
│   └── pyproject.toml  # 依赖与项目定义
├── next.config.mjs     # output: 'export' 静态导出
└── .env.local          # NEXT_PUBLIC_API_BASE_URL（前端调后端地址）
```

## 快速开始

### 1. 启动后端（端口 8001）

```bash
cd backend
uv run uvicorn main:app --reload --port 8001
```

> 必须在 `backend/` 目录下运行，因为 `main.py` 使用相对导入。

### 2. 启动前端（默认 http://localhost:3000）

```bash
npm run dev
```

前端请求后端地址由 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 决定，当前为 `http://localhost:8001`。构建：`npm run build`（静态导出产物在 `out/`）。

> 注：项目未配置 test / lint 脚本；`next start` 与 `output: 'export'` 不兼容，构建产物由任意静态服务器托管。

## 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/profile` | 主页内容（heroTitle / heroSubtitle / featuredWork / identity） |
| POST | `/api/analyze` | 入参 `{text}` → `score`、`label`、`pinyin`、`created_at`，并写入 SQLite |
| GET  | `/api/history` | 最近 10 条历史记录，按时间倒序 |

情感判定：score ≥ 0.6 → 偏积极，≤ 0.4 → 偏消极，否则中性。

## 说明

- 后端已配置 CORS，允许 `http://localhost:3000` 来源；前端改动端口时需同步修改 `backend/main.py` 的 `allow_origins`。
- 后端失败时前端不崩：主页回退显示 `data/site.js` 打底数据，文字实验室在按钮上方显示错误提示。
- 当前 `/api/history` 后端可用但前端尚未接入；`/api/analyze` 尚未校验空字符串 / 超长文本。

## 文档维护

- `CLAUDE.md`（给 Claude Code 的约束文档）与 `README.md`（给人类的说明）**在项目结构、接口、技术栈或职责变动时应一起同步更新**。
- 约定：`CLAUDE.md` 保持精简，只写非协商的硬约束和关键约定；`README.md` 面向人类，保留介绍与示例。
- 注意：`CLAUDE.md` 被 `.gitignore` 忽略、不在 git 追踪内，属本地工作文件。
