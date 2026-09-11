# RAG 方案建议

给 AI 对话加检索增强（RAG）的设计建议。

> 状态：**阶段 1 已实现**（`RAGdata/` 入库 + 本地 fastembed 向量化 + 余弦检索 + 注入提示词 + 独立额度），并已实现**个人知识库**（登录用户把博客文章选入自己的知识库、来源管理与懒同步，检索时与站内公共库合并），见 README「知识库（RAG）」与 `/knowledge`。本文保留完整方案与后续阶段。

## 1. 目标

让 AI 回答基于「我们自己的资料」（站内文案、说明文档等），减少瞎编；资料里没有的就直说。

## 2. 知识来源

先做**站内 Markdown**（改动最小、内容可控）：

- `README.md`、`struct.md`、`RAG.md`
- 页面文案：`data/site.js`、`data/quotes.js`
- 博客文章：登录用户把自己或他人的公开文章选入个人知识库（`kb_sources` + `documents.source_id`），不再依赖文件目录

后续再扩展本地文档（PDF/Word），需要额外的解析（`pypdf` / `python-docx`）。

## 3. 切块（chunking）

- 按标题/段落切，目标 **约 500 字**，相邻块重叠 **约 50 字**，避免答案被切断。
- 每块保留元数据：来源文件、标题路径、块序号。
- 太短（<50 字）的块丢弃，太长的按句号/换行再切。

## 4. 向量化（embedding）

- 走 **OpenAI 兼容的 embeddings 接口**，新增环境变量：
  - `EMBEDDING_BASE_URL`、`EMBEDDING_API_KEY`、`EMBEDDING_MODEL`
  - 可沿用现有 `CHAT_*` 配置，也可指向支持 embeddings 的厂商（通义 `text-embedding-v3`、OpenAI `text-embedding-3-small` 等）。
- 暂不引入本地 `sentence-transformers`：依赖重（torch）、下载模型大，收益不如先跑通链路。
- 同一批入库必须用同一个模型与维度；换模型要 `--rebuild` 重建。

## 5. 存储与检索

- SQLite 新表：
  ```
  documents(id, source, chunk_index, title, content, embedding TEXT, created_at)
  ```
  向量以 JSON 字符串存 `embedding` 列。
- 检索用 **numpy 暴力余弦相似度**：个人站知识库通常几百到几千块，全量算一次毫秒级，不需要向量数据库。
- 量大（>10 万块）再换 `sqlite-vec`（SQLite 扩展）或 FAISS。
- 返回 **top-k（k=4）**，并设**相似度阈值**（如 0.3），低于阈值的不注入，避免答非所问。

## 6. 入库脚本

- 新增 `backend/ingest.py <目录>`：
  1. 遍历目录下 `.md` / `.txt`；
  2. 切块；
  3. 批量调用 embeddings；
  4. 写 `documents` 表。
- 支持 `--rebuild` 清空重建；日常可增量（按文件 mtime/哈希跳过没变的文件）。

## 7. 接入点

- `chat.build_messages` 增加可选参数 `context: str`，拼在 system 提示词里。
- `chat_api.send_message_endpoint` 在拼消息前：
  1. 用用户问题做 embedding；
  2. 检索 top-k；
  3. 拼成带来源的上下文。
- 不改动现有 SSE / 落库逻辑。

## 8. 提示词建议

```
你是文字实验室的中文助手。优先依据下面的「参考资料」回答；
资料不足或与问题无关时，直接说明没有相关资料，不要编造。
回答末尾标注引用的来源文件名。

参考资料：
[1] （来源：README.md）
...
```

## 9. 成本与延迟

- 每次提问多一次 embedding 调用（通常几十毫秒）；可用内存 LRU 缓存高频问题。
- 检索本身几乎无成本；知识库重建才需要批量 embedding。

## 10. 评估

- 准备 10–20 条站内问题（如「这个项目怎么启动后端」「消息中心有哪些功能」）。
- 人工看三件事：**是否检索到正确资料**、**答案是否引用来源**、**资料缺失时是否老实说不知道**。

## 11. 分期建议

| 阶段 | 内容 |
|------|------|
| 阶段 1 | 站内 Markdown + 切块 + embedding + 暴力检索 + 注入提示词（最小可用） |
| 阶段 2 | 个人知识库（博客文章选入 + 来源管理 + 懒同步 + 按用户检索隔离） |
| 阶段 3 | 增量入库、按来源过滤、检索结果去重 |
| 阶段 4 | 重排（rerank）、混合检索（关键词 + 向量）、引用高亮 |

## 12. 取舍

- **优点**：答案有据可依、可更新、实现成本低（无新服务）。
- **风险**：embedding 依赖外部接口（需 key）；知识库不更新会答旧内容（靠 `ingest.py` 定期跑）；暴力检索在超大数据下会变慢（届时再升级）。
