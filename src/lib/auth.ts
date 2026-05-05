import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "sdc_session";

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(input: string) {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  return Buffer.from(withPad, "base64");
}

function sign(payload: string) {
  const mac = createHmac("sha256", getAuthSecret()).update(payload).digest();
  return base64UrlEncode(mac);
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, saltB64, hashB64] = stored.split(":");
  if (algo !== "scrypt") return false;
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const session = await prisma.session.create({
    data: { userId, expiresAt },
    select: { id: true, expiresAt: true },
  });
  return session;
}

export async function setSessionCookie(session: { id: string; expiresAt: Date }) {
  const payloadObj = { sid: session.id, exp: session.expiresAt.getTime() };
  const payload = base64UrlEncode(Buffer.from(JSON.stringify(payloadObj), "utf8"));
  const signature = sign(payload);
  const value = `${payload}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
  });
}

export async function clearSessionCookie() {
  const session = await getSession();
  if (session) await prisma.session.delete({ where: { id: session.id } });
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
}

export function parseSessionCookie(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;
  const decoded = base64UrlDecode(payload).toString("utf8");
  const parsed = JSON.parse(decoded) as { sid: string; exp: number };
  if (!parsed.sid || !parsed.exp) return null;
  if (Date.now() > parsed.exp) return null;
  return parsed;
}

export async function getSession() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parsed = parseSessionCookie(raw);
  if (!parsed) return null;

  const session = await prisma.session.findUnique({
    where: { id: parsed.sid },
    include: {
      user: {
        include: {
          tenant: {
            include: {
              subscription: true,
            },
          },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) return null as any;
  return session.user;
}

export async function requireTenant() {
  const session = await getSession();
  if (!session || !session.user.tenantId) redirect("/login");
  
  const subscription = session.user.tenant.subscription;
  return {
    tenantId: session.user.tenantId,
    user: session.user,
    tenant: session.user.tenant,
    subscription,
  };
}

export async function requireSubscription() {
  const tenantInfo = await requireTenant();
  const { subscription } = tenantInfo;
  if (!subscription || (subscription.status !== "ACTIVE" && subscription.status !== "TRIAL")) {
    redirect("/checkout");
  }
  return tenantInfo;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export async function getRequestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}
