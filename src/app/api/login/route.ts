import { NextResponse } from "next/server";
import { login, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = typeof body.password === "string" ? body.password : "";

    const ok = await login(password);
    if (!ok) {
      return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
    }

    await setSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
}
