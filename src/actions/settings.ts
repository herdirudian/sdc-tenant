"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole, requireTenant } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole } from "@prisma/client";
import { AppEncryptionKeyError, encryptSecret } from "@/lib/secret";
import { sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const companySchema = z.object({
  companyName: z.string().trim().min(1),
  npwp: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  letterheadUrl: z.string().trim().optional().or(z.literal("")),
  signatureUrl: z.string().trim().optional().or(z.literal("")),
  signatureName: z.string().trim().optional().or(z.literal("")),
  signatureTitle: z.string().trim().optional().or(z.literal("")),
  invoiceTerms: z.string().trim().optional().or(z.literal("")),
  invoiceFooter: z.string().trim().optional().or(z.literal("")),
  defaultDueDays: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0),
});

const bankSchema = z.object({
  label: z.string().trim().min(1),
  accountName: z.string().trim().min(1),
  accountNumber: z.string().trim().min(1),
  isActive: z.boolean().default(true),
});

const smtpSchema = z.object({
  smtpHost: z.string().trim().min(1),
  smtpPort: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0)
    .transform((v) => Number(v)),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().trim().min(1),
  smtpPass: z.string().optional().or(z.literal("")),
  smtpFrom: z.string().trim().min(1),
});

const smtpTestSchema = z.object({
  toEmail: z.string().trim().email(),
});

function emptyToNull(value: string | undefined) {
  if (!value || value === "") return null;
  return value;
}

async function savePublicUpload(input: { folder: string; file: File }) {
  if (input.file.size <= 0) throw new Error("Empty file");
  if (input.file.size > 10 * 1024 * 1024) throw new Error("File too large");

  const ext = (() => {
    const lastDot = input.file.name.lastIndexOf(".");
    if (lastDot === -1) return "";
    const raw = input.file.name.slice(lastDot).toLowerCase();
    if (!/^\.[a-z0-9]+$/.test(raw)) return "";
    return raw;
  })();

  const safeFolder = input.folder
    .split(/[\\/]/g)
    .filter((p) => p && p !== "." && p !== "..")
    .join(path.sep);

  const publicDir = path.join(process.cwd(), "public");
  const diskDir = path.join(publicDir, "uploads", safeFolder);
  await mkdir(diskDir, { recursive: true });

  const fileName = `${randomUUID()}${ext}`;
  const diskPath = path.join(diskDir, fileName);
  const buf = Buffer.from(await input.file.arrayBuffer());
  await writeFile(diskPath, buf);

  const urlPath = `/uploads/${safeFolder.split(path.sep).join("/")}/${fileName}`.replaceAll(
    "//",
    "/",
  );
  return urlPath;
}

async function tryDeletePublicFile(url: string) {
  if (!url.startsWith("/uploads/")) return;

  const publicDir = path.join(process.cwd(), "public");
  const diskPath = path.normalize(path.join(publicDir, url));

  const publicDirLower = publicDir.toLowerCase();
  const diskPathLower = diskPath.toLowerCase();
  if (!diskPathLower.startsWith(publicDirLower)) return;

  await unlink(diskPath).catch(() => undefined);
}

export async function getCompanySettings() {
  const { tenantId, tenant } = await requireTenant();
  const settings = await prisma.companySettings.findFirst({
    where: { tenantId },
    include: { bankAccounts: { orderBy: { createdAt: "asc" } } },
  });

  if (settings) return settings;

  return prisma.companySettings.create({
    data: { 
      tenantId, 
      companyName: tenant.name || "Sistem Invoice SDC" 
    },
    include: { bankAccounts: { orderBy: { createdAt: "asc" } } },
  });
}

