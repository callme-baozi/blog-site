# 部署指南（单台云服务器）

## 服务器要求

- **配置**：1 核 2G 起步（视频多建议 2 核 4G + 独立数据盘）
- **系统**：Ubuntu 22.04 / 24.04 LTS
- **已装**：Node.js 20 LTS、Nginx、pm2
- **网络**：海外服务器（如 Vultr / DigitalOcean / Hetzner / Linode）

## 1. 环境准备

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pm2 进程守护
sudo npm install -g pm2

# Nginx
sudo apt-get install -y nginx

# 安装构建工具（better-sqlite3 原生模块编译需要）
sudo apt-get install -y python3 make g++
```

## 2. 部署项目

```bash
# 拉取代码
cd /var/www
git clone <your-repo> blog_site
cd blog_site

# 安装依赖
npm ci

# 配置环境变量
cp .env.example .env
nano .env
# 必填：AUTHOR_PASSWORD（设强密码）、NEXT_PUBLIC_SITE_NAME、NEXT_PUBLIC_AUTHOR_NAME

# 构建
npm run build
```

## 3. pm2 启动

```bash
# 启动（Next.js 默认 3000 端口）
pm2 start npm --name "blog" -- start

# 开机自启
pm2 save
pm2 startup
```

常用命令：
- `pm2 logs blog` — 查看日志
- `pm2 restart blog` — 重启
- `pm2 stop blog` — 停止

## 4. Nginx 配置

创建 `/etc/nginx/sites-available/blog`：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 上传文件大小限制（与应用一致，200MB）
    client_max_body_size 200M;

    # 静态资源：Nginx 直接 serve uploads 目录，不经过 Node
    location /uploads/ {
        alias /var/www/blog_site/uploads/;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Next.js 静态资源
    location /_next/static/ {
        alias /var/www/blog_site/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 反代到 Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
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

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. HTTPS（Let's Encrypt）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
# 自动续期已由 certbot timer 处理
```

## 6. 数据持久化与备份

SQLite 数据库和 uploads 目录默认在项目下：

- 数据库：`data/blog.db`
- 上传文件：`uploads/`

建议挂载独立数据盘并通过环境变量指定路径：

```env
DATA_DIR=/mnt/data/blog
UPLOAD_DIR=/mnt/data/blog/uploads
```

### 自动备份脚本

创建 `/var/www/blog_site/scripts/backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR=/var/backups/blog
DATE=$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

# 备份 SQLite（使用 .backup 命令保证一致性）
sqlite3 /mnt/data/blog/blog.db ".backup $BACKUP_DIR/db-$DATE.db"
gzip $BACKUP_DIR/db-$DATE.db

# 打包 uploads（增量可用 rclone）
tar -czf $BACKUP_DIR/uploads-$DATE.tar.gz -C /mnt/data/blog uploads

# 保留最近 7 天
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
```

添加 crontab（每天凌晨 3 点）：

```bash
crontab -e
# 0 3 * * * /var/www/blog_site/scripts/backup.sh
```

后续可将备份同步到 S3/R2（用 rclone）。

## 7. 更新部署

```bash
cd /var/www/blog_site
git pull
npm ci
npm run build
pm2 restart blog
```

## 8. 安全建议

- `AUTHOR_PASSWORD` 使用强密码（16 位以上随机字符串）
- 服务器开启防火墙（ufw），只开放 22/80/443
- SSH 禁用密码登录，使用密钥
- 定期 `apt update && apt upgrade`
- `/admin` 路径不公开传播；如需额外保护，可在 Nginx 层加 IP 白名单或 Basic Auth
