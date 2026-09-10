# 部署上线（Ubuntu + nginx）

> 架构：nginx 托管前端静态文件，并把 `/api`、`/ws`、`/avatars` 反向代理到本机 FastAPI（uvicorn，单 worker）。
> 全站同源，前端 `NEXT_PUBLIC_API_BASE_URL` 在构建时注入为站点地址。

## 快速部署（一键脚本，推荐）

1. 把代码放到服务器（如 `/opt/zero-to-full`），确保能访问项目根目录。
2. 保留数据：把本地的 `backend/history.db` 和 `backend/avatars/` 传到服务器对应目录（`history.db` 含用户与知识库向量；不传则新建空库）。
3. 在项目根目录执行：

   ```bash
   sudo bash deploy/deploy.sh
   ```

脚本会自动完成：装依赖（nginx / Node 20 / uv）→ `uv sync` → 校验 `.env` → 装 systemd 服务 → 构建前端并发布 → 配置 nginx → 预热向量模型 → 启动服务。

- 首次运行若缺 `backend/.env`，脚本会生成模板并退出，填好密钥后重跑即可。
- 当前按 IP + HTTP 部署（`SITE_URL=http://8.133.217.95`）；换域名 / 开 HTTPS 改脚本顶部变量后重跑，再执行 `certbot --nginx -d 你的域名`。
- 阿里云安全组需放行 80 端口。

---

以下为手动部署步骤（了解细节或脚本不适用时参考）。

## 0. 前置条件

- 一台 Ubuntu 22.04 / 24.04 云服务器（root 或 sudo 权限）。
- 一个域名，已把 A 记录解析到服务器公网 IP。
- 开放 80 / 443 端口；8001 只在 `127.0.0.1` 监听，不对外暴露。

下文用以下占位符，请替换成自己的值：

| 占位符 | 含义 | 示例 |
| --- | --- | --- |
| `YOUR_DOMAIN` | 站点域名 | `example.com` |
| `DEPLOY_DIR` | 代码目录 | `/opt/zero-to-full` |
| `WEB_ROOT` | 前端静态根目录 | `/var/www/zero-to-full` |

## 1. 服务器初始化

```bash
# 基础依赖
sudo apt update && sudo apt install -y nginx git curl

# Node 20（构建前端用）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# uv（管理 Python 3.13 与依赖）
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc          # 让 uv 进入 PATH
```

## 2. 上传代码

```bash
sudo mkdir -p /opt/zero-to-full
# 方式 A：git 克隆
sudo git clone <你的仓库地址> /opt/zero-to-full
# 方式 B：本地 rsync（排除大目录与产物）
# rsync -az --delete --exclude node_modules --exclude .next --exclude .git \
#   --exclude RAGdata --exclude 'out' ./ user@SERVER_IP:/opt/zero-to-full/

sudo chown -R "$USER":"$USER" /opt/zero-to-full
cd /opt/zero-to-full
```

## 3. 后端

```bash
cd /opt/zero-to-full/backend

# 3.1 安装依赖（uv 会自动拉取 Python 3.13 到 .venv）
uv sync

# 3.2 配置环境变量（不要提交到仓库）
cat > .env <<'EOF'
AMAP_KEY=你的高德Key
CHAT_BASE_URL=https://api.deepseek.com/v1
CHAT_API_KEY=你的模型Key
CHAT_MODEL=deepseek-chat
CHAT_SYSTEM_PROMPT=你是「零到全栈」站点的 AI 助手。
ANNOUNCE_KEY=随机字符串
ADMIN_USERNAMES=ryaich
EOF

# 3.3 迁移数据（含用户、RAG 向量）：从本地把 history.db 与 avatars/ 传上来
#   本地执行：
#   scp backend/history.db user@SERVER_IP:/opt/zero-to-full/backend/
#   rsync -az backend/avatars/ user@SERVER_IP:/opt/zero-to-full/backend/avatars/
# 说明：不传 history.db 会新建空库（用户与知识库全空）；RAGdata/ 无需上传。

# 3.4 预热本地向量模型（约 100MB，下到 ~/.cache/fastembed，需联网一次）
#     必须显式指定 cache_dir：否则会落到 /tmp，重启即丢，之后加载会联网卡死
.venv/bin/python -c "import os; from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-zh-v1.5', cache_dir=os.path.expanduser('~/.cache/fastembed'))"
```

## 4. 后端常驻（systemd）

