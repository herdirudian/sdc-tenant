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
  // 1. If tenantId is provided, try to get Tenant's SMTP settings
  if (tenantId) {
    const settings = await prisma.companySettings.findFirst({
      where: { tenantId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPass: true,
        smtpPassEnc: true,
        smtpFrom: true,
      },
    });

    if (settings?.smtpHost && settings?.smtpPort && settings?.smtpUser && settings?.smtpFrom) {
      let pass: string | null = settings.smtpPass;
      if (!pass && settings.smtpPassEnc) {
        try {
          pass = decryptSecret(settings.smtpPassEnc);
        } catch (err) {}
      }
      
      if (pass) {
        return {
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: Boolean(settings.smtpSecure),
          user: settings.smtpUser,
          pass,
          from: settings.smtpFrom,
        };
      }
    }
  }

  // 2. Try to get Owner's Global SMTP settings
  const globalSettings = await prisma.globalSettings.findUnique({
    where: { id: "system" },
    select: {
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPass: true,
      smtpPassEnc: true,
      smtpFrom: true,
    },
  });

  if (globalSettings?.smtpHost && globalSettings?.smtpPort && globalSettings?.smtpUser && globalSettings?.smtpFrom) {
    let pass: string | null = globalSettings.smtpPass;
    if (!pass && globalSettings.smtpPassEnc) {
      try {
        pass = decryptSecret(globalSettings.smtpPassEnc);
      } catch (err) {}
    }

    if (pass) {
      return {
        host: globalSettings.smtpHost,
        port: globalSettings.smtpPort,
        secure: Boolean(globalSettings.smtpSecure),
        user: globalSettings.smtpUser,
        pass,
        from: globalSettings.smtpFrom,
      };
    }
  }

  // 3. Final Fallback to Environment Variables (Optional but good to have)
  const host = env("SMTP_HOST");
  if (host) {
    return {
      host,
      port: Number(env("SMTP_PORT") || 465),
      secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS"),
      from: env("SMTP_FROM"),
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
