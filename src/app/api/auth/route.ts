import { NextResponse } from "next/server";
import { clearSessionCookie, isAuthenticated } from "@/lib/auth";

// GET /api/auth — 检查当前是否已登录
export async function GET() {
  const authed = await isAuthenticated();
  return NextResponse.json({ authenticated: authed });
}

// POST /api/auth — 登出
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
