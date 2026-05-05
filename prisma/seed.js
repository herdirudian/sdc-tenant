const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaClient, UserRole } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

function createAdapter() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Error: DATABASE_URL is not set in .env file");
    process.exit(1);
  }

  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\/+/, "");

    return new PrismaMariaDb({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      connectionLimit: 1,
    });
  } catch (err) {
    console.error("Error parsing DATABASE_URL:", err.message);
    process.exit(1);
  }
}

async function main() {
  console.log("Initializing Prisma with MariaDB adapter...");
  const prisma = new PrismaClient({
    adapter: createAdapter(),
  });

  try {
    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@sdc.local";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me";

    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Administrator",
          role: UserRole.ADMIN,
          passwordHash: createPasswordHash(adminPassword),
        },
      });
      console.log(`Admin user created: ${adminEmail}`);
    } else {
      console.log(`Admin user already exists: ${adminEmail}`);
    }

    const settings = await prisma.companySettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      await prisma.companySettings.create({
        data: { id: "default", companyName: "PT Solusi Digital Creative" },
      });
      console.log("Default company settings created.");
    }
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
