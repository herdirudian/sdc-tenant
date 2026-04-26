const { PrismaClient, UserRole } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

async function main() {
  require("dotenv").config();
  const prisma = new PrismaClient();

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
  }

  const settings = await prisma.companySettings.findUnique({ where: { id: "default" } });
  if (!settings) {
    await prisma.companySettings.create({
      data: { id: "default", companyName: "PT Solusi Digital Creative" },
    });
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
