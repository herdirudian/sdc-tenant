import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sdc_session";

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

function base64UrlToBytes(input: string) {
  const base64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function verifySessionCookie(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  if (bytesToBase64Url(mac) !== signature) return false;

  const decoded = new TextDecoder().decode(base64UrlToBytes(payload));
  const parsed = JSON.parse(decoded) as { sid: string; exp: number };
  if (!parsed?.sid || !parsed?.exp) return false;
  if (Date.now() > parsed.exp) return false;
  return true;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/portal") ||
    pathname.includes("/print") ||
    pathname.includes("/receipt") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const ok = await verifySessionCookie(session);
  if (!ok) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.set(SESSION_COOKIE, "", { expires: new Date(0), path: "/" });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

