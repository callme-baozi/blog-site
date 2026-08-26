import { NextResponse } from "next/server";
import { createPost, listPosts } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { sanitizeContent } from "@/lib/sanitize";

const MAX_MEDIA = 20;

// GET /api/posts?limit=20&before=1234567890
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const before = searchParams.get("before") ? Number(searchParams.get("before")) : undefined;

  const posts = listPosts({ limit, before });
  return NextResponse.json({ posts });
}

// POST /api/posts — 投稿作成（要ログイン）
export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let body: { content?: string; assetIds?: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const rawContent = typeof body.content === "string" ? body.content : "";
  const assetIds = Array.isArray(body.assetIds)
    ? body.assetIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id))
    : [];

  if (assetIds.length > MAX_MEDIA) {
    return NextResponse.json(
      { error: `メディアは最大${MAX_MEDIA}個までです` },
      { status: 400 }
    );
  }

  const content = sanitizeContent(rawContent);
  const hasText = content.replace(/<[^>]*>/g, "").trim().length > 0;

  if (!hasText && assetIds.length === 0) {
    return NextResponse.json({ error: "投稿内容を入力してください" }, { status: 400 });
  }

  const post = createPost(content, assetIds);
  return NextResponse.json({ post }, { status: 201 });
}
