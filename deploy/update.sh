#!/usr/bin/env bash
# 更新发布：git pull → 按改动范围重建后端/前端 → 重启服务
#
# 用法（服务器项目根目录）：
#   sudo bash deploy/update.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "请用 sudo 运行：sudo bash deploy/update.sh" >&2
    exit 1
  fi
}

run_as_user() {
  sudo -u "$RUN_USER" bash -lc "export PATH=\"\$HOME/.local/bin:\$PATH\"; $1"
}

git_head() {
  sudo -u "$RUN_USER" git -C "$PROJECT_DIR" rev-parse HEAD
}

pull_code() {
  log "拉取最新代码"
  sudo -u "$RUN_USER" git config --global --get-all safe.directory 2>/dev/null \
    | grep -qxF "$PROJECT_DIR" \
    || sudo -u "$RUN_USER" git config --global --add safe.directory "$PROJECT_DIR"
  sudo -u "$RUN_USER" git -C "$PROJECT_DIR" pull --ff-only
}

update_backend() {
  grep -q '^backend/' <<< "$1" || return 0
  log "后端有改动：uv sync"
  run_as_user "cd '$BACKEND_DIR' && uv sync"
  BACKEND_CHANGED=1
}

update_frontend() {
  grep -qE '^(app/|components/|css/|data/|docs/|public/|scripts/|package\.json|package-lock\.json|next\.config)' <<< "$1" \
    || return 0
  log "前端有改动：构建并发布"
  run_as_user "cd '$PROJECT_DIR' && npm ci --no-audit --no-fund"
  run_as_user "cd '$PROJECT_DIR' && NEXT_PUBLIC_API_BASE_URL='$SITE_URL' npm run build"
  mkdir -p "$WEB_ROOT"
  find "$WEB_ROOT" -mindepth 1 -delete
  cp -r "$PROJECT_DIR/out/." "$WEB_ROOT/"
  FRONTEND_CHANGED=1
}

restart_services() {
  if [ "${BACKEND_CHANGED:-0}" = "1" ]; then
    log "重启后端"
    systemctl restart zero-to-full
  fi
  if [ "${FRONTEND_CHANGED:-0}" = "1" ]; then
    log "重载 nginx"
    systemctl reload nginx
  fi
}

summary() {
  log "更新完成"
  if systemctl is-active --quiet zero-to-full; then
    echo "后端：运行中"
  else
    echo "后端：未运行，请查看 systemctl status zero-to-full"
  fi
}

main() {
  require_root

  local before after changed
  before="$(git_head)"
  pull_code
  after="$(git_head)"

  if [ "$before" = "$after" ]; then
    log "代码无变化，无需更新"
    return 0
  fi

  changed="$(sudo -u "$RUN_USER" git -C "$PROJECT_DIR" diff --name-only "$before" "$after")"
  echo "$changed" | sed 's/^/  /'

  BACKEND_CHANGED=0
  FRONTEND_CHANGED=0
  update_backend "$changed"
  update_frontend "$changed"
  restart_services
  summary
}

main "$@"
