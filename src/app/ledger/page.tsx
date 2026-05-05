import Link from "next/link";

import { backfillLedgerFromPayments, getLedgerSummary } from "@/actions/ledger";
import { deleteExpenseAction } from "@/actions/expense";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireUser, requireSubscription } from "@/lib/auth";
import { formatDateID, formatIDR } from "@/lib/format";
import { LedgerEntryType, PaymentMethod, UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; error?: string; created?: string; deleted?: string; backfilled?: string }>;
}) {
  await requireSubscription();
  const user = await requireUser();
  const canFinance = user.role === UserRole.ADMIN || user.role === UserRole.FINANCE;
  if (!canFinance) return null;

  const { from, to, error, created, deleted, backfilled } = await searchParams;
  const data = await getLedgerSummary({ from, to });

  const message =
    error === "invalid"
      ? "Input tidak valid."
      : created === "1"
        ? "Expense berhasil dibuat."
        : deleted === "1"
          ? "Expense berhasil dihapus."
          : backfilled === "1"
            ? "Backfill ledger selesai."
            : null;

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const exportHref = `/api/export/ledger${qs.toString() ? `?${qs.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400">Ledger</h1>
          <p className="text-sm text-muted-foreground">Cashflow sederhana (income dari payment + expense manual) dan export jurnal.</p>
        </div>
        <Link href="/" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full">Back</Button>
        </Link>
      </div>

      {message ? <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income</CardTitle>
            <CardDescription>Range terpilih</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatIDR(data.income)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense</CardTitle>
            <CardDescription>Range terpilih</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatIDR(data.expense)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Net</CardTitle>
            <CardDescription>Income - Expense</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatIDR(data.net)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <CardTitle className="text-base">Filter & Management</CardTitle>
              <CardDescription>Filter range tanggal, export CSV, atau kelola pengeluaran.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/expenses" className="flex-1 sm:flex-none">
                <Button variant="outline" className="w-full">Manage Expenses</Button>
              </Link>
              <Link href={exportHref} className="flex-1 sm:flex-none">
                <Button variant="outline" className="w-full">Export CSV</Button>
              </Link>
              {user.role === UserRole.ADMIN ? (
                <form action={backfillLedgerFromPayments} className="w-full sm:w-auto">
                  <Button variant="outline" type="submit" className="w-full">
                    Backfill Payments
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit" variant="outline">
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest Entries</CardTitle>
          <CardDescription>Menampilkan maksimal 200 entry terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right min-w-[120px]">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDateID(e.occurredAt)}</TableCell>
                    <TableCell>
                      {e.type === LedgerEntryType.INCOME ? <Badge variant="success">INCOME</Badge> : <Badge variant="danger">EXPENSE</Badge>}
                    </TableCell>
                    <TableCell className="max-w-[520px]">
                      <div className="text-sm">{e.description}</div>
                      {e.invoice ? (
                        <div className="text-xs text-muted-foreground">
                          {e.invoice.invoiceNumber} • {e.invoice.client.companyName ?? e.invoice.client.name}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{e.account}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatIDR(e.amount.toString())}</TableCell>
                    <TableCell className="text-right">
                      {e.expenseId ? (
                        <form action={deleteExpenseAction}>
                          <input type="hidden" name="id" value={e.expenseId} />
                          <Button variant="destructive" size="sm" type="submit">
                            Delete
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No entries yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

