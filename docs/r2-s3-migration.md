# 对象存储迁移计划（S3 / Cloudflare R2）

## 现状

当前版本使用本地磁盘存储上传的图片和视频（`src/lib/storage.ts` 中的 `LocalStorage`），文件保存在服务器 `uploads/` 目录，通过 Nginx 直接 serve。

存储层已抽象为 `StorageProvider` 接口，迁移时只需新增一个实现类并切换 `getStorage()` 返回的实例，**业务代码（API 路由）无需改动**。

## 为什么选 Cloudflare R2

| 维度 | Cloudflare R2 | AWS S3 | Backblaze B2 |
|---|---|---|---|
| 存储费 | $0.015/GB/月 | ~$0.023/GB/月 | $0.00695/GB/月 |
| 出站流量 | **全免** | $0.09/GB | 3×存储量内免费，经 CF CDN 免费 |
| S3 兼容 | 是 | 原生 | 是 |
| 免费额度 | 10GB 存储 + 100万 A 类请求/月 | 5GB（12个月试用） | 10GB |
| CDN | 自带 Cloudflare 全球 CDN | CloudFront 另收费 | 需配 Cloudflare |

**推荐 R2**：视频/图片场景下出站流量费是大头，R2 零出站费 + 自带 CDN，帖子爆火也不会产生天价账单。S3 兼容 API 保证不被锁定。

## 迁移步骤

### 1. 安装依赖

```bash
npm install @aws-sdk/client-s3
```

### 2. 新增环境变量

```env
# 在 .env 中添加
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=blog-assets
S3_ACCESS_KEY_ID=<your_access_key>
S3_SECRET_ACCESS_KEY=<your_secret_key>
S3_PUBLIC_BASE_URL=https://assets.yourdomain.com  # R2 绑定的自定义域名或 r2.dev
```

### 3. 实现 S3StorageProvider

在 `src/lib/storage.ts` 中新增 `S3Storage` 类，实现 `StorageProvider` 接口：

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export class S3Storage implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.S3_BUCKET!;
    this.publicBase = process.env.S3_PUBLIC_BASE_URL!;
  }

  async save({ filename, contentType, subdir, data }: SaveOptions): Promise<SavedFile> {
    const now = new Date();
    const key = `${subdir}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${Date.now()}-${hash}.${ext}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));

    return {
      relativePath: key,
      publicUrl: `${this.publicBase}/${key}`,
      absolutePath: key,
    };
  }

  getAbsolutePath(relativePath: string) {
    return relativePath; // S3 不需要本地路径
  }
}
```

### 4. 切换存储驱动

修改 `getStorage()`：

```typescript
export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance =
      process.env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  }
  return storageInstance;
}
```

### 5. R2 配置要点

1. Cloudflare 控制台创建 R2 bucket，开启 `r2.dev` 子域名或绑定自定义域名
2. 创建 API Token（权限：Object Read & Write）
3. 如用自定义域名，在 Cloudflare DNS 添加 CNAME 并开启 CDN
4. CORS 设置（如需前端直传，当前架构是服务端中转，非必须）

### 6. 历史文件迁移

将服务器现有 `uploads/` 目录同步到 R2：

```bash
# 使用 aws CLI（配置 R2 endpoint）
aws s3 sync ./uploads s3://blog-assets/ --endpoint-url https://<account_id>.r2.cloudflarestorage.com
```

或使用 [rclone](https://rclone.org/) 工具。

### 7. Nginx 调整

迁移后 `/uploads/` 路径不再需要 Nginx serve 本地文件，可移除对应 location 块。
如果 R2 使用自定义域名，图片/视频 URL 会指向该域名，与主站分离。

## 可选优化（后续）

- **前端直传**：大视频文件经服务器中转占用带宽，可改为签发预签名 URL（presigned URL）让浏览器直传 R2，减轻服务器负担
- **图片处理**：R2 + Cloudflare Images 可做自动缩略图/WebP 转换
- **视频转码**：接入 Cloudflare Stream 或 Mux 做自适应码率（HLS）
- **CDN 缓存策略**：对图片/视频设置长缓存 + immutable，文件名带 hash 已天然支持
