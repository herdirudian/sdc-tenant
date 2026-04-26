import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma_v3?: PrismaClient };

function createAdapter() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return new PrismaMariaDb({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "",
      database: "inv_sdc",
      connectionLimit: 5,
    });
  }

  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\/+/, "");

  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 10,
  });
}

export const prisma =
  globalForPrisma.prisma_v3 ??
  (() => {
    const client = new PrismaClient({
      adapter: createAdapter(),
      log: ["error", "warn"],
    });
    
    // Check if models exist
    const models = Object.getOwnPropertyNames(Object.getPrototypeOf(client)).filter(k => !k.startsWith('$') && k !== 'constructor');
    console.log("[Prisma] Client initialized. Models found:", models);
    
    if (!('passwordResetCode' in client)) {
      console.error("[Prisma] ERROR: passwordResetCode model missing from PrismaClient!");
    }
    
    return client;
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_v3 = prisma;
