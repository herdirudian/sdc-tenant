import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID } from "@/lib/format";
import { AuditAction, AuditEntityType, UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; entityType?: string }>;
}) {
  await requireRole([UserRole.ADMIN]);
  const { q, action, entityType } = await searchParams;
  const query = q?.trim();

  const actionParsed = action ? AuditAction[action as keyof typeof AuditAction] : undefined;
  const entityTypeParsed = entityType ? AuditEntityType[entityType as keyof typeof AuditEntityType] : undefined;

  const where = {
    ...(actionParsed ? { action: actionParsed } : {}),
    ...(entityTypeParsed ? { entityType: entityTypeParsed } : {}),
    ...(query
      ? {
          OR: [
            { entityId: { contains: query } },
            { actorUser: { email: { contains: query } } },
            { actorUser: { name: { contains: query } } },
          ],
        }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    include: { actorUser: true },
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Latest activity across the system.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <form method="get" className="flex flex-col gap-2 md:flex-row">
        <Input
          name="q"
          placeholder="Search actor email/name or entity id..."
          defaultValue={q ?? ""}
        />
        <select
          name="entityType"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-56"
          defaultValue={entityType ?? ""}
        >
          <option value="">All Entities</option>
          {Object.values(AuditEntityType).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="action"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-56"
          defaultValue={action ?? ""}
        >
          <option value="">All Actions</option>
          {Object.values(AuditAction).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="md:w-28">
          Filter
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Entity ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="text-sm">
                <Link className="hover:underline" href={`/audit-log/${l.id}`}>
                  {formatDateID(l.createdAt)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {l.actorUser ? `${l.actorUser.name} (${l.actorUser.email})` : "-"}
              </TableCell>
              <TableCell className="text-sm">
                <Badge variant="secondary">{l.action}</Badge>
              </TableCell>
              <TableCell className="text-sm">{l.entityType}</TableCell>
              <TableCell className="font-mono text-xs">{l.entityId ?? "-"}</TableCell>
            </TableRow>
          ))}
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No logs yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
