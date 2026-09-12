# 发布指南（部署到网站）

> 一句话链路：**本机（WSL）改代码 → 推到 GitHub → 服务器拉取并重建 → nginx 托管静态文件 + 反向代理 FastAPI**。
> 后端只管数据与接口，前端是纯静态导出（`out/`），所以「发前端」和「发后端」可以分开做。

## 0. 当前发布形态（现状事实）

| 项 | 值 |
| --- | --- |
| 线上地址 | <http://8.133.217.95>（IP + HTTP；等有域名再上 HTTPS，见 §6） |
| 前端静态目录 | `/var/www/zero-to-full`（nginx 托管，站点根） |
| 代码目录（服务器） | `/opt/zero-to-full`（若当初放在别处，改 `deploy/config.sh`） |
| 后端服务 | systemd `zero-to-full.service`，`127.0.0.1:8001`，**单 worker** |
| 反向代理 | `/api`、`/ws`、`/avatars` → `127.0.0.1:8001`（全站同源，无 CORS 问题） |
| 仓库 | `git@github.com:hsauihh/myfirstweb.git`（分支 `main`） |
| 部署状态文件 | 服务器项目根的 `.deploy-state`（记录上次成功发布的 commit，供 `update.sh` 续做） |
| 数据（**只在服务器**，不进仓库） | `backend/history.db`（用户/对话/博客/知识库向量/图谱）、`backend/avatars/` |

前端 `NEXT_PUBLIC_API_BASE_URL` 是**构建期内联**的：它决定浏览器去哪个地址调接口。同源部署时它就是站点地址（`deploy/config.sh` 里的 `SITE_URL`），**改域名必须重新构建前端**。

---

## 1. 日常发布（最常用：改完代码发上线）

在本机（项目根）：

```bash
npm run typecheck                 # 类型检查（build 也会做，先跑省得白等）
git add -A && git commit -m "改动说明"
git push origin main
```

在服务器（项目根）：

```bash
cd /opt/zero-to-full
sudo bash deploy/update.sh
```

`update.sh` 会自动完成：

1. `git pull --ff-only` 拉最新代码（并确保 `safe.directory` 已配置）；
2. 对比 `.deploy-state` 与当前 commit，**按改动范围**决定要做什么：
   - 有 `backend/` 改动 → `uv sync` + 重启后端；
   - 有前端相关改动（`app/ components/ css/ data/ docs/ public/ scripts/ package*.json next.config.*`）→ 构建并发布前端（依赖锁没变会跳过 `npm ci`）；
   - 两者都没有 → 直接跳过，不会白干活；
3. 发布目录里确实有 `index.html` 时才写 `.deploy-state`。所以中途 Ctrl+C / 构建失败时，**重跑会把没做完的部分补上**，也不会被「代码无变化」误判跳过。

