import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntityType } from "@/generated/prisma/client";

export async function writeAuditLog(input: {
  actorUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.beforeJson === undefined ? undefined : (input.beforeJson as any),
      afterJson: input.afterJson === undefined ? undefined : (input.afterJson as any),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
