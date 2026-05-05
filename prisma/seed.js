const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { PrismaClient, UserRole } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Error: DATABASE_URL is not set in .env file");
    console.log("Current directory:", process.cwd());
    console.log("Env path attempted:", path.join(__dirname, "..", ".env"));
    process.exit(1);
  }

  console.log("Database URL found, initializing Prisma...");
  const prisma = new PrismaClient();
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
