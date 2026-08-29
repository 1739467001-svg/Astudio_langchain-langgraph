FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci

# 复制源码
COPY . .

# 构建静态站点
RUN npx vitepress build .

# === 运行阶段：轻量 Nginx ===
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# 自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
