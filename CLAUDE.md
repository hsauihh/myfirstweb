# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

`zero-to-full` = 个人主页 + 文字实验室。

- **前端**：Next.js 15 / React 19 / App Router / animejs / 手写 CSS，`output: 'export'` 静态导出。
- **后端**：Python ≥3.13，FastAPI + SnowNLP（情感）+ pypinyin（拼音）+ SQLite，uv 管理依赖。
- 前后端通过 HTTP 通信、可独立运行。前端失败时用 `data/site.js` 降级。

## 常用命令

前端（项目根目录）：

```bash
npm install      # 装依赖
npm run dev      # 开发，http://localhost:3000
npm run build    # 构建，静态导出产物到 out/
```

后端（**必须在 `backend/` 目录下运行**，因为 `main.py` 用相对导入）：

```bash
cd backend
uv run uvicorn main:app --reload --port 8001
```

- 加依赖：前端 `npm install <pkg>`，后端 `uv add <pkg>`（别手动改 `pyproject.toml` / 锁文件）。
- **没有 test / lint 脚本**，别假设存在 `npm test` / `npm run lint`。
- `next start` 与 `output: 'export'` 不兼容，构建产物交给任意静态服务器托管（如 `npx serve out`）。

## 架构与数据流

```text
Next.js 静态前端 ──HTTP──▶ FastAPI 后端 ──▶ SnowNLP / pypinyin ──▶ SQLite
        ▲                       (main.py=API 层，storage.py=DB 层)
        └─── 失败时回退 data/site.js
```

- `app/` 只管路由（`/` 主页、`/text-lab` 文字实验室），复杂逻辑放 `components/`。
- `data/site.js` 存静态内容 + 后端失败 fallback，字段必须与后端兼容。
- 现有组件：`HomeView`（拉取 `/api/profile`）、`TextLabView`（结果 state 提升于此）、`InputCard`（POST `/api/analyze`）、`ResultCard`（animejs 展示结果）、`Nav`、`PageHeading`、`AnimatedCardGrid`（卡片飞入动画容器）。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/profile`  | 主页内容：`heroTitle` / `heroSubtitle` / `featuredWork` / `identity` |
| POST | `/api/analyze`  | 入参 `{text}` → `score` / `label` / `pinyin` / `created_at`，写入 SQLite |
| GET  | `/api/history`  | 最近 10 条，按 `created_at` 降序 |

- `featuredWork` 是**对象**：`{ kicker, title, copy, linkLabel }`；`identity` 是 `{ motto, learning }`。
- 情感判定：`score ≥ 0.6` → 偏积极，`≤ 0.4` → 偏消极，否则中性。

## 硬性约束（改代码前必读）

**前端**
1. 保留 `output: 'export'`；别引入依赖服务器运行时的功能（Server Actions / 动态 API Route）。
2. 用 `process.env.NEXT_PUBLIC_API_BASE_URL` 取后端地址，禁止硬编码 URL。
3. 请求必须检查 `response.ok`。主页失败 → 用 `data/site.js`；文字实验室失败 → 显示错误、保留输入、不崩。
4. animejs 是 **v4 具名导入**：`import { animate, stagger } from "animejs"`；别用 v3 默认导出 `anime(...)`。
5. 只在需要客户端能力时写 `"use client"`；样式用手写 CSS + CSS Variables，别用 inline style、别引 UI 框架。

**后端**
6. `main.py` 只处理 HTTP 和业务，SQL 一律进 `storage.py`；用参数化查询，禁止字符串拼接 SQL。
7. 用 Pydantic 模型校验请求；别吞异常，返回合理状态码（400/422/500），别让连接重置。
8. 情感阈值（0.6 / 0.4）别改；要改就同时改代码和前端口径。
9. 别修改 `backend/handmade.py`（旧版 http.server 原型）。
10. CORS 用明确来源 `http://localhost:3000`，别用 `allow_origins=["*"]`（除非明确授权并理解后果）。

**通用**
11. 改接口 / 字段时，同步检查「后端返回 + 前端读取 + `data/site.js` fallback + CORS」四处。
12. 最小改动：1 个文件能解决就别顺手重构；保持架构稳定，不做不必要的架构升级。

## 现状（与文档期望的差距）

- `/api/history` 后端可用，但前端组件**尚未**调用它（无历史记录展示逻辑）。
- `/api/analyze` 目前只用 Pydantic 校验 `text` 必填，**尚未**处理空字符串 / 非法 / 超长文本。

## 其它

- `CLAUDE.md` 被 `.gitignore` 忽略、未纳入 git 追踪，属于本地工作文件，改动不会提交。
