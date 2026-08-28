import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import type { SiteSettings } from "@/lib/types";

// GET /api/settings — 公開設定を取得
export async function GET() {
  const settings = getSettings();
  return NextResponse.json(settings);
}

// PUT /api/settings — 設定を更新（要ログイン）
// JSON または multipart/form-data（アバター画像アップロード用）に対応
export async function PUT(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let updates: Partial<SiteSettings> = {};
  let avatarFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const siteTitle = formData.get("site_title");
    const siteDescription = formData.get("site_description");
    const authorName = formData.get("author_name");
    const avatar = formData.get("avatar");

    if (typeof siteTitle === "string") updates.site_title = siteTitle;
    if (typeof siteDescription === "string") updates.site_description = siteDescription;
    if (typeof authorName === "string") updates.author_name = authorName;
    if (avatar instanceof File && avatar.size > 0) {
      avatarFile = avatar;
    }
  } else {
    try {
      updates = await request.json();
    } catch {
      return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
    }
  }

  // アバター画像を保存
  if (avatarFile) {
    const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
    if (!ALLOWED.includes(avatarFile.type)) {
      return NextResponse.json(
        { error: "未対応の画像形式です" },
        { status: 415 }
      );
    }
    if (avatarFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "アバター画像は5MB以下にしてください" },
        { status: 413 }
      );
    }
    const storage = getStorage();
    const buffer = Buffer.from(await avatarFile.arrayBuffer());
    const saved = await storage.save({
      filename: avatarFile.name,
      contentType: avatarFile.type,
      subdir: "images",
      data: buffer,
    });
    updates.author_avatar_url = saved.publicUrl;
  }

  // 入力バリデーション
  if (updates.site_title !== undefined && updates.site_title.trim() === "") {
    return NextResponse.json({ error: "サイト名を入力してください" }, { status: 400 });
  }
  if (updates.author_name !== undefined && updates.author_name.trim() === "") {
    return NextResponse.json({ error: "作者名を入力してください" }, { status: 400 });
  }
  if (updates.keywords !== undefined) {
    if (!Array.isArray(updates.keywords)) {
      return NextResponse.json({ error: "关键词の形式が正しくありません" }, { status: 400 });
    }
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of updates.keywords) {
      if (typeof raw !== "string") continue;
      const keyword = raw.trim();
      if (!keyword) continue;
      if (keyword.length > 50) continue;
      const key = keyword.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(keyword);
      if (cleaned.length >= 50) break;
    }
    updates.keywords = cleaned;
  }

  const settings = updateSettings(updates);
  return NextResponse.json(settings);
}

export const dynamic = "force-dynamic";
