import Link from "next/link";
import { notFound } from "next/navigation";

import { getProjectById } from "@/actions/project";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import { InvoiceStatus, ProjectStatus, UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function statusBadge(status: ProjectStatus) {
  if (status === ProjectStatus.COMPLETED) return <Badge variant="success">COMPLETED</Badge>;
  if (status === ProjectStatus.ONGOING) return <Badge variant="secondary">ONGOING</Badge>;
  return <Badge variant="muted">LEAD</Badge>;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const { projectId } = await params;
  const project = await getProjectById(projectId);
  if (!project) notFound();

  const totalInvoiced = project.invoices.reduce(
    (acc, inv) => acc + Number(inv.amountBruto.toString()),
    0,
  );
  const totalValue = Number(project.totalValue.toString());
  const remaining = Math.max(0, totalValue - totalInvoiced);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            {statusBadge(project.status)}
          </div>
          <p className="text-sm text-muted-foreground">
            {project.client.companyName ?? project.client.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/projects">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href={`/projects/${projectId}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href={`/invoices/new?projectId=${projectId}`}>
            <Button>Create Invoice</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
            {project.description ? (
              <CardDescription>{project.description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground">Total Value</div>
              <div className="mt-1 text-lg font-semibold">{formatIDR(totalValue)}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground">Total Invoiced</div>
              <div className="mt-1 text-lg font-semibold">{formatIDR(totalInvoiced)}</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="mt-1 text-lg font-semibold">{formatIDR(remaining)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-medium">{project.client.name}</div>
            <div className="text-muted-foreground">{project.client.companyName ?? "-"}</div>
            <div className="mt-3 text-muted-foreground">{project.client.email ?? "-"}</div>
            <div className="text-muted-foreground">{project.client.phone ?? "-"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Invoices</div>
            <div className="text-sm text-muted-foreground">Invoices linked to this project.</div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {project.invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">
                  <Link className="hover:underline" href={`/invoices/${inv.id}`}>
                    {inv.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>{inv.type}</TableCell>
                <TableCell>{formatIDR(inv.amountBruto.toString())}</TableCell>
                <TableCell>
                  {inv.status === InvoiceStatus.PAID ? (
                    <Badge variant="success">PAID</Badge>
                  ) : (
                    <Badge variant="warning">UNPAID</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {project.invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No invoices for this project yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
