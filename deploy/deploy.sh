#!/usr/bin/env bash
# 一键部署：Ubuntu 24.04+ / nginx / systemd
#
# 用法（把代码放到服务器后，在项目根目录执行）：
#   sudo bash deploy/deploy.sh
#
# 说明：纯 IP 访问用 HTTP，跳过 HTTPS；如需域名 + HTTPS，改好下面的 SITE_URL /
#       SERVER_NAME 后部署，再手动执行 certbot --nginx -d 你的域名。
set -euo pipefail

# ============================== 配置 ==============================
SITE_URL="http://8.133.217.95"       # 前端注入的 API 基址（含协议）
SERVER_NAME="8.133.217.95"           # nginx server_name（域名或 IP）
WEB_ROOT="/var/www/zero-to-full"     # 前端静态文件目录
BACKEND_PORT="8001"                  # 后端监听端口（仅本机）
MODEL="BAAI/bge-small-zh-v1.5"       # RAG 本地向量模型

# ============================== 路径 ==============================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
RUN_USER="${SUDO_USER:-$USER}"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "请用 sudo 运行：sudo bash deploy/deploy.sh" >&2
    exit 1
  fi
}

install_deps() {
  log "安装系统依赖（nginx / git / curl）"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq nginx git curl ca-certificates

  if ! command -v node >/dev/null 2>&1; then
    log "安装 Node 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
  fi

  if ! command -v uv >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/uv" ]; then
    log "安装 uv"
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  export PATH="$HOME/.local/bin:$PATH"
}

setup_backend() {
  log "同步后端依赖（uv sync）"
  ( cd "$BACKEND_DIR" && uv sync )

  if [ ! -f "$BACKEND_DIR/.env" ]; then
    log "未找到 .env，已生成模板，请填写后重新运行"
    cat > "$BACKEND_DIR/.env" <<'EOF'
AMAP_KEY=
CHAT_BASE_URL=https://api.deepseek.com/v1
CHAT_API_KEY=
CHAT_MODEL=deepseek-chat
CHAT_SYSTEM_PROMPT=你是「零到全栈」站点的 AI 助手。
ANNOUNCE_KEY=
EOF
    chown "$RUN_USER" "$BACKEND_DIR/.env"
    echo "请填写 $BACKEND_DIR/.env 后重新运行本脚本。" >&2
    exit 1
  fi

  if [ ! -f "$BACKEND_DIR/history.db" ]; then
    echo "提示：未找到 history.db，将新建空库（用户与知识库为空）。"
    echo "      如需保留数据，请先上传 history.db 与 backend/avatars/。"
  fi
}

install_service() {
  log "安装 systemd 服务（运行用户：$RUN_USER）"
  sed -e "s|YOUR_USER|$RUN_USER|g" -e "s|/opt/zero-to-full|$PROJECT_DIR|g" \
    "$SCRIPT_DIR/zero-to-full.service" > /etc/systemd/system/zero-to-full.service
  systemctl daemon-reload
  systemctl enable zero-to-full >/dev/null
}

build_frontend() {
  log "构建前端（API 基址：$SITE_URL）"
  ( cd "$PROJECT_DIR" && npm ci --no-audit --no-fund )
  ( cd "$PROJECT_DIR" && NEXT_PUBLIC_API_BASE_URL="$SITE_URL" npm run build )

  log "发布静态文件到 $WEB_ROOT"
  mkdir -p "$WEB_ROOT"
  find "$WEB_ROOT" -mindepth 1 -delete
  cp -r "$PROJECT_DIR/out/." "$WEB_ROOT/"
}

setup_nginx() {
  log "配置 nginx"
  sed -e "s|YOUR_DOMAIN|$SERVER_NAME|g" -e "s|/var/www/zero-to-full|$WEB_ROOT|g" \
    "$SCRIPT_DIR/nginx.conf" > /etc/nginx/sites-available/zero-to-full
  ln -sf /etc/nginx/sites-available/zero-to-full /etc/nginx/sites-enabled/zero-to-full
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
}

fix_owner() {
  log "修正文件归属为 $RUN_USER"
  chown -R "$RUN_USER":"$RUN_USER" "$PROJECT_DIR"
}

warm_model() {
  log "预热向量模型（失败不影响启动）"
  sudo -u "$RUN_USER" bash -lc \
    "cd '$BACKEND_DIR' && .venv/bin/python -c \"from fastembed import TextEmbedding; TextEmbedding('$MODEL')\"" \
    || echo "模型预热失败，首次使用知识库时会自动重试下载。"
}

start_services() {
  log "启动后端与 nginx"
  systemctl restart zero-to-full
  systemctl reload nginx

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
  fi
}

summary() {
  log "部署完成"
  if systemctl is-active --quiet zero-to-full; then
    echo "后端：运行中（127.0.0.1:$BACKEND_PORT）"
  else
    echo "后端：未运行，请查看 systemctl status zero-to-full"
  fi
  echo "访问：$SITE_URL"
  echo "提醒：阿里云安全组需放行 80 端口。"
}

main() {
  require_root
  install_deps
  setup_backend
  install_service
  build_frontend
  setup_nginx
  fix_owner
  warm_model
  start_services
  summary
}

main "$@"
