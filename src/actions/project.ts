"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole, requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  AuditAction,
  AuditEntityType,
  Prisma,
  ProjectStatus,
  UserRole,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().or(z.literal("")),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.LEAD),
  totalValue: z
    .string()
    .transform((v) => v.replaceAll(",", ".").trim())
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0),
});

function emptyToNull(value: string | undefined) {
  if (!value || value === "") return null;
  return value;
}

export async function createProject(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const parsed = projectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    description: formData.get("description"),
    status: formData.get("status"),
    totalValue: formData.get("totalValue"),
  });

  if (!parsed.success) redirect("/projects/new?error=invalid");

  const totalValue = new Prisma.Decimal(parsed.data.totalValue);

  const created = await prisma.project.create({
    data: {
      tenantId: actor.tenantId,
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      status: parsed.data.status,
      totalValue,
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.PROJECT,
    entityId: created.id,
    afterJson: created,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

export async function updateProject(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const id = z.string().min(1).parse(formData.get("id"));
  const before = await prisma.project.findUnique({ where: { id } });
  const parsed = projectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    description: formData.get("description"),
    status: formData.get("status"),
    totalValue: formData.get("totalValue"),
  });

  if (!parsed.success) redirect(`/projects/${id}/edit?error=invalid`);

  const totalValue = new Prisma.Decimal(parsed.data.totalValue);

  const after = await prisma.project.update({
    where: { id },
    data: {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      status: parsed.data.status,
      totalValue,
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.PROJECT,
    entityId: id,
    beforeJson: before ?? undefined,
    afterJson: after,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.project.findUnique({ where: { id } });
  await prisma.project.delete({ where: { id } });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.DELETE,
    entityType: AuditEntityType.PROJECT,
    entityId: id,
    beforeJson: before ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function getProjects() {
  const user = await requireUser();
  return prisma.project.findMany({
    where: { tenantId: user.tenantId },
    include: {
      client: true,
      _count: { select: { invoices: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
}
