import Link from "next/link";

import { getTaxReminderInvoices, markPphPaid } from "@/actions/invoice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/enums";

import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaxReminderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const { error } = await searchParams;
  const invoices = await getTaxReminderInvoices();
  const message = error === "invalid" ? "Input tidak valid." : null;

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <div>
          <CardTitle>Tax Reminder</CardTitle>
          <CardDescription>
            Invoices where PPh Final 0.5% is not deducted by client.
          </CardDescription>
        </div>
      </CardHeader>

      {message ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {invoices.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium">
            Ada {invoices.length} invoice yang sudah PAID tapi Bukti Potong (PPh) belum dilaporkan.
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Tax (0.5%)</TableHead>
            <TableHead>Paid At</TableHead>
            <TableHead className="w-[220px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-medium">
                <Link className="hover:underline" href={`/invoices/${inv.id}`}>
                  {inv.invoiceNumber}
                </Link>
              </TableCell>
              <TableCell>{inv.client.companyName ?? inv.client.name}</TableCell>
              <TableCell>{formatIDR(inv.taxPphFinal.toString())}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="success">INVOICE PAID</Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDateID(inv.paidAt)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/invoices/${inv.id}`}>
                    <Button variant="outline">Open</Button>
                  </Link>
                  <form action={markPphPaid}>
                    <input type="hidden" name="invoiceId" value={inv.id} />
                    <Button type="submit">Mark PPh Paid</Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                Nothing to pay right now.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

