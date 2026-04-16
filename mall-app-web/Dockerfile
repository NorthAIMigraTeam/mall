# 阶段1: 构建
FROM node:16-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --registry=https://registry.npmmirror.com
COPY . .
RUN npm run build

# 阶段2: 运行
FROM nginx:1.24-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# 默认 nginx 配置（可被 ConfigMap 覆盖）
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
