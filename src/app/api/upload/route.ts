import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { createAsset } from "@/lib/db";
import { optimizeVideo } from "@/lib/video";
import type { AssetType } from "@/lib/types";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "フォームデータの解析に失敗しました" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "ファイルサイズは200MB以下にしてください" }, { status: 413 });
  }

  let type: AssetType;
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    type = "image";
  } else if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
    type = "video";
  } else {
    return NextResponse.json(
      { error: `未対応のファイル形式です: ${file.type || "不明"}` },
      { status: 415 }
    );
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());

  // 動画は moov 前置（faststart）に最適化してストリーミング再生を有効化。
  // ffmpeg が無い場合はそのまま保存される（アップロードは失敗しない）。
  if (type === "video") {
    buffer = await optimizeVideo(buffer, file.name, file.type);
  }

  const storage = getStorage();
  const saved = await storage.save({
    filename: file.name,
    contentType: file.type,
    subdir: type === "image" ? "images" : "videos",
    data: buffer,
  });

  // 動画サムネイル（クライアントが1フレーム目をキャプチャして送信）
  let posterUrl: string | null = null;
  const poster = formData.get("poster");
  if (poster instanceof File && poster.size > 0) {
    const posterBuffer = Buffer.from(await poster.arrayBuffer());
    const savedPoster = await storage.save({
      filename: poster.name || "poster.jpg",
      contentType: poster.type || "image/jpeg",
      subdir: "images",
      data: posterBuffer,
    });
    posterUrl = savedPoster.publicUrl;
  }

  const width = Number(formData.get("width")) || null;
  const height = Number(formData.get("height")) || null;
  const duration = Number(formData.get("duration")) || null;

  const asset = createAsset({
    type,
    url: saved.publicUrl,
    posterUrl,
    width,
    height,
    duration,
  });

  return NextResponse.json(
    {
      id: asset.id,
      type: asset.type,
      url: asset.url,
      posterUrl: asset.poster_url,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    },
    { status: 201 }
  );
}

export const dynamic = "force-dynamic";
