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
