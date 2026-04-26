import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntityType } from "@/generated/prisma/client";

export async function writeAuditLog(input: {
  actorUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  beforeJson?: any;
  afterJson?: any;
  ip?: string;
  userAgent?: string;
}) {
  const beforeJson = input.beforeJson && typeof input.beforeJson !== 'string' 
    ? JSON.stringify(input.beforeJson) 
    : input.beforeJson;
    
  const afterJson = input.afterJson && typeof input.afterJson !== 'string' 
    ? JSON.stringify(input.afterJson) 
    : input.afterJson;

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: beforeJson ?? null,
      afterJson: afterJson ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
