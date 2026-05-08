"use server";

import { prisma } from "@/lib/prisma";
import { createPasswordHash, getRequestMeta, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

const createUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  role: z.nativeEnum(UserRole),
  password: z.string().min(6),
});

export async function createUser(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/users?error=invalid");

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) redirect("/users?error=duplicate");

  const created = await prisma.user.create({
    data: {
      tenantId: actor.tenantId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      isActive: true,
      passwordHash: createPasswordHash(parsed.data.password),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.USER,
    entityId: created.id,
    afterJson: { email: created.email, role: created.role, isActive: created.isActive },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/users");
  redirect("/users?created=1");
}

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(UserRole),
});

export async function updateUserRole(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = updateRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/users?error=invalid");

  const before = await prisma.user.findFirst({ where: { id: parsed.data.userId, tenantId: actor.tenantId } });
  if (!before) redirect("/users?error=not_found");

  const after = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.USER,
    entityId: after.id,
    beforeJson: before ?? undefined,
    afterJson: { role: after.role },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/users");
  redirect("/users?updated=1");
}

const toggleActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function setUserActive(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = toggleActiveSchema.safeParse({
    userId: formData.get("userId"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) redirect("/users?error=invalid");

  const before = await prisma.user.findFirst({ where: { id: parsed.data.userId, tenantId: actor.tenantId } });
  if (!before) redirect("/users?error=not_found");

  const after = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { isActive: parsed.data.isActive },
  });

  if (!parsed.data.isActive) {
    await prisma.session.deleteMany({ where: { userId: parsed.data.userId } });
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.USER,
    entityId: after.id,
    beforeJson: before ?? undefined,
    afterJson: { isActive: after.isActive },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/users");
  redirect("/users?updated=1");
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6),
});

export async function resetUserPassword(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/users?error=invalid");

  const before = await prisma.user.findFirst({ where: { id: parsed.data.userId, tenantId: actor.tenantId } });
  if (!before) redirect("/users?error=not_found");

  const after = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash: createPasswordHash(parsed.data.password) },
  });

  await prisma.session.deleteMany({ where: { userId: parsed.data.userId } });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.USER,
    entityId: after.id,
    beforeJson: before ? { id: before.id, email: before.email } : undefined,
    afterJson: { passwordReset: true },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/users");
  redirect("/users?updated=1");
}

export async function listUsers() {
  const actor = await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  return prisma.user.findMany({
    where: { tenantId: actor.tenantId },
    orderBy: { createdAt: "desc" },
  });
}

const inviteUserSchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(UserRole),
});

export async function inviteUser(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) redirect("/users?error=invalid");

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existingUser) redirect("/users?error=already_user");

  // Create or update invitation
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const invitation = await prisma.userInvitation.upsert({
    where: {
      tenantId_email: {
        tenantId: actor.tenantId,
        email: parsed.data.email,
      },
    },
    update: {
      role: parsed.data.role,
      token,
      expiresAt,
    },
    create: {
      tenantId: actor.tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      expiresAt,
    },
    include: { tenant: true },
  });

  // Send invitation email
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/register/invite/${token}`;

  await sendEmail({
    to: parsed.data.email,
    subject: `Undangan Bergabung di ${invitation.tenant.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2563eb;">Halo!</h2>
        <p>Anda telah diundang untuk bergabung dengan tim <b>${invitation.tenant.name}</b> di Sistem Invoice SDC dengan peran sebagai <b>${parsed.data.role}</b>.</p>
        
        <p>Silakan klik tombol di bawah ini untuk menyelesaikan pendaftaran Anda:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Terima Undangan</a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">Link ini akan kadaluarsa dalam 7 hari.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Solusi Invoice</p>
      </div>
    `,
  });

  revalidatePath("/users");
  redirect("/users?invited=1");
}

export async function revokeInvitation(invitationId: string) {
  const actor = await requireRole([UserRole.ADMIN]);
  await prisma.userInvitation.delete({
    where: { id: invitationId, tenantId: actor.tenantId },
  });
  revalidatePath("/users");
}

export async function listInvitations() {
  const actor = await requireRole([UserRole.ADMIN]);
  return prisma.userInvitation.findMany({
    where: { tenantId: actor.tenantId },
    orderBy: { createdAt: "desc" },
  });
}
