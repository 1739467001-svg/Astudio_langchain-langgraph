# 部署指南

> 三种部署方式，从简单到完整，按你的需求选择。

---

## 方式一：Docker 一键部署（推荐）

### 前置条件

- 阿里云服务器（1核2G 即可，推荐 2核4G）
- 已安装 Docker 和 Docker Compose

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/1739467001-svg/Astudio_langchain-langgraph.git
cd Astudio_langchain-langgraph/docs-site

# 2. 构建并启动
docker-compose up -d --build

# 3. 检查状态
docker-compose ps
docker-compose logs -f

# 4. 访问
# 浏览器打开 http://你的服务器IP:8080
```

### 更新

```bash
# 拉取最新代码并重新构建
git pull origin main
docker-compose up -d --build
```

### 停止

```bash
docker-compose down
```

---

## 方式二：手动部署（不用 Docker）

### 前置条件

- Node.js 22+
- Nginx（或 Caddy）

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/1739467001-svg/Astudio_langchain-langgraph.git
cd Astudio_langchain-langgraph/docs-site

# 2. 安装依赖
npm install

# 3. 构建静态文件
npx vitepress build .

# 4. 构建产物在 .vitepress/dist/ 目录
# 复制到 Nginx 目录
sudo cp -r .vitepress/dist/* /usr/share/nginx/html/

# 5. 配置 Nginx
sudo cp nginx.conf /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo nginx -s reload
```

### 更新

```bash
git pull origin main
npm install
npx vitepress build .
sudo cp -r .vitepress/dist/* /usr/share/nginx/html/
sudo nginx -s reload
```

---

## 方式三：自动化部署脚本

### 创建部署脚本

在服务器上创建 `deploy.sh`：

```bash
#!/bin/bash
set -e

REPO_URL="https://github.com/1739467001-svg/Astudio_langchain-langgraph.git"
DEPLOY_DIR="/opt/langchain-learning"
BRANCH="main"

echo "🚀 开始部署..."

# 克隆或更新
if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    echo "📦 更新代码完成"
else
    git clone -b $BRANCH $REPO_URL "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
    echo "📦 克隆代码完成"
fi

cd docs-site

# 构建并重启
docker-compose up -d --build

# 清理旧镜像
docker image prune -f

echo "✅ 部署完成！"
echo "🌐 访问: http://$(curl -s ifconfig.me):8080"
```

### 使用

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Nginx 反向代理配置（带域名+HTTPS）

如果要用域名 + HTTPS：

```nginx
# /etc/nginx/conf.d/learning.conf

server {
    listen 80;
    server_name learning.yourdomain.com;
    
    # HTTPS 重定向
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name learning.yourdomain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/learning.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/learning.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 申请 SSL 证书

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d learning.yourdomain.com
```

---

## 阿里云安全组配置

在阿里云控制台 → 安全组 → 添加规则：

| 协议 | 端口 | 说明 |
|------|------|------|
| TCP | 8080 | Docker 映射端口 |
| TCP | 80 | HTTP |
| TCP | 443 | HTTPS |
| TCP | 22 | SSH |

---

## 服务器配置建议

| 配置 | 最低 | 推荐 | 说明 |
|------|------|------|------|
| CPU | 1核 | 2核 | 构建时需要 |
| 内存 | 2G | 4G | 构建时 Node 内存消耗大 |
| 磁盘 | 5G | 10G | 代码+构建产物 |
| 带宽 | 1M | 5M | 静态资源较多 |

---

## 常见问题

### 构建时内存不足

```bash
# 增加 Node 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npx vitepress build .
```

### Docker 构建慢

```bash
# 使用 BuildKit 加速
DOCKER_BUILDKIT=1 docker-compose up -d --build
```

### 页面打不开

```bash
# 检查容器状态
docker-compose ps

# 检查端口
netstat -tlnp | grep 8080

# 检查防火墙
sudo ufw status
sudo ufw allow 8080
```
