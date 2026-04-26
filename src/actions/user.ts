"use server";

import { prisma } from "@/lib/prisma";
import { createPasswordHash, getRequestMeta, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      isActive: true,
      passwordHash: createPasswordHash(parsed.data.password),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
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

  const before = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  const after = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
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

  const before = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  const after = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { isActive: parsed.data.isActive },
  });

  if (!parsed.data.isActive) {
    await prisma.session.deleteMany({ where: { userId: parsed.data.userId } });
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
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

  const before = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  const after = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash: createPasswordHash(parsed.data.password) },
  });

  await prisma.session.deleteMany({ where: { userId: parsed.data.userId } });

  const meta = await getRequestMeta();
  await writeAuditLog({
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
  await requireRole([UserRole.ADMIN]);
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });
}
