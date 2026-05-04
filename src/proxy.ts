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

import { getGlobalSettings } from "./actions/saas-admin";
import { getSession } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Maintenance Mode Check
  // Skip check for static assets, API, and System Admin
  if (
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api") &&
    pathname !== "/favicon.ico"
  ) {
    const settings = await getGlobalSettings();
    const session = await getSession();
    const ownerEmail = process.env.ADMIN_EMAIL || "admin@sdc.local";

    if (settings.maintenanceMode && session?.user.email !== ownerEmail) {
      // Redirect to maintenance page if not already there
      if (pathname !== "/maintenance") {
        return NextResponse.redirect(new URL("/maintenance", request.url));
      }
    } else if (!settings.maintenanceMode && pathname === "/maintenance") {
      // Redirect back to home if maintenance mode is OFF but user is on /maintenance page
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/portal") ||
    pathname.includes("/print") ||
    pathname.includes("/receipt") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    if (pathname === "/") return NextResponse.next(); // Show landing page
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const ok = await verifySessionCookie(sessionCookie);
  if (!ok) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.set(SESSION_COOKIE, "", { expires: new Date(0), path: "/" });
    return res;
  }

  // 3. Subscription Check for Protected Routes
  const session = await getSession();
  if (session) {
    const sub = session.user.tenant.subscription;
    const isInactive = !sub || (sub.status !== "ACTIVE" && sub.status !== "TRIAL");
    const isOwner = session.user.email === (process.env.ADMIN_EMAIL || "admin@sdc.local");

    // Block access to sub-pages if inactive (except for landing page and checkout)
    if (isInactive && !isOwner && pathname !== "/" && pathname !== "/checkout") {
      return NextResponse.redirect(new URL("/checkout", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

