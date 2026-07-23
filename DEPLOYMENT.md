# 🏨 酒店收益统计系统 (Hotel Gemini) 部署指南

本文档提供 **Hotel Gemini 酒店收支管理与收益统计系统** 的完整生产环境部署指南。包含极简 PM2 部署、Nginx 反向代理与 HTTPS SSL 配置、Docker 容器化部署以及数据库备份维护流程。

---

## 📋 1. 部署环境要求

| 组件/工具 | 建议版本 | 说明 |
| :--- | :--- | :--- |
| **操作系统** | Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / macOS | Linux 生产服务器首选 Ubuntu |
| **Node.js** | `>= 18.0.0` (推荐 18 LTS 或 20 LTS) | 运行 Node.js Express 后端与前端构建 |
| **包管理器** | `npm` >= 9.0 或 `yarn` >= 1.22 | 依赖安装与打包 |
| **进程管理器** | `PM2` (最新版) | 保证后端进程后台挂载与崩溃自动重启 |
| **Web 服务器** | `Nginx` >= 1.18 (可选，推荐) | 用于域名解析、HTTPS 加密与反向代理 |
| **数据库** | `SQLite3` (内置驱动) | 轻量免运维数据库，自动生成 `hotel.db` |

---

## ⚙️ 2. 环境变量配置 (.env)

项目根目录支持通过环境变量覆盖默认运行参数。在项目根目录下新建 `.env` 文件（或在 PM2 配置文件中设定）：

```env
# 运行端口
PORT=8088

# JWT 鉴权密钥 (生产环境务必替换为高强度随机字符串)
JWT_SECRET=your_super_secret_jwt_key_2026_x89a

# 初始老板账号配置
BOSS_USERNAME=boss
BOSS_PASSWORD=YourStrongPassword123!
BOSS_NAME=酒店老板
```

---

## 🚀 3. 部署方案选择

### 方案一：PM2 + Node.js 一体化部署 (推荐快速上线)

系统内置了静态资源托管逻辑，当构建出 `dist/` 目录后，后端 Express 会自动托管前端页面并响应路由。

#### 步骤 1：克隆项目并安装依赖

```bash
# 克隆仓库或上传项目文件至服务器
git clone <repository_url> /var/www/hotel_gemini
cd /var/www/hotel_gemini

# 安装生产依赖
npm install --production=false
```

#### 步骤 2：编译前端资源

```bash
npm run build
```
> 执行成功后根目录下会生成 `dist/` 文件夹。

#### 步骤 3：全局安装 PM2 并启动服务

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动服务
PORT=8088 JWT_SECRET="your_custom_jwt_secret" pm2 start server.js --name "hotel-gemini"

# 查看运行状态
pm2 status
pm2 logs hotel-gemini
```

#### 步骤 4：设置开机自启

```bash
pm2 startup
pm2 save
```

---

### 方案二：Nginx + PM2 + SSL 生产环境部署 (标准推荐)

在方案一的基础上，使用 Nginx 作为入口反向代理，可绑定独立域名并配置免费的 Let's Encrypt SSL 证书。

#### Nginx 配置文件示例 (`/etc/nginx/conf.d/hotel.conf`)

```nginx
server {
    listen 80;
    server_name hotel.yourdomain.com;

    # 强制 HTTP 重定向至 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hotel.yourdomain.com;

    # SSL 证书路径
    ssl_certificate /etc/letsencrypt/live/hotel.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hotel.yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 请求体限制（支持上传/提交大请求）
    client_max_body_size 20M;

    # 后端 API 与静态前端统一反向代理至 Node.js 端口
    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

重新加载 Nginx 配置：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### 方案三：Docker Compose 容器化部署

利用 Docker 实现零依赖一键打包运行。

#### 1. 项目根目录下 `Dockerfile`

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# 提高 Node.js V8 堆内存上限，避免 Vite 构建打包时内存溢出 (OOM)
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8088
ENV DB_PATH=/app/data/hotel.db

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

RUN mkdir -p /app/data

EXPOSE 8088

CMD ["node", "server.js"]
```

#### 2. `docker-compose.yml`

```yaml
version: '3.8'

services:
  hotel-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: hotel-gemini
    restart: always
    ports:
      - "8088:8088"
    environment:
      - PORT=8088
      - DB_PATH=/app/data/hotel.db
      - JWT_SECRET=hotel_gemini_production_jwt_key_2026
      - BOSS_USERNAME=boss
      - BOSS_PASSWORD=boss12345
      - BOSS_NAME=酒店老板
    volumes:
      # 挂载宿主机 ./data 目录，保证 SQLite 数据库文件安全持久化
      - ./data:/app/data
```

#### 3. 在 Jack 服务器上一键启动部署

```bash
# 进入项目目录
cd /var/www/hotel_gemini # 或实际代码解压路径

# 一建构建并启动容器
docker compose up -d --build

# 查看运行日志与健康状态
docker compose ps
docker compose logs -f hotel-app
```

---

## 💾 4. 数据库备份与定时维护

系统使用轻量 SQLite3 数据库（文件路径 `/var/www/hotel_gemini/hotel.db`）。为防止意外数据丢失，建议配置每日定时自动备份脚本。

### 自动化备份 Crontab 脚本

创建备份脚本 `/var/www/hotel_gemini/backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/var/www/hotel_gemini/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/var/www/hotel_gemini/hotel.db"

mkdir -p $BACKUP_DIR

if [ -f "$DB_PATH" ]; then
    cp $DB_PATH $BACKUP_DIR/hotel_backup_$DATE.db
    # 仅保留最近 30 天的备份
    find $BACKUP_DIR -name "hotel_backup_*.db" -mtime +30 -delete
    echo "[$(date)] 数据库备份成功: hotel_backup_$DATE.db" >> $BACKUP_DIR/backup.log
fi
```

赋予执行权限并加入 Cron 计划任务：

```bash
chmod +x /var/www/hotel_gemini/backup.sh

# 编辑 crontab
crontab -e

# 添加每日凌晨 3 点自动备份
0 3 * * * /var/www/hotel_gemini/backup.sh
```

---

## 🔄 5. 系统更新与版本升级

当代码有更新时，按以下步骤部署最新版本：

```bash
cd /var/www/hotel_gemini

# 1. 拉取最新代码
git pull origin main

# 2. 更新依赖
npm install

# 3. 重新打包前端
npm run build

# 4. 重启 PM2 服务
pm2 restart hotel-gemini
```

---

## ❓ 6. 常见问题与排查 (Troubleshooting)

### Q1: 启动时提示 `EADDRINUSE: address already in use :::8088`？
- 端口被占用。找到并结束旧进程：
  ```bash
  lsof -i :8088
  kill -9 <PID>
  ```

### Q2: 忘记老板初始登录密码？
- 可通过环境变量覆盖重置，或直接删除 `hotel.db` 重新初始化（注意：删除数据库前请先备份）。

### Q3: 生产环境下前端刷新页面出现 404？
- 已在 `server.js` 中内置单页应用 (SPA) 通配路由支持：`app.get('*', ...)`，确保 `dist/` 目录存在且已被 `npm run build` 生成。如使用外部 Nginx 单独托管前端静态文件，请在 Nginx 的 `location /` 中配置 `try_files $uri $uri/ /index.html;`。

---

*文档更新时间：2026-07-23*
