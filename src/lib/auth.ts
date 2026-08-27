import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "blog_session";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.AUTHOR_PASSWORD || "";
}

function getPassword(): string {
  return process.env.AUTHOR_PASSWORD || "";
}

// HMAC-SHA256 签名
function sign(data: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("AUTHOR_PASSWORD is not configured");
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function createToken(): string {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS });
  const b64Payload = Buffer.from(payload).toString("base64url");
  const signature = sign(b64Payload);
  return `${b64Payload}.${signature}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const [b64Payload, signature] = token.split(".");
    if (!b64Payload || !signature) return false;

    const expectedSig = sign(b64Payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;

    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString());
    if (typeof payload.exp !== "number") return false;
    if (Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export async function login(password: string): Promise<boolean> {
  const expected = getPassword();
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(password), Buffer.from(expected))) {
    return false;
  }
  return true;
}

export async function setSessionCookie() {
  const token = createToken();
  const cookieStore = await cookies();
  const headerStore = await headers();
  // Nginx が X-Forwarded-Proto を設定しているのでそれを見る；
  // HTTP アクセス時に Secure cookie を付けるとブラウザが送信しなくなる
  const proto = headerStore.get("x-forwarded-proto");
  const isHttps = proto === "https";
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
