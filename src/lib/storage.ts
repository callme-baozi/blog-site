import path from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";

// 上传文件存储根目录：优先环境变量，否则项目根目录下 uploads/
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export interface SaveOptions {
  filename: string;
  contentType: string;
  subdir: "images" | "videos";
  data: Buffer;
}

export interface SavedFile {
  relativePath: string;
  publicUrl: string;
  absolutePath: string;
}

/**
 * 存储抽象接口。当前为本地磁盘实现；
 * 后续接入 S3/R2 时新增实现类即可，API 路由无需改动。
 * 详见 docs/r2-s3-migration.md
 */
export interface StorageProvider {
  save(options: SaveOptions): Promise<SavedFile>;
  getAbsolutePath(relativePath: string): string;
}

function getExtension(filename: string, contentType: string): string {
  const extFromName = path.extname(filename).toLowerCase();
  if (extFromName && extFromName.length <= 5) return extFromName;

  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
  };
  return map[contentType] || "";
}

// 将相对路径解析为绝对路径，确保始终在 UPLOAD_DIR 内
function resolveUploadPath(...segments: string[]): string {
  if (process.env.UPLOAD_DIR) {
    return path.join(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR, ...segments);
  }
  return path.join(process.cwd(), "uploads", ...segments);
}

export class LocalStorage implements StorageProvider {
  async save({ filename, contentType, subdir, data }: SaveOptions): Promise<SavedFile> {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const ext = getExtension(filename, contentType);
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 16);
    const uniqueName = `${Date.now()}-${hash}${ext}`;

    const relativeDir = path.posix.join(subdir, year, month);
    const absoluteDir = resolveUploadPath(relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });

    const relativePath = path.posix.join(relativeDir, uniqueName);
    const absolutePath = resolveUploadPath(relativePath);
    await fs.writeFile(absolutePath, data);

    return {
      relativePath,
      publicUrl: `/uploads/${relativePath}`,
      absolutePath,
    };
  }

  getAbsolutePath(relativePath: string): string {
    const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
    return resolveUploadPath(normalized);
  }
}

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = new LocalStorage();
  }
  return storageInstance;
}

export { UPLOAD_DIR };
