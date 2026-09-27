# 🏨 云宿管家 (CloudInn) 部署与运维手册

本文档为 **云宿管家 (CloudInn) 酒店收支管理与收益统计系统** 提供完整的生产环境部署、高可用运行、数据库冷热备份及故障排查指南。

---

## 📋 目录

1. [服务器环境要求](#1-服务器环境要求)
2. [环境变量配置 (.env)](#2-环境变量配置-env)
3. [部署方案一：PM2 + Node.js (推荐极简上线)](#3-部署方案一pm2--nodejs-推荐极简上线)
4. [部署方案二：Docker & Docker Compose (容器化一键部署)](#4-部署方案二docker--docker-compose-容器化一键部署)
5. [部署方案三：Nginx 反向代理与 HTTPS SSL 配置](#5-部署方案三nginx-反向代理与-https-ssl-配置)
6. [部署方案四：Linux Systemd 系统服务](#6-部署方案四linux-systemd-系统服务)
7. [部署方案五：Render 云平台部署与数据持久化指南](#7-部署方案五render-云平台部署与数据持久化指南)
8. [SQLite 数据库维护与备份恢复策略](#8-sqlite-数据库维护与备份恢复策略)
9. [生产环境安全检查清单](#9-生产环境安全检查清单)
10. [常见问题排查 (Troubleshooting FAQ)](#10-常见问题排查-troubleshooting-faq)

---

## 1. 服务器环境要求

| 组件 / 环境 | 最低要求 | 推荐配置 | 说明 |
| :--- | :--- | :--- | :--- |
| **操作系统** | Ubuntu 20.04+ / Debian 11+ / CentOS 8+ | Ubuntu 22.04 LTS | 绝大多数主流 Linux 发行版均原生支持 |
| **CPU / 内存** | 1 核 CPU / 1GB RAM | 2 核 CPU / 2GB RAM | 轻量化架构，资源占用极低（内存通常稳定在 80MB 以内） |
| **Node.js** | `>= 18.0.0` | Node.js `20.x LTS` | 用于后端 API 运行与前端静态资源编译 |
| **包管理器** | `npm >= 9.0` | `npm >= 10.0` | 依赖管理与构建打包 |
| **进程管理** | 无 | `PM2` 或 `Docker` | 保证系统守护运行与宕机自愈 |
| **数据库** | 内置 SQLite3 (已内嵌) | SQLite3 (开启 WAL) | 单文件存储，自动初始化与索引加速，免装 MySQL/PostgreSQL |

---

## 2. 环境变量配置 (.env)

在部署服务器的项目根目录创建 `.env` 文件（或参考 [`.env.example`](.env.example)）：

```env
# 生产服务监听端口 (默认: 8088)
PORT=8088

# JWT 鉴权密钥 (高安全生产环境请生成 32 位随机字符)
# 推荐使用: openssl rand -hex 32 生成
JWT_SECRET=a8f7c9e12089b4f8d23190b62145e3d7a8c4f2105e6b98d3c1a2f4e5b6c7d8e9

# 老板管理员账号配置 (服务首次启动或更新后将以此配置同步)
BOSS_USERNAME=boss
BOSS_PASSWORD=YourStrongBossPassword2026!
BOSS_NAME=酒店老板

# 数据库存储路径 (默认根目录 hotel.db；若采用 Docker 部署请设置为 /app/data/hotel.db)
DB_PATH=./hotel.db
```

---

## 3. 部署方案一：PM2 + Node.js (推荐极简上线)

系统内置了生产静态资源托管逻辑。只需编译前端生成 `dist/` 目录，后端 Express 会自动托管全站。

### 步骤 1：上传项目并安装依赖

```bash
# 1. 克隆代码至生产目录
git clone <repository_url> /var/www/cloud-inn
cd /var/www/cloud-inn

# 2. 安装全部依赖 (包含编译所需工具)
npm install

# 3. 配置生产环境变量
cp .env.example .env
nano .env  # 按需修改 PORT, JWT_SECRET, BOSS_PASSWORD
```

### 步骤 2：编译前端生产产物

```bash
npm run build
```
> 执行完成后，根目录下会生成压缩优化后的 `dist/` 静态资源目录。

### 步骤 3：全局安装 PM2 并托管启动

```bash
# 全局安装 PM2
npm install -g pm2

# 启动服务并命名为 cloud-inn
pm2 start server.js --name "cloud-inn"

# 查看运行状态与日志
pm2 status
pm2 logs cloud-inn --lines 50
```

### 步骤 4：配置系统开机自启

```bash
pm2 startup
pm2 save
```

---

## 4. 部署方案二：Docker & Docker Compose (容器化一键部署)

项目已内置针对多架构优化的高性能多阶段 `Dockerfile` 与 `docker-compose.yml`。

### 步骤 1：准备宿主机目录与配置

```bash
cd /var/www/cloud-inn

# 创建数据库持久化宿主机映射目录
mkdir -p ./data
chmod 777 ./data

# 确认 .env 文件已配置
cp .env.example .env
```

### 步骤 2：启动容器集群

```bash
# 后台构建并启动容器
docker compose up -d --build

# 检查容器状态与健康检查结果
docker compose ps

# 查看实时运行日志
docker compose logs -f hotel-app
```

> [!NOTE]
> `docker-compose.yml` 已配置健康检查探测 `/api/health`，当容器就绪后状态会显示为 `healthy`。数据库文件安全持久化挂载于宿主机 `./data/hotel.db`。

---

## 5. 部署方案三：Nginx 反向代理与 HTTPS SSL 配置

若需要在公网绑定独立域名并启用 HTTPS 加密（强制 HTTP 跳转 HTTPS），推荐使用 Nginx 作为前置网关。

### Nginx 虚拟主机配置文件 (`/etc/nginx/sites-available/hotel.conf`)

```nginx
# 1. HTTP 80 端口自动重定向至 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name hotel.yourdomain.com;

    return 301 https://$host$request_uri;
}

# 2. HTTPS 443 生产配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hotel.yourdomain.com;

    # SSL 证书路径 (推荐 Let's Encrypt Certbot 证书)
    ssl_certificate /etc/letsencrypt/live/hotel.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hotel.yourdomain.com/privkey.pem;

    # 现代 SSL 加密协议与安全套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # 安全响应头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip 压缩支持
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # 客户端上传与请求体限制
    client_max_body_size 10M;

    # 反向代理至后端 Express 端口 (假设 PORT=8088)
    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源强缓存优化
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:8088;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

启用并重载 Nginx：
```bash
sudo ln -s /etc/nginx/sites-available/hotel.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. 部署方案四：Linux Systemd 系统服务

如果服务器未安装 PM2 或 Docker，可直接使用 Linux 自带的 `systemd` 守护进程管理。

创建服务定义文件 `/etc/systemd/system/cloud-inn.service`：

```ini
[Unit]
Description=CloudInn Management Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/cloud-inn
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=cloud-inn

[Install]
WantedBy=multi-user.target
```

启动并设置开机自启：
```bash
sudo systemctl daemon-reload
sudo systemctl enable cloud-inn
sudo systemctl start cloud-inn
sudo systemctl status cloud-inn
```

---

## 7. 部署方案五：Render 云平台部署与数据持久化指南

Render 是一站式现代云托管平台，支持通过 GitHub 仓库自动持续集成部署。

### 为什么在 Render 部署时容易“丢失现有数据库”？
1. **多阶段 Docker 构建未打包数据库**：若 Render 采用 Docker 环境部署，之前的 `Dockerfile` runner 镜像只拷贝了代码，未拷贝历史数据库文件，导致容器启动后自动新建了空数据库。
2. **Render 免费层（Free Tier）为临时文件系统（Ephemeral Disk）**：
   - Render 免费 Web Service 每次**代码重新部署（Deploy）**或**实例闲置 15 分钟休眠重启（Spin Down / Wake Up）**时，磁盘都会重置为初始构建状态。
   - 生产环境中员工新提交的收入/支出流水，若保存在临时磁盘上，重启后将丢失！

### 核心机制改进：自动种子初始化 (Auto-Seed)
系统现已内置智能初始化逻辑：
- 预置种子数据库打包在 `/app/seed/hotel.db` 和 `/app/data/hotel.db` 中。
- 当服务启动时，检测到目标 `DB_PATH` 不存在（例如首次挂载了全新的 Render Persistent Disk），会自动从种子数据库复制现有数据（含所有历史流水与用户），无需手动导入！

### 生产推荐配置步骤 (Render Persistent Disk)

若要在 Render 上长期稳定运行并持久化保存数据：

1. **新建 Web Service**：
   - 在 [Render Dashboard](https://dashboard.render.com) 点击 **New +** -> **Web Service**。
   - 关联你的 GitHub / GitLab 仓库。
   - **Environment** 选择 **Docker**（Render 会自动读取根目录下的 `Dockerfile`）。
   - **Plan** 建议选择 **Starter**（$7/月，仅付费计划支持添加持久化磁盘）。

2. **配置环境变量 (Environment Variables)**：
   | Key | Value 示例 | 说明 |
   | :--- | :--- | :--- |
   | `PORT` | `8088` | 服务端口 |
   | `DB_PATH` | `/app/data/hotel.db` | 持久化数据库路径 |
   | `JWT_SECRET` | `生成32位随机密钥` | 鉴权加密密钥 |
   | `BOSS_USERNAME` | `boss` | 管理员用户名 |
   | `BOSS_PASSWORD` | `你的强密码` | 管理员密码 |
   | `BOSS_NAME` | `酒店老板` | 显示姓名 |

3. **添加持久化磁盘 (Persistent Disk)**：
   - 在 Web Service 设置页面下滑至 **Disks** -> 点击 **Add Disk**。
   - **Name**: `hotel-data`
   - **Mount Path**: `/app/data`
   - **Size**: `1 GB` (仅需 $0.25/月)
   - 点击保存后重新部署。系统在启动时会自动将预置历史数据库同步进此持久磁盘，之后所有数据操作永久保存！

4. **若仅使用免费层 (Free Plan)**：
   - 仍可通过 Docker 免费部署，系统镜像已内嵌现有数据库（500+条流水），部署即可查看。
   - **提示**：免费层新增的数据在服务休眠重启时会回滚。建议老板管理员定期点击员工管理界面的 **💾 备份数据库** 按钮，一键下载当前的 `hotel_backup_*.db` 快照。

---

## 8. SQLite 数据库维护与备份恢复策略

### 1. WAL 模式的并发特性
本项目底层已默认开启 SQLite 的 `WAL (Write-Ahead Logging)` 模式：
- **读写不互斥**：读操作不会阻塞写操作，写操作也不会阻塞读操作。
- **并发能力**：极大提升多员工前台同时录入房费流水时的响应性能。
- **关联文件**：在数据库运行期间，同目录下会出现 `hotel.db-wal` 与 `hotel.db-shm` 文件，属正常现象，请勿手动删除。

### 2. 在线无锁热备份 (Hot Backup)
由于启用了 WAL 模式，**切勿直接使用 `cp` 拷贝正在运行中的 `hotel.db`**（可能导致读到未完全刷盘的脏页）。请使用 SQLite 官方的 `.backup` 命令：

```bash
# 在线安全无损热备份
sqlite3 hotel.db ".backup 'hotel_backup_$(date +%Y%m%d_%H%M%S).db'"
```

### 3. 定时自动备份脚本 (`backup.sh`)

创建脚本 `/var/www/cloud-inn/backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/cloud-inn"
DB_PATH="/var/www/cloud-inn/hotel.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 执行在线热备
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/hotel_$DATE.db'"

# 仅保留最近 30 天的历史备份
find "$BACKUP_DIR" -type f -name "hotel_*.db" -mtime +30 -exec rm {} \;

echo "[$(date)] Backup completed: hotel_$DATE.db" >> "$BACKUP_DIR/backup.log"
```

赋予执行权限并加入 crontab（每日凌晨 3:00 自动备份）：
```bash
chmod +x /var/www/cloud-inn/backup.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /var/www/cloud-inn/backup.sh") | crontab -
```

### 4. 数据库恢复与完整性检查

如需从备份文件恢复：
```bash
# 1. 停止服务
pm2 stop cloud-inn

# 2. 备份现有受损文件并替换
cp hotel.db hotel.db.corrupt
cp /var/backups/cloud-inn/hotel_2026xxxx.db hotel.db

# 3. 检查数据库完整性
sqlite3 hotel.db "PRAGMA integrity_check;"
# 输出: ok 即表示数据库健康完好

# 4. 重启服务
pm2 start cloud-inn
```

---

## 9. 生产环境安全检查清单

- [ ] **高强度密钥**：已替换 `.env` 中的 `JWT_SECRET` 为高熵随机字符串，禁止使用开发默认值。
- [ ] **修改初始密码**：已在 `.env` 中修改默认的老板密码 `BOSS_PASSWORD`。
- [ ] **权限保护**：确保 `.env` 文件权限为 `600`（仅允许宿主服务运行账户读取）：
  ```bash
  chmod 600 /var/www/cloud-inn/.env
  ```
- [ ] **防火墙规则**：仅对外暴露 `80` 和 `443` 端口，内部 `8088` 端口仅绑定本地 `127.0.0.1` 或通过反向代理访问。
- [ ] **HTTPS 强制加密**：线上生产域名必须部署 SSL 证书，防止员工账号密码与经营收益数据明文传输。

---

## 10. 常见问题排查 (Troubleshooting FAQ)

### Q1: 启动服务时提示 `EADDRINUSE: address already in use 0.0.0.0:8088`
- **原因**：8088 端口已被其他进程占用。
- **排查与解决**：
  ```bash
  # 查看占用端口的进程 ID (PID)
  lsof -i :8088
  # 终止冲突进程或在 .env 中更换其他空闲端口 (如 PORT=8089)
  kill -9 <PID>
  ```

### Q2: 访问页面出现空白，刷新页面报 404
- **原因**：前端静态文件未编译，或 Nginx / 后端未正确配置单页应用（SPA）的历史路由回退。
- **排查与解决**：
  1. 确认在服务器根目录下执行过 `npm run build`，且生成了 `dist/index.html`。
  2. 若使用 Nginx 独立托管前端，确认包含 `try_files $uri $uri/ /index.html;` 指令。

### Q3: 运行 `npm run build` 提示内存溢出 (OOM)
- **原因**：部分 1GB 内存的低配云服务器在构建复杂前端依赖时突发内存不足。
- **解决办法**：
  运行构建命令时临时扩充 Node V8 堆内存：
  ```bash
  NODE_OPTIONS="--max-old-space-size=2048" npm run build
  ```
  或者为服务器添加 2GB 的 Swap 交换分区。

### Q4: 如何在忘记老板密码时重置密码？
- **解决办法**：
  直接在服务器项目根目录的 `.env` 文件中修改 `BOSS_PASSWORD=新密码`，然后重启后端服务（如 `pm2 restart cloud-inn`），系统在初始化时会自动通过 bcrypt 加密并同步数据库中的密码。

### Q5: 在 Render 等 PaaS 平台部署后，为什么重新部署或休眠后数据没了？
- **原因**：Render 免费层（Free Tier）为临时文件系统（Ephemeral Storage），每次休眠重启或代码发布都会还原为镜像初始状态。
- **解决办法**：
  1. 在 Render 控制台将 Plan 切换为 Starter（$7/月）并添加 Persistent Disk（挂载到 `/app/data`，每月 $0.25）。
  2. 若使用免费层，老板管理员可在【员工管理】页面随时点击【💾 备份数据库】一键将当前的 `hotel_backup_*.db` 下载保存到本地电脑。