```bash
sudo cp /opt/zero-to-full/deploy/zero-to-full.service /etc/systemd/system/
sudo sed -i "s/YOUR_USER/$USER/" /etc/systemd/system/zero-to-full.service   # 用当前登录用户跑服务
sudo systemctl daemon-reload
sudo systemctl enable --now zero-to-full
sudo systemctl status zero-to-full --no-pager
curl -s http://127.0.0.1:8001/api/rag/status    # 期望 {"ready":true,...}
```

> 必须单 worker：好友 WebSocket 的连接表在进程内存里，多 worker 会分片。

## 5. 构建前端

```bash
cd /opt/zero-to-full
npm ci
NEXT_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN npm run build

sudo mkdir -p /var/www/zero-to-full
sudo rm -rf /var/www/zero-to-full/*
sudo cp -r out/* /var/www/zero-to-full/
```

> `NEXT_PUBLIC_*` 是构建期内联的，改域名必须重新 `npm run build`。

## 6. nginx

```bash
sudo cp /opt/zero-to-full/deploy/nginx.conf /etc/nginx/sites-available/zero-to-full
sudo sed -i 's/YOUR_DOMAIN/你的域名/g' /etc/nginx/sites-available/zero-to-full
sudo ln -sf /etc/nginx/sites-available/zero-to-full /etc/nginx/sites-enabled/zero-to-full
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 7. HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
sudo systemctl enable --now certbot.timer   # 自动续期
```

## 8. 验证

- 浏览器打开 `https://YOUR_DOMAIN`，逐页点开 `/text-lab`、`/messages`、`/login`。
- 登录后发一条消息、与好友聊天，确认实时推送正常（浏览器 Network 里 `wss://YOUR_DOMAIN/ws/friends` 状态 101）。
- 头像能正常显示（`/avatars/...`）。

## 9. 后续更新

一行命令（自动按改动范围重建后端/前端，无变化则跳过）：

```bash
cd ~/zero-to-full && sudo bash deploy/update.sh
```

脚本会在项目根写 `.deploy-state` 记录**上次成功发布的 commit**：所以即使上次跑到一半被中断（例如卡在 `npm ci`），**重跑会接着把没做完的部分补上**，不会被“代码无变化”跳过。

手动方式（了解细节时参考）：

```bash
cd ~/zero-to-full && git pull
# 后端
cd backend && uv sync && sudo systemctl restart zero-to-full
# 前端
cd .. && npm ci && NEXT_PUBLIC_API_BASE_URL=http://8.133.217.95 npm run build
sudo rsync -a --delete out/ /var/www/zero-to-full/
```

## 10. 注意事项

- **CORS**：后端写死 `allow_origins=["http://localhost:3000"]`；同源部署不会触发 CORS，无需改动。若前端要放到别的域名，需在 `backend/main.py` 补上生产域名。
- **Cookie**：目前 `httponly + samesite=lax`。上 HTTPS 后可给 `backend/session.py`、`backend/auth.py` 的 `set_cookie` 加 `secure=True` 加固（可选）。
- **备份**：定期备份 `backend/history.db` 与 `backend/avatars/`，它们承载全部用户与聊天数据。
- **公告发布**：服务器上用 `ANNOUNCE_KEY` 调 `backend/announce.py` 发布公告。

## 11. 常见问题

**后端起不来：`.venv/bin/python: bad interpreter: Permission denied`**

原因：`uv sync` 以 root 身份跑，`.venv/bin/python` 指向了 `/root/.local/...` 的 Python，而服务以普通用户运行、无权访问。

修复（用部署用户重建 venv，不要 sudo）：

```bash
cd ~/zero-to-full/backend
rm -rf .venv
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv sync
sudo systemctl restart zero-to-full
```

（`deploy/deploy.sh` 已修正：uv 装在部署用户下，`uv sync` 也以该用户执行。）

**`update.sh` 卡在「前端有改动：构建并发布」**

那是 `npm ci` 在联网拉包（终端里的 `⠇` 是 npm 的进度指示）。国内访问 `registry.npmjs.org` 常很慢甚至超时，看起来像卡死。

先 `Ctrl+C`，改用国内镜像手动跑完前端：

```bash
cd ~/zero-to-full
npm config set registry https://registry.npmmirror.com
npm ci --no-audit --no-fund --prefer-offline
NEXT_PUBLIC_API_BASE_URL=http://8.133.217.95 npm run build
sudo rsync -a --delete out/ /var/www/zero-to-full/
sudo systemctl reload nginx
```

（`update.sh` 已优化：`package-lock.json` 未变时跳过 `npm ci`，只重新构建。）

**排查命令**

```bash
sudo systemctl status zero-to-full --no-pager -l
sudo journalctl -u zero-to-full -n 80 --no-pager
curl -s http://127.0.0.1:8001/api/rag/status
```
