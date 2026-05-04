"use server";

import { prisma } from "@/lib/prisma";
import {
  createPasswordHash,
  createSession,
  getRequestMeta,
  getSession,
  setSessionCookie,
  verifyPassword,
  clearSessionCookie,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole, SubscriptionStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { randomInt } from "crypto";

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/login?error=invalid");

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    redirect("/login?error=credentials");
  }
  if (!user.isActive) redirect("/login?error=inactive");

  const session = await createSession(user.id);
  await setSessionCookie(session);

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: AuditAction.LOGIN,
    entityType: AuditEntityType.USER,
    entityId: user.id,
    afterJson: { email: user.email },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/");
  redirect("/");
}

export async function signOut() {
  const meta = await getRequestMeta();
  const session = await getSession();

  await clearSessionCookie();

  if (session?.user) {
    await writeAuditLog({
      tenantId: session.user.tenantId,
      actorUserId: session.userId,
      action: AuditAction.LOGOUT,
      entityType: AuditEntityType.USER,
      entityId: session.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  revalidatePath("/");
  redirect("/");
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Email tidak valid" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email, isActive: true },
  });

  if (!user) {
    // Return success anyway to prevent email enumeration
    return { success: true };
  }

  // Generate 6 digit code
  const code = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.passwordResetCode.create({
    data: {
      email: user.email,
      code,
      expiresAt,
    }
  });

  try {
    const settings = await prisma.companySettings.findFirst({ where: { tenantId: user.tenantId } });
    const companyName = settings?.companyName || "Solusi Invoice";

    await sendEmail({
      tenantId: user.tenantId,
      to: user.email,
      subject: `Kode Verifikasi Reset Password - ${companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
          <h2 style="color: #2563eb;">Reset Password</h2>
          <p>Halo, ${user.name || user.email}</p>
          <p>Anda telah meminta untuk mereset password akun Anda. Gunakan kode verifikasi di bawah ini untuk melanjutkan:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 14px;">Kode ini akan kadaluarsa dalam 15 menit. Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">${companyName}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send reset email:", err);
    return { error: "Gagal mengirim email verifikasi" };
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.USER,
    entityId: user.id,
    afterJson: { note: "Requested password reset code" },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { success: true };
}

const resetPasswordWithCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: z.string().min(6),
});

export async function verifyAndResetPassword(formData: FormData) {
  const parsed = resetPasswordWithCodeSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Data tidak valid. Password minimal 6 karakter." };
  }

  const { email, code, password } = parsed.data;

  const resetRecord = await prisma.passwordResetCode.findFirst({
    where: {
      email,
      code,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!resetRecord) {
    return { error: "Kode verifikasi tidak valid atau sudah kadaluarsa" };
  }

  const hashedPassword = createPasswordHash(password);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { error: "User tidak ditemukan" };

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { passwordHash: hashedPassword },
    }),
    prisma.passwordResetCode.deleteMany({
      where: { email },
    }),
  ]);

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: user.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.USER,
    entityId: user.id,
    afterJson: { note: "Reset password using verification code" },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { success: true };
}

export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@sdc.local";
  const password = process.env.ADMIN_PASSWORD ?? "change-me";
  const forceReset = process.env.ADMIN_FORCE_RESET === "1";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (forceReset) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name ?? "Administrator",
          role: UserRole.ADMIN,
          isActive: true,
          passwordHash: createPasswordHash(password),
        },
      });
    }
    return;
  }

  const tenant = await prisma.tenant.create({
    data: { name: "Default Tenant" }
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      name: "Administrator",
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash: createPasswordHash(password),
    },
  });

  await prisma.companySettings.create({
    data: {
      tenantId: tenant.id,
      companyName: "Default Company",
    }
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      status: SubscriptionStatus.TRIAL,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }
  });
}
