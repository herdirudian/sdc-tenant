"use server";

import { prisma } from "@/lib/prisma";
import {
  createPasswordHash,
  createSession,
  getRequestMeta,
  setSessionCookie,
} from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getGlobalSettings } from "./saas-admin";
import { sendEmail } from "@/lib/email";

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  phone: z.string().min(10, "Nomor HP minimal 10 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  confirmPassword: z.string().min(6, "Konfirmasi password minimal 6 karakter"),
  companyName: z.string().min(2, "Nama perusahaan minimal 2 karakter"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password dan konfirmasi password tidak cocok",
  path: ["confirmPassword"],
});

export async function register(formData: FormData) {
  const globalSettings = await getGlobalSettings();

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    companyName: formData.get("companyName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  const { name, email, phone, password, companyName } = parsed.data;

  // Check if email exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "Email sudah terdaftar" };
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
        },
      });

      // 2. Create User
      const passwordHash = createPasswordHash(password);
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          name,
          phone,
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      // 3. Create Company Settings
      await tx.companySettings.create({
        data: {
          tenantId: tenant.id,
          companyName,
        },
      });

      // 4. Create Subscription (Inactive by default, until trial or payment)
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          status: SubscriptionStatus.INACTIVE,
          expiresAt: new Date(), // Will be updated on activation
        },
      });

      return { user, tenant };
    });

    // 5. Send Welcome Email (Non-blocking)
    try {
      await sendEmail({
        to: email,
        subject: `Selamat Datang di Solusi Invoice - ${companyName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
            <h2 style="color: #2563eb;">Halo, ${name}!</h2>
            <p>Selamat bergabung di <b>Solusi Invoice</b>. Akun perusahaan Anda <b>${companyName}</b> telah berhasil didaftarkan.</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; font-size: 16px;">Langkah Awal Anda:</h3>
              <ul style="padding-left: 20px; margin-bottom: 0;">
                <li>Lengkapi profil & logo perusahaan di menu Settings</li>
                <li>Atur rekening bank untuk menerima pembayaran</li>
                <li>Mulai tambahkan klien dan proyek pertama Anda</li>
              </ul>
            </div>

            <p>Anda mendapatkan akses <b>Trial selama ${globalSettings.trialDays} hari</b> untuk mencoba semua fitur premium kami.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_BASE_URL || 'http://localhost:3000'}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Buka Dashboard Anda</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 14px;">Jika Anda memiliki pertanyaan, silakan hubungi tim support kami.</p>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">Solusi Invoice</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send welcome email:", err);
    }

    // Log the user in
    const session = await createSession(result.user.id);
    await setSessionCookie(session);

    const meta = await getRequestMeta();
    await writeAuditLog({
      tenantId: result.tenant.id,
      actorUserId: result.user.id,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.USER,
      entityId: result.user.id,
      afterJson: { email: result.user.email, companyName },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    revalidatePath("/");
  } catch (error) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: `Terjadi kesalahan saat pendaftaran: ${message}` };
  }

  if (result) {
    redirect("/checkout");
  }
}
