import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateID } from "@/lib/format";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ auditLogId: string }>;
}) {
  const actor = await requireRole([UserRole.ADMIN]);
  const { auditLogId } = await params;

  const log = await prisma.auditLog.findFirst({
    where: { id: auditLogId, tenantId: actor.tenantId },
    include: { actorUser: true },
  });
  if (!log) notFound();

  const stringify = (value: unknown) =>
    value === null || value === undefined ? "-" : JSON.stringify(value, null, 2);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Detail</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {formatDateID(log.createdAt)}
          </div>
        </div>
        <Link href="/audit-log">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{log.action}</Badge>
            <Badge variant="muted">{log.entityType}</Badge>
            {log.entityId ? <Badge variant="outline">{log.entityId}</Badge> : null}
          </div>
          <div className="text-muted-foreground">
            Actor: {log.actorUser ? `${log.actorUser.name} (${log.actorUser.email})` : "-"}
          </div>
          <div className="text-muted-foreground">IP: {log.ip ?? "-"}</div>
          <div className="text-muted-foreground">User Agent: {log.userAgent ?? "-"}</div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Before</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[520px] overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
              {stringify(log.beforeJson)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">After</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[520px] overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
              {stringify(log.afterJson)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