export async function updateCompanySettings(formData: FormData) {
  const { tenantId, user: actor } = await requireTenant();
  if (actor.role !== UserRole.ADMIN) redirect("/settings?error=forbidden");

  const parsed = companySchema.safeParse({
    companyName: formData.get("companyName"),
    npwp: formData.get("npwp"),
    address: formData.get("address"),
    logoUrl: formData.get("logoUrl"),
    letterheadUrl: formData.get("letterheadUrl"),
    signatureUrl: formData.get("signatureUrl"),
    signatureName: formData.get("signatureName"),
    signatureTitle: formData.get("signatureTitle"),
    invoiceTerms: formData.get("invoiceTerms"),
    invoiceFooter: formData.get("invoiceFooter"),
    defaultDueDays: formData.get("defaultDueDays"),
  });

  if (!parsed.success) redirect("/settings?error=invalid");

  const maybeLogoFile = formData.get("logoFile");
  const logoFile = maybeLogoFile instanceof File && maybeLogoFile.size > 0 ? maybeLogoFile : null;

  const maybeLetterheadFile = formData.get("letterheadFile");
  const letterheadFile =
    maybeLetterheadFile instanceof File && maybeLetterheadFile.size > 0
      ? maybeLetterheadFile
      : null;

  const maybeSignatureFile = formData.get("signatureFile");
  const signatureFile =
    maybeSignatureFile instanceof File && maybeSignatureFile.size > 0 ? maybeSignatureFile : null;

  const before = await prisma.companySettings.findFirst({ where: { tenantId } });

  const finalLogoUrl = logoFile
    ? await savePublicUpload({ folder: `settings/${tenantId}`, file: logoFile })
    : emptyToNull(parsed.data.logoUrl);

  const finalLetterheadUrl = letterheadFile
    ? await savePublicUpload({ folder: `settings/${tenantId}`, file: letterheadFile })
    : emptyToNull(parsed.data.letterheadUrl);

  const finalSignatureUrl = signatureFile
    ? await savePublicUpload({ folder: `settings/${tenantId}`, file: signatureFile })
    : emptyToNull(parsed.data.signatureUrl);

  // Delete old files if replaced
  if (finalLogoUrl && before?.logoUrl && before.logoUrl !== finalLogoUrl) {
    await tryDeletePublicFile(before.logoUrl);
  }
  if (
    finalLetterheadUrl &&
    before?.letterheadUrl &&
    before.letterheadUrl !== finalLetterheadUrl
  ) {
    await tryDeletePublicFile(before.letterheadUrl);
  }
  if (finalSignatureUrl && before?.signatureUrl && before.signatureUrl !== finalSignatureUrl) {
    await tryDeletePublicFile(before.signatureUrl);
  }

  const after = await prisma.companySettings.upsert({
    where: { id: before?.id || "new" },
    create: {
      tenantId,
      companyName: parsed.data.companyName,
      npwp: emptyToNull(parsed.data.npwp),
      address: emptyToNull(parsed.data.address),
      logoUrl: finalLogoUrl,
      letterheadUrl: finalLetterheadUrl,
      signatureUrl: finalSignatureUrl,
      signatureName: emptyToNull(parsed.data.signatureName),
      signatureTitle: emptyToNull(parsed.data.signatureTitle),
      invoiceTerms: emptyToNull(parsed.data.invoiceTerms),
      invoiceFooter: emptyToNull(parsed.data.invoiceFooter),
      defaultDueDays: Number(parsed.data.defaultDueDays),
    },
    update: {
      companyName: parsed.data.companyName,
      npwp: emptyToNull(parsed.data.npwp),
      address: emptyToNull(parsed.data.address),
      logoUrl: finalLogoUrl,
      letterheadUrl: finalLetterheadUrl,
      signatureUrl: finalSignatureUrl,
      signatureName: emptyToNull(parsed.data.signatureName),
      signatureTitle: emptyToNull(parsed.data.signatureTitle),
      invoiceTerms: emptyToNull(parsed.data.invoiceTerms),
      invoiceFooter: emptyToNull(parsed.data.invoiceFooter),
      defaultDueDays: Number(parsed.data.defaultDueDays),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.SETTINGS,
    entityId: after.id,
    beforeJson: before ?? undefined,
    afterJson: after,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/settings");
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/settings");
}

export async function updateSmtpSettings(formData: FormData) {
  const { tenantId, user: actor } = await requireTenant();
  if (actor.role !== UserRole.ADMIN) redirect("/settings?error=forbidden");

  const parsed = smtpSchema.safeParse({
    smtpHost: formData.get("smtpHost"),
    smtpPort: formData.get("smtpPort"),
    smtpSecure: formData.get("smtpSecure") === "on",
    smtpUser: formData.get("smtpUser"),
    smtpPass: formData.get("smtpPass"),
    smtpFrom: formData.get("smtpFrom"),
  });
  if (!parsed.success) redirect("/settings?error=invalid");

  const before = await prisma.companySettings.findFirst({ where: { tenantId } });
  let passEnc: string | undefined;
  if (parsed.data.smtpPass && parsed.data.smtpPass !== "") {
    try {
      passEnc = encryptSecret(parsed.data.smtpPass);
    } catch (err) {
      if (err instanceof AppEncryptionKeyError) {
        if (err.message === "Missing env: APP_ENCRYPTION_KEY") {
          redirect("/settings?error=missing_encryption_key");
        }
        redirect("/settings?error=invalid_encryption_key");
      }
      const msg = err instanceof Error ? err.message : "unknown";
      redirect(`/settings?error=smtp_save&msg=${encodeURIComponent(msg)}`);
    }
  }

  const after = await prisma.companySettings.upsert({
    where: { id: before?.id || "new" },
    create: {
      tenantId,
      companyName: before?.companyName || "Sistem Invoice SDC",
      defaultDueDays: before?.defaultDueDays || 14,
      smtpHost: parsed.data.smtpHost,
      smtpPort: parsed.data.smtpPort,
      smtpSecure: parsed.data.smtpSecure,
      smtpUser: parsed.data.smtpUser,
      smtpPassEnc: passEnc ?? null,
      smtpFrom: parsed.data.smtpFrom,
    },
    update: {
      smtpHost: parsed.data.smtpHost,
      smtpPort: parsed.data.smtpPort,
      smtpSecure: parsed.data.smtpSecure,
      smtpUser: parsed.data.smtpUser,
      ...(passEnc ? { smtpPassEnc: passEnc } : {}),
      smtpFrom: parsed.data.smtpFrom,
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.SETTINGS,
    entityId: "smtp",
    beforeJson: before
      ? {
          smtpHost: before.smtpHost,
          smtpPort: before.smtpPort,
          smtpSecure: before.smtpSecure,
          smtpUser: before.smtpUser,
          smtpFrom: before.smtpFrom,
        }
      : undefined,
    afterJson: {
      smtpHost: after.smtpHost,
      smtpPort: after.smtpPort,
      smtpSecure: after.smtpSecure,
      smtpUser: after.smtpUser,
      smtpFrom: after.smtpFrom,
      passUpdated: Boolean(passEnc),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/settings");
  redirect("/settings?saved=smtp");
}

export async function testSmtpSettings(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = smtpTestSchema.safeParse({
    toEmail: formData.get("toEmail"),
  });
  if (!parsed.success) redirect("/settings?error=invalid");

  try {
    await sendEmail({
      tenantId: actor.tenantId,
      to: parsed.data.toEmail,
      subject: `Test Email SMTP - Solusi Invoice`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Test SMTP Berhasil!</h2>
          <p>Email ini dikirim untuk memverifikasi pengaturan SMTP Anda di <b>Solusi Invoice</b>.</p>
          <p>Jika Anda menerima email ini, berarti konfigurasi email Anda sudah benar.</p>
        </div>
      `,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "failed";
    redirect(`/settings?error=smtp_test&msg=${encodeURIComponent(msg)}`);
  }

  redirect("/settings?smtpTest=ok");
}

export async function createBankAccount(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const { tenantId } = actor;

  const parsed = bankSchema.safeParse({
    label: formData.get("label"),
    accountName: formData.get("accountName"),
    accountNumber: formData.get("accountNumber"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) redirect("/settings?error=invalid");

  const companySettings = await prisma.companySettings.findFirst({
    where: { tenantId },
  });

  if (!companySettings) {
    redirect("/settings?error=no_settings");
  }

  const created = await prisma.bankAccount.create({
    data: {
      tenantId,
      companySettingsId: companySettings.id,
      label: parsed.data.label,
      accountName: parsed.data.accountName,
      accountNumber: parsed.data.accountNumber,
      isActive: parsed.data.isActive,
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.BANK_ACCOUNT,
    entityId: created.id,
    afterJson: created,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function toggleBankAccount(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const { tenantId } = actor;
  const id = z.string().min(1).parse(formData.get("id"));
  const isActive = z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .parse(formData.get("isActive"));

  const before = await prisma.bankAccount.findUnique({ 
    where: { id, tenantId } 
  });
  if (!before) redirect("/settings?error=not_found");

  const after = await prisma.bankAccount.update({ 
    where: { id, tenantId }, 
    data: { isActive } 
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.BANK_ACCOUNT,
    entityId: id,
    beforeJson: before ?? undefined,
    afterJson: after,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/settings");
  redirect("/settings");
}

export async function deleteBankAccount(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const { tenantId } = actor;
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.bankAccount.findUnique({ 
    where: { id, tenantId } 
  });
  if (!before) redirect("/settings?error=not_found");

  await prisma.bankAccount.delete({ 
    where: { id, tenantId } 
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId,
    actorUserId: actor.id,
    action: AuditAction.DELETE,
    entityType: AuditEntityType.BANK_ACCOUNT,
    entityId: id,
    beforeJson: before ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/settings");
  redirect("/settings");
}
