#!/bin/bash
# ============================================
# LangChain & LangGraph 学习平台 - 一键部署脚本
# 适用于阿里云 / 腾讯云 / 华为云等 Linux 服务器
# ============================================
set -e

# 配置
REPO_URL="https://github.com/1739467001-svg/Astudio_langchain-langgraph.git"
BRANCH="main"
DEPLOY_DIR="/opt/langchain-learning"
PORT=8080

echo "=========================================="
echo "🚀 LangChain & LangGraph 学习平台部署"
echo "=========================================="
echo ""

# === 1. 检查 Docker ===
echo "📦 [1/5] 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "  安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "  ✅ Docker 安装完成"
else
    echo "  ✅ Docker 已安装: $(docker --version)"
fi

# === 2. 检查 Docker Compose ===
echo "📦 [2/5] 检查 Docker Compose..."
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "  安装 Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    COMPOSE_CMD="docker-compose"
    echo "  ✅ Docker Compose 安装完成"
fi
echo "  ✅ Docker Compose: $COMPOSE_CMD"

# === 3. 克隆/更新代码 ===
echo "📦 [3/5] 获取代码..."
if [ -d "$DEPLOY_DIR/docs-site" ]; then
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    echo "  ✅ 代码已更新"
else
    git clone -b $BRANCH "$REPO_URL" "$DEPLOY_DIR"
    echo "  ✅ 代码已克隆"
fi

cd "$DEPLOY_DIR/docs-site"

# === 4. 构建并启动 ===
echo "📦 [4/5] 构建 Docker 镜像（首次约 5-10 分钟）..."
export NODE_OPTIONS="--max-old-space-size=4096"
$COMPOSE_CMD up -d --build 2>&1 | tail -5
echo "  ✅ 构建完成"

# === 5. 验证 ===
echo "📦 [5/5] 验证服务..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200\|301\|302"; then
    echo "  ✅ 服务正常运行"
else
    echo "  ⚠️ 服务可能还在启动中，请稍等"
    $COMPOSE_CMD logs --tail 20
fi

# 获取服务器 IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "🌐 访问地址: http://$SERVER_IP:$PORT"
echo ""
echo "📋 常用命令:"
echo "  查看日志:   cd $DEPLOY_DIR/docs-site && $COMPOSE_CMD logs -f"
echo "  重启服务:   cd $DEPLOY_DIR/docs-site && $COMPOSE_CMD restart"
echo "  停止服务:   cd $DEPLOY_DIR/docs-site && $COMPOSE_CMD down"
echo "  更新部署:   cd $DEPLOY_DIR/docs-site && git pull && $COMPOSE_CMD up -d --build"
echo ""
echo "⚠️  请确保阿里云安全组已开放 $PORT 端口"
echo "=========================================="