验证：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://8.133.217.95/          # 期望 200
curl -s http://8.133.217.95/api/rag/status                              # 期望 ready:true + 规模数字
```

浏览器再点一遍：首页（卡片与最新/最热/公告）、`/blog`、`/knowledge`（问答/随心一记/图谱/来源管理）、`/text-lab`、`/messages`。

---

## 2. 改了什么 → 要发什么（对照表）

| 你改的东西 | 需要的动作 |
| --- | --- |
| `app/ components/ css/ data/ public/ docs/` | 只重建前端（`update.sh` 自动识别） |
| `backend/*.py`（接口、配额、知识库…） | `uv sync` + 重启 `zero-to-full` |
| `backend/.env`（模型 Key / 高德 Key / ANNOUNCE_KEY / ADMIN_USERNAMES） | 不用重建前端，只需 `sudo systemctl restart zero-to-full` |
| `deploy/config.sh`（站点地址、路径） | **必须重建前端**（API 基址内联在产物里），必要时重建 nginx 配置 |
| `package.json` / `package-lock.json` | 服务器会重跑 `npm ci`（国内较慢，见 §8） |
| `RAGdata/` 资料更新 | 本机重建后导入线上（§5「只把公共知识库搬到服务器」），**不要在服务器上跑 `ingest.py --rebuild`** |
| 只想发一条公告 | `cd backend && uv run python announce.py notice.json`（不涉及发布） |

> 前端产物 `out/` **不入库**（gitignore），所以永远不要「只 push 产物」：要么服务器重建，要么用 §4 的 rsync 方式。

### 服务器图谱为空（`entities` / `relations` 都是 0）怎么办

判断：

```bash
curl -s http://8.133.217.95/api/rag/status     # 期望 entities/relations > 0
```

如果是 `"entities":0,"relations":0`，且 `/knowledge` 的「知识图谱」页是空的，说明这个库**入过库但没抽图**（图谱是入库时抽的：`ingest.py` 默认开、`--no-graph` 关掉；图谱功能上线前入的库也没有）。

补法：**只补图谱**，不需要重传 `RAGdata`，也不重算向量、不动用户数据：

```bash
cd /opt/zero-to-full/backend
uv run python graph_build.py --dry-run    # 先看会处理哪些来源、多少块
uv run python graph_build.py              # 站内公共库补图
```

- 抽取按 6 块/次批量调模型：几百块的公共库大约几十次调用、几分钟；抽取结果按块内容哈希缓存（`graph_extractions`），重复跑不再调模型；
- 抽图是增强项：某个来源失败只打日志并继续，问答会自动降级为纯向量检索，不影响可用性；
- 个人库默认不动（要一起补加 `--personal`；个人库一般在「加入知识库 / 重新同步」时已自动抽过）。

> 什么时候**不需要**重建：只要求问答可用（向量检索照常工作）时可以不管；但想要「知识图谱」页、首页概览里的实体/关系数字、以及一问一跳的图谱增益，就必须补上。

> 顺带一提：线上与本地如果块数不一致（例如线上 416 / 本地 513），说明服务器上的 `RAGdata/` 是另一份（该目录被 gitignore，`git pull` 带不过去）。想让两边资料一致，按 §5「只把公共知识库搬到服务器」做——本机重建后导入，不在服务器上重跑 `ingest.py`。

---

## 3. 首次发布 / 换一台新服务器

前置：Ubuntu 22.04+、root/sudo、公网 IP、放行 80/443（阿里云安全组也要放行）。

```bash
# 3.1 基础环境
sudo apt update && sudo apt install -y nginx git curl rsync
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
curl -LsSf https://astral.sh/uv/install.sh | sh && source ~/.bashrc

# 3.2 拉代码（用部署用户的 SSH key，能 git pull 才有后面的一键更新）
sudo mkdir -p /opt/zero-to-full && sudo chown -R "$USER":"$USER" /opt/zero-to-full
git clone git@github.com:hsauihh/myfirstweb.git /opt/zero-to-full

# 3.3 后端依赖与环境变量
cd /opt/zero-to-full/backend
uv sync                              # 不要用 sudo，否则 .venv 归属 root（见 §8）
cat > .env <<'EOF'
AMAP_KEY=你的高德Key
CHAT_BASE_URL=https://api.deepseek.com/v1
CHAT_API_KEY=你的模型Key
CHAT_MODEL=deepseek-chat
CHAT_SYSTEM_PROMPT=你是「零到全栈」站点的 AI 助手。
ANNOUNCE_KEY=随机字符串
ADMIN_USERNAMES=ryaich
EOF

# 3.4 迁移数据（可选：不传就是空库）
#   本机执行：
#   scp backend/history.db  <user>@8.133.217.95:/opt/zero-to-full/backend/
#   rsync -az backend/avatars/ <user>@8.133.217.95:/opt/zero-to-full/backend/avatars/

# 3.5 预热本地向量模型（约 100MB，只需一次；必须显式指定持久目录）
.venv/bin/python -c "import os; from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-zh-v1.5', cache_dir=os.path.expanduser('~/.cache/fastembed'))"

# 3.6 起后端
sudo cp /opt/zero-to-full/deploy/zero-to-full.service /etc/systemd/system/
sudo sed -i "s/YOUR_USER/$USER/" /etc/systemd/system/zero-to-full.service
sudo systemctl daemon-reload && sudo systemctl enable --now zero-to-full
curl -s http://127.0.0.1:8001/api/rag/status

# 3.7 第一次全量发布（装服务 + 构建前端 + 配 nginx）
cd /opt/zero-to-full
sudo bash deploy/deploy.sh           # 会生成 nginx 配置（纯 HTTP）并构建发布
```

> 空库没有图谱数据：需要时手动建一次 `cd backend && uv run python ingest.py ../RAGdata --rebuild`。

---

## 4. 只发前端（不碰后端，最快）

两种情况都行：

**A. 在服务器上重建（推荐，和 §1 一样，只是手动）**

```bash
cd /opt/zero-to-full && git pull --ff-only
npm ci --no-audit --no-fund --prefer-offline     # 依赖锁没变可跳过
NEXT_PUBLIC_API_BASE_URL=http://8.133.217.95 npm run build
sudo rsync -a --delete out/ /var/www/zero-to-full/
sudo systemctl reload nginx
```

**B. 本机构建后推产物（网络好、想省服务器 CPU 时）**

```bash
NEXT_PUBLIC_API_BASE_URL=http://8.133.217.95 npm run build
rsync -az --delete out/ <user>@8.133.217.95:/var/www/zero-to-full/
```

要点：

- 必须带 `--delete`：否则下线的旧产物（例如已删掉的字体文件）会残留在静态目录；
- `out/` 是纯静态文件，直接丢进 nginx 站点根目录即可生效，不需要重启后端；
- **本机 `npm run dev` 与 `npm run build` 不要同时跑**：两者共用 `.next`，会互相覆盖（表现为页面卡预渲染、`ENOENT`）。要打包先停 dev，打完再起。

---

## 5. 关于数据库与数据迁移

- `backend/history.db` 是**唯一**的业务数据源（用户、登录态会话、对话与消息、博客、订单、知识库块与向量、图谱、公告与已读）。
- 首次部署若不传该文件，服务器会新建空库：用户要重新注册、知识库为空、`RAGdata` 需要重新入库。
- **表结构迁移是自动的**：后端起服务时会执行 `init_db()`（幂等）。历史上做过一次 `kb_sources` 表重建（升级成多态来源表），迁移在事务外关闭外键执行、逐行保留 id，并用「有没有块失去来源行」自检；这类迁移改动前务必**先拿 `history.db` 副本跑一遍**再上生产。
- 备份（建议加进 crontab；**备份落在项目目录外**，`history.db.*.bak` 这种名字不被 gitignore 匹配，留在仓库里有被误提交的风险）：

  ```bash
  cd /opt/zero-to-full/backend && cp history.db ~/history-backup-$(date +%F).db
  rsync -az avatars/ /path/to/backup/avatars/
  ```

### 只把公共知识库搬到服务器（不覆盖用户数据）

线上已有真实用户时，**不要**整体覆盖 `history.db`，也**不要**在服务器上跑 `ingest.py --rebuild`：它先清空公共库再重算，中途卡住（模型联网下载、OOM）就只剩一个空库。正确做法是本机重建、服务器导入：

```bash
# 1. 本机：重建公共库（含图谱）
cd backend && uv run python ingest.py ../RAGdata --rebuild

# 2. 本机：把库副本推上去（放项目目录外，别覆盖线上那个）
rsync -avz --progress backend/history.db ubuntu@8.133.217.95:~/history.db.push

# 3. 服务器：停服务 → 先看会导入什么 → 导入 → 重启
cd ~/zero-to-full/backend
sudo systemctl stop zero-to-full
uv run python import_public.py ~/history.db.push --dry-run
uv run python import_public.py ~/history.db.push
sudo systemctl restart zero-to-full      # 必须重启：检索层缓存了整库向量矩阵
curl -s http://127.0.0.1:8001/api/rag/status
```

`import_public.py` 的行为：

- 只替换站内公共库（`documents.source_id IS NULL`）；用户、登录态、对话、博客、个人知识库与配额一行不动；
- 块与图谱 **id 会重映射**（源库的 id 会和个人库撞车）；单事务，失败整笔回滚，提交前还会自检「块 / 向量条数是否与源库一致」；
- 幂等：同源库连跑两次结果一致；
- 顺手清掉指向已删块的死数据（向量 / 提及 / 关系）与不再被任何块提到的实体；
- `--no-extractions` 不搬图谱抽取缓存（默认搬，服务器上以后补图就不用再调模型）。

> 先在本地拿真实库演练一遍再动线上：把 `backend/history.db` 复制到临时目录当「线上库」，把脚本的 `DB_FILE`（`db.py`）临时指过去跑一次。脚本在测试里已覆盖「只换公共库、保留用户与个人库、可重复执行、清死数据」四种情形。

---

## 6. 域名与 HTTPS

当前是 IP + HTTP。上线域名时：

1. 域名 A 记录解析到服务器 IP；阿里云安全组放行 443；
2. 改 `deploy/config.sh`：`SITE_URL="https://你的域名"`、`SERVER_NAME="你的域名"`，提交并 push；
3. 服务器：`git pull` →（nginx 里 server_name 还是旧值时）`sudo bash deploy/deploy.sh` 重建配置与前端 → `sudo certbot --nginx -d 你的域名`；
4. 之后**日常更新只用 `deploy/update.sh`**：`deploy.sh` 会用模板重写 nginx 配置，把 certbot 加的 443/证书段覆盖掉。

加固（可选）：HTTPS 稳定后给 `backend/session.py`、`backend/auth.py` 的 cookie 加 `secure=True`。

---

## 7. 验证清单（每次发布后）

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://8.133.217.95/     # 200
curl -s http://8.133.217.95/api/rag/status                        # ready:true
curl -s -o /dev/null -w "%{http_code}\n" http://8.133.217.95/blog # 200
sudo systemctl is-active zero-to-full                             # active
```

浏览器：

- 首页：卡片对齐、最新/最热/公告有数据、「每日一句」可点击切换；
- `/knowledge`：四个页签都能开，问答能出流式回复并有来源引用；
- `/messages`：好友列表与实时消息（Network 里 `wss://…/ws/friends` 状态 101）；
- 登录态：注册/登录成功、头像能显示（`/avatars/…`）；
- 换主题：浅色/暗色都正常。

---

## 8. 常见问题

**`update.sh` 卡在「构建并发布」不动**
那是 `npm ci` / `npm run build` 在联网或编译（终端里 `⠇` 是进度指示）。国内拉 npm 常很慢，可先 `Ctrl+C`，换镜像再手动跑：

```bash
npm config set registry https://registry.npmmirror.com
npm ci --no-audit --no-fund --prefer-offline
NEXT_PUBLIC_API_BASE_URL=http://8.133.217.95 npm run build
sudo rsync -a --delete out/ /var/www/zero-to-full/ && sudo systemctl reload nginx
```

**`update.sh` 里 `uv sync` 报 `bad interpreter: Permission denied`**
`.venv` 是 root 建的、指向 `/root/.local/...` 的 Python，而服务以普通用户跑。用部署用户重建（不要 sudo）：

```bash
cd /opt/zero-to-full/backend && rm -rf .venv
export PATH="$HOME/.local/bin:$PATH" && uv sync
sudo systemctl restart zero-to-full
```

**知识库问答一直没输出 / 首次很慢**
向量模型丢了：`fastembed` 默认缓存到 `/tmp`，重启即失，然后会去联网下载（国内会卡住）。确认 `~/.cache/fastembed` 里有 `fast-bge-small-zh-v1.5`，没有就按 §3.5 重新预热（离线环境可设 `HF_ENDPOINT=https://hf-mirror.com HF_HUB_DISABLE_XET=1`）。

**改了域名但页面还调旧接口**
`NEXT_PUBLIC_API_BASE_URL` 是构建期内联的：必须重建前端（§4），只重启后端无效。

**知识图谱空白 / 页面元素隐身**
架构上是「懒加载面板 + 卡片入场动画」的组合，历史上踩过两个坑：入场初始态把后挂载的卡片永久留在透明、图谱悬停整图明暗振荡。排查时别只看 DOM 是否存在，要同时看 `getComputedStyle(el).opacity`；详细成因写在 `README.md` 的「开发避坑」。

**排查命令**

```bash
sudo systemctl status zero-to-full --no-pager -l
sudo journalctl -u zero-to-full -n 80 --no-pager
sudo nginx -t && sudo systemctl reload nginx
curl -s http://127.0.0.1:8001/api/rag/status
```

---

## 9. 回滚

```bash
cd /opt/zero-to-full
git log --oneline -5                       # 找到要回退到的 commit
git reset --hard <commit>                  # 或者 git revert <commit> 生成反向提交
sudo bash deploy/update.sh                 # .deploy-state 与实际 HEAD 不一致 → 会重新构建发布
```

`git reset --hard` 只动代码与产物；`backend/history.db` 与 `backend/avatars/` 不受影响。若某次改动带来了数据层面的迁移，回滚代码不会回滚数据——迁移按幂等设计，回滚后仍可运行。
