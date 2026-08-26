import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deletePost, getPostById, updatePost } from "@/lib/db";
import { sanitizeContent } from "@/lib/sanitize";

const MAX_MEDIA = 20;

// GET /api/posts/[id] — 単一投稿を取得
export async function GET(_request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }
  const post = getPostById(postId);
  if (!post) {
    return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ post });
}

// PUT /api/posts/[id] — 投稿を更新（要ログイン）
export async function PUT(request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
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

  const post = updatePost(postId, content, assetIds);
  if (!post) {
    return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ post });
}

// DELETE /api/posts/[id] — 投稿を削除（要ログイン）
export async function DELETE(_request: Request, ctx: RouteContext<"/api/posts/[id]">) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ error: "無効なIDです" }, { status: 400 });
  }

  const ok = deletePost(postId);
  if (!ok) {
    return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
