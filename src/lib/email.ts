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

async function getSmtpConfig() {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
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
        if (
          err instanceof AppEncryptionKeyError &&
          err.message === "Missing env: APP_ENCRYPTION_KEY"
        ) {
          throw new Error("APP_ENCRYPTION_KEY belum di-set. Tidak bisa dekripsi SMTP password.");
        }
        throw err;
      }
    }
    if (!pass) throw new Error("SMTP password not configured");
    return {
      host: settings!.smtpHost as string,
      port: settings!.smtpPort as number,
      secure: Boolean(settings!.smtpSecure),
      user: settings!.smtpUser as string,
      pass,
      from: settings!.smtpFrom as string,
    };
  }

  return {
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT")),
    secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    user: env("SMTP_USER"),
    pass: env("SMTP_PASS"),
    from: env("SMTP_FROM"),
  };
}

export async function sendEmail(input: SendEmailInput) {
  const { host, port, secure, user, pass, from } = await getSmtpConfig();

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
