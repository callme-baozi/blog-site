# Blog Site

一个极简的个人博客：单作者发帖（文字 / 图片 / 视频），访客浏览，无登录、无评论、无分享。界面参考 Threads 帖子流，移动优先。

## 技术栈

- **Next.js 16**（App Router + Route Handlers）
- **React 19 + TypeScript**
- **Tailwind CSS v4**
- **TipTap v3**（富文本编辑器）
- **better-sqlite3**（单文件数据库，零运维）
- 本地文件存储（抽象层，后续可切 S3/R2）

## 功能

- 帖子时间线（无限滚动，移动端 Threads 风格）
- 富文本发帖：加粗、斜体、下划线、删除线、标题、列表、引用、链接、文字颜色
- 图片上传与插入
- 视频上传（自动截取第一帧作封面，点击才加载播放，省流量）
- 单作者密码认证（httpOnly cookie）
- 单条帖子页 `/p/[id]`
- 响应式：移动优先，PC 居中兼容

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 AUTHOR_PASSWORD

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 浏览帖子，http://localhost:3000/admin 发帖。

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `AUTHOR_PASSWORD` | 是 | 作者登录密码 |
| `AUTH_SECRET` | 否 | cookie 签名密钥，默认用密码 |
| `DATA_DIR` | 否 | SQLite 存储目录，默认 `./data` |
| `UPLOAD_DIR` | 否 | 上传文件目录，默认 `./uploads` |
| `NEXT_PUBLIC_SITE_NAME` | 否 | 站点名称 |
| `NEXT_PUBLIC_AUTHOR_NAME` | 否 | 作者显示名 |

## 项目结构

```
src/
├─ app/
│  ├─ page.tsx              # 帖子时间线
│  ├─ p/[id]/page.tsx       # 单条帖子
│  ├─ admin/page.tsx        # 作者发帖页
│  ├─ api/
│  │  ├─ login/route.ts     # 登录
│  │  ├─ auth/route.ts      # 登录状态/登出
│  │  ├─ posts/route.ts     # 帖子列表/发布
│  │  └─ upload/route.ts    # 图片/视频上传
│  └─ uploads/[...path]/    # 开发环境媒体文件服务
├─ components/
│  ├─ PostCard.tsx          # 帖子卡片
│  ├─ PostList.tsx          # 无限滚动列表
│  ├─ RichText.tsx          # HTML 渲染（视频替换）
│  ├─ VideoPlayer.tsx       # 点击加载视频
│  └─ admin/                # 编辑器相关
└─ lib/
   ├─ db.ts                 # SQLite 数据层
   ├─ storage.ts            # 存储抽象（本地实现）
   ├─ auth.ts               # 认证
   ├─ sanitize.ts           # HTML XSS 过滤
   ├─ types.ts              # 类型定义
   └─ format.ts             # 时间/时长格式化
```

## 文档

- [部署指南](./docs/deployment.md)
- [S3/R2 对象存储迁移计划](./docs/r2-s3-migration.md)

## 后续可做

- [ ] 接入 Cloudflare R2 对象存储（见迁移文档）
- [ ] 图片缩略图 / WebP 自动转换
- [ ] 帖子编辑与删除
- [ ] 草稿箱
- [ ] 前端直传（presigned URL，减轻服务器带宽）
