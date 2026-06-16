# ============================================================
# mall-pc-web — PC 商城前端（纯静态 Vue3 + Element Plus CDN）
# 单阶段：nginx 托管静态 + /api 反代 mall-portal:8085 + /health
# ============================================================
FROM nginx:1.24-alpine

COPY index.html app.js style.css /usr/share/nginx/html/

RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /api/ {\n\
        proxy_pass http://mall-portal.mall.svc.cluster.local:8085/;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_read_timeout 60s;\n\
    }\n\
    location /img/ {\n\
        proxy_pass http://macro-oss.oss-cn-shenzhen.aliyuncs.com/;\n\
        proxy_set_header Host macro-oss.oss-cn-shenzhen.aliyuncs.com;\n\
        proxy_set_header Referer "";\n\
        proxy_hide_header Set-Cookie;\n\
        expires 7d;\n\
    }\n\
    location /health { return 200 "ok"; }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
