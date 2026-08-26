import { NextResponse } from "next/server";
import { stat, open } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { getStorage, UPLOAD_DIR } from "@/lib/storage";
import path from "node:path";
import { Readable } from "node:stream";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

// Web ReadableStream へ変換
function streamToWebStream(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

// 開発環境ではこのルートが /uploads/* を配信；
// 本番環境では Nginx が直接配信し、このルートはフォールバックとして機能。
// iOS Safari での動画再生には HTTP Range リクエスト対応が必須。
export async function GET(request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: segments } = await ctx.params;
  const relativePath = Array.isArray(segments) ? segments.join("/") : segments;

  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  if (normalized.includes("..")) {
    return NextResponse.json({ error: "不正なパスです" }, { status: 400 });
  }

  const storage = getStorage();
  const absolutePath = storage.getAbsolutePath(normalized);

  if (!absolutePath.startsWith(UPLOAD_DIR)) {
    return NextResponse.json({ error: "不正なパスです" }, { status: 400 });
  }

  let fileSize: number;
  try {
    const stats = await stat(absolutePath);
    fileSize = stats.size;
  } catch {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

  const cacheHeaders = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  // Range ヘッダーの解析
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    // 通常の全体リクエスト
    const fd = await open(absolutePath, "r");
    try {
      const nodeStream = fd.createReadStream();
      return new NextResponse(streamToWebStream(nodeStream), {
        status: 200,
        headers: {
          ...cacheHeaders,
          "Content-Length": String(fileSize),
        },
      });
    } catch {
      await fd.close();
      return NextResponse.json({ error: "ファイルの読み込みに失敗しました" }, { status: 500 });
    }
  }

  // bytes=start-end の解析
  const rangeSpec = rangeHeader.replace("bytes=", "");
  const ranges = rangeSpec.split(",")[0].trim();
  let start: number;
  let end: number;

  const dashIndex = ranges.indexOf("-");
  const startStr = ranges.slice(0, dashIndex);
  const endStr = ranges.slice(dashIndex + 1);

  if (startStr === "") {
    // suffix range: bytes=-N (last N bytes)
    const suffixLength = parseInt(endStr, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === "" ? fileSize - 1 : parseInt(endStr, 10);
  }

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end >= fileSize ||
    start > end
  ) {
    return new NextResponse(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const chunkSize = end - start + 1;
  const fd = await open(absolutePath, "r");
  const nodeStream = fd.createReadStream({ start, end });

  return new NextResponse(streamToWebStream(nodeStream), {
    status: 206,
    headers: {
      ...cacheHeaders,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Content-Length": String(chunkSize),
    },
  });
}

export const dynamic = "force-dynamic";
