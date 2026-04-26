import Link from "next/link";

import { getInvoicesPaged, setInvoiceStatus } from "@/actions/invoice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { InvoiceApprovalStatus, InvoiceStatus, UserRole } from "@/generated/prisma/enums";
import { InvoiceListClient } from "@/components/invoice-list-client";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  const { q, page } = await searchParams;
  const pageNumber = page ? Number(page) : 1;
  const result = await getInvoicesPaged({ q, page: Number.isFinite(pageNumber) ? pageNumber : 1 });
  const invoices = result.items;
  const canFinance = user.role === UserRole.ADMIN || user.role === UserRole.FINANCE;

  // Sanitize data for Client Component (InvoiceListClient)
  // Next.js cannot pass Decimal or Date objects to Client Components directly if they are inside complex objects
  const sanitizedInvoices = invoices.map((inv) => ({
    ...inv,
    amountBruto: inv.amountBruto.toString(),
    taxPphFinal: inv.taxPphFinal.toString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    approvedAt: inv.approvedAt ? inv.approvedAt.toISOString() : null,
    sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    nextFollowUpAt: inv.nextFollowUpAt ? inv.nextFollowUpAt.toISOString() : null,
    pphPaidAt: inv.pphPaidAt ? inv.pphPaidAt.toISOString() : null,
    client: inv.client ? {
      ...inv.client,
      createdAt: inv.client.createdAt.toISOString(),
      updatedAt: inv.client.updatedAt.toISOString(),
    } : null,
    project: inv.project ? {
      ...inv.project,
      totalValue: inv.project.totalValue.toString(),
      createdAt: inv.project.createdAt.toISOString(),
      updatedAt: inv.project.updatedAt.toISOString(),
    } : null,
  }));

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    return `/invoices?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Generate invoices and track payments.</CardDescription>
          </div>
          <div className="flex gap-2">
            {canFinance ? (
              <>
                <a href="/api/export/invoices">
                  <Button variant="outline">Export CSV</Button>
                </a>
                <Link href="/invoices/new">
                  <Button>Create Invoice</Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          placeholder="Search invoice number, client, project..."
          defaultValue={q ?? ""}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <InvoiceListClient invoices={sanitizedInvoices} userRole={user.role} />

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Page {result.page} of {result.pageCount} • {result.total} invoice(s)
        </div>
        <div className="flex gap-2">
          <Link href={buildHref(Math.max(1, result.page - 1))}>
            <Button variant="outline" disabled={result.page <= 1}>
              Prev
            </Button>
          </Link>
          <Link href={buildHref(Math.min(result.pageCount, result.page + 1))}>
            <Button variant="outline" disabled={result.page >= result.pageCount}>
              Next
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

