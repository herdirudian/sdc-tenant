import nodemailer from "nodemailer";

import { prisma } from "@/lib/prisma";
import { AppEncryptionKeyError, decryptSecret } from "@/lib/secret";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content?: string; // base64 string
    path?: string;    // disk path
    encoding?: "base64";
  }>;
};

function env(name: string): string {
  const value = process.env[name];
  return value || "";
}

async function getSmtpConfig(tenantId?: string) {
  console.log("DEBUG: Getting SMTP config for tenant:", tenantId || "SYSTEM/OWNER");

  // 1. Try to get Tenant's SMTP settings if tenantId is provided
  if (tenantId) {
    const settings = await prisma.companySettings.findFirst({
      where: { tenantId },
    });

    if (settings?.smtpHost && settings?.smtpUser) {
      console.log("DEBUG: Using Tenant SMTP settings from DB");
      return {
        host: settings.smtpHost,
        port: settings.smtpPort || 465,
        secure: Boolean(settings.smtpSecure),
        user: settings.smtpUser,
        pass: settings.smtpPass || "", // Use plain text pass
        from: settings.smtpFrom || settings.smtpUser,
      };
    }
  }

  // 2. Try to get Owner's Global SMTP settings
  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: "system" },
  });

  if (globalSettings?.smtpHost && globalSettings?.smtpUser) {
    console.log("DEBUG: Using Owner SMTP settings from DB");
    return {
      host: globalSettings.smtpHost,
      port: globalSettings.smtpPort || 465,
      secure: Boolean(globalSettings.smtpSecure),
      user: globalSettings.smtpUser,
      pass: globalSettings.smtpPass || "", // Use plain text pass
      from: globalSettings.smtpFrom || globalSettings.smtpUser,
    };
  }

  // 3. Final Fallback to Environment Variables
  const envHost = process.env.SMTP_HOST;
  if (envHost) {
    console.log("DEBUG: Using SMTP settings from .env");
    return {
      host: envHost,
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      from: process.env.SMTP_FROM || "",
    };
  }

  throw new Error("SMTP belum dikonfigurasi. Silakan atur di System Owner > Kendali Sistem.");
}

export async function sendEmail(input: SendEmailInput & { tenantId?: string }) {
  const { host, port, secure, user, pass, from } = await getSmtpConfig(input.tenantId);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });

  return { messageId: info.messageId ?? null };
}
