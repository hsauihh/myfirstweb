# 部署共享配置：被 deploy.sh / update.sh 通过 source 引入。
# 换域名、改路径时只改这里。

SITE_URL="http://8.133.217.95"       # 前端注入的 API 基址（含协议）
SERVER_NAME="8.133.217.95"           # nginx server_name（域名或 IP）
WEB_ROOT="/var/www/zero-to-full"     # 前端静态文件目录
BACKEND_PORT="8001"                  # 后端监听端口（仅本机）
MODEL="BAAI/bge-small-zh-v1.5"       # RAG 本地向量模型

# SCRIPT_DIR 由调用方在 source 本文件前设置
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
RUN_USER="${SUDO_USER:-$USER}"

# 部署状态：记录「上次成功发布」的 commit。
# update.sh 用它判断是否有未发布的改动——这样即使上次跑到一半被中断，重跑也会补上。
STATE_FILE="$PROJECT_DIR/.deploy-state"

read_deployed() {
  [ -f "$STATE_FILE" ] && cat "$STATE_FILE" || true
}

mark_deployed() {
  local head
  head="$(sudo -u "$RUN_USER" git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)"
  [ -n "$head" ] || return 0
  printf '%s' "$head" | sudo tee "$STATE_FILE" >/dev/null
  sudo chown "$RUN_USER" "$STATE_FILE"
}
