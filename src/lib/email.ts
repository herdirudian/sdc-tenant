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

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getSmtpConfig(tenantId?: string) {
  // 1. If tenantId is provided, try to get Tenant's SMTP settings
  if (tenantId) {
    const settings = await prisma.companySettings.findFirst({
      where: { tenantId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPassEnc: true,
        smtpFrom: true,
      },
    });

    const hasDb = Boolean(settings?.smtpHost && settings?.smtpPort && settings?.smtpUser && settings?.smtpFrom);
    if (hasDb) {
      let pass: string | null = null;
      if (settings?.smtpPassEnc) {
        try {
          pass = decryptSecret(settings.smtpPassEnc);
        } catch (err) {
          console.error("Failed to decrypt tenant SMTP password:", err);
        }
      }
      if (pass) {
        return {
          host: settings!.smtpHost as string,
          port: settings!.smtpPort as number,
          secure: Boolean(settings!.smtpSecure),
          user: settings!.smtpUser as string,
          pass,
          from: settings!.smtpFrom as string,
        };
      }
    }
  }

  // 2. Try to get Owner's Global SMTP settings from Database
  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: "system" },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPassEnc: true,
      smtpFrom: true,
    },
  });

  const hasGlobalDb = Boolean(globalSettings?.smtpHost && globalSettings?.smtpPort && globalSettings?.smtpUser && globalSettings?.smtpFrom);
  if (hasGlobalDb) {
    let pass: string | null = null;
    
    // 1. Try plain text first (bypass)
    if ((globalSettings as any).smtpPass) {
      pass = (globalSettings as any).smtpPass;
    } 
    // 2. Try encrypted if plain is not available
    else if (globalSettings?.smtpPassEnc) {
      try {
        pass = decryptSecret(globalSettings.smtpPassEnc);
      } catch (err) {
        console.error("Failed to decrypt global SMTP password:", err);
      }
    }

    if (pass) {
      return {
        host: globalSettings!.smtpHost as string,
        port: globalSettings!.smtpPort as number,
        secure: Boolean(globalSettings!.smtpSecure),
        user: globalSettings!.smtpUser as string,
        pass,
        from: globalSettings!.smtpFrom as string,
      };
    }
  }

  // 3. Final Fallback to Environment Variables
  return {
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT")),
    secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
    from: env("SMTP_FROM"),
  };
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
