"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { AlertCircle } from "lucide-react";
import {
  bulkApproveInvoices,
  bulkMarkSentInvoices,
  setInvoiceStatus,
} from "@/actions/invoice";
import {
  InvoiceApprovalStatus,
  InvoiceStatus,
  UserRole,
} from "@/generated/prisma/enums";

interface InvoiceListClientProps {
  invoices: any[];
  userRole: UserRole;
}

function statusBadge(status: InvoiceStatus) {
  if (status === InvoiceStatus.PAID) return <Badge variant="success">PAID</Badge>;
  return <Badge variant="warning">UNPAID</Badge>;
}

function approvalBadge(status: InvoiceApprovalStatus) {
  if (status === InvoiceApprovalStatus.DRAFT) return <Badge variant="warning">DRAFT</Badge>;
  if (status === InvoiceApprovalStatus.APPROVED) return <Badge variant="secondary">APPROVED</Badge>;
  return <Badge variant="success">SENT</Badge>;
}

export function InvoiceListClient({ invoices, userRole }: InvoiceListClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map((inv) => inv.id));
    }
  };

  const isAllSelected = selectedIds.length > 0 && selectedIds.length === invoices.length;

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    const formData = new FormData();
    selectedIds.forEach((id) => formData.append("ids", id));
    startTransition(async () => {
      await bulkApproveInvoices(formData);
      setSelectedIds([]);
    });
  };

  const handleBulkSend = () => {
    if (selectedIds.length === 0) return;
    const formData = new FormData();
    selectedIds.forEach((id) => formData.append("ids", id));
    startTransition(async () => {
      await bulkMarkSentInvoices(formData);
      setSelectedIds([]);
    });
  };

  const canApprove = userRole === UserRole.ADMIN;
  const canFinance = userRole === UserRole.ADMIN || userRole === UserRole.FINANCE;

  const selectedInvoices = invoices.filter((inv) => selectedIds.includes(inv.id));
  const hasDrafts = selectedInvoices.some((inv) => inv.approvalStatus === InvoiceApprovalStatus.DRAFT);
  const hasApproved = selectedInvoices.some((inv) => inv.approvalStatus === InvoiceApprovalStatus.APPROVED);

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-border bg-background px-6 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="text-sm font-medium">
            {selectedIds.length} invoice(s) selected
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-2">
            {canApprove && hasDrafts && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkApprove}
                disabled={isPending}
              >
                Approve Selected
              </Button>
            )}
            {canFinance && hasApproved && (
              <Button
                size="sm"
                onClick={handleBulkSend}
                disabled={isPending}
              >
                Send Reminders
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              disabled={isPending}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox checked={isAllSelected} onChange={toggleSelectAll} />
            </TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Tax (0.5%)</TableHead>
            <TableHead>Deducted</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[240px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow
              key={inv.id}
              className={selectedIds.includes(inv.id) ? "bg-muted/50" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(inv.id)}
                  onChange={() => toggleSelect(inv.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                <Link className="hover:underline" href={`/invoices/${inv.id}`}>
                  {inv.invoiceNumber}
                </Link>
              </TableCell>
              <TableCell>{inv.client.companyName ?? inv.client.name}</TableCell>
              <TableCell>{inv.type}</TableCell>
              <TableCell>{formatIDR(inv.amountBruto.toString())}</TableCell>
              <TableCell>{formatIDR(inv.taxPphFinal.toString())}</TableCell>
              <TableCell>{inv.isDeductedByClient ? "Yes" : "No"}</TableCell>
              <TableCell>{formatDateID(inv.dueDate)}</TableCell>
              <TableCell>{approvalBadge(inv.approvalStatus)}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {statusBadge(inv.status)}
                  {inv.status === InvoiceStatus.PAID &&
                    !inv.isDeductedByClient &&
                    !inv.pphPaidAt && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        PPh Missing
                      </div>
                    )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/invoices/${inv.id}`}>
                    <Button variant="outline">View</Button>
                  </Link>
                  {canFinance ? (
                    <form action={setInvoiceStatus}>
                      <input type="hidden" name="id" value={inv.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={
                          inv.status === InvoiceStatus.PAID
                            ? InvoiceStatus.UNPAID
                            : InvoiceStatus.PAID
                        }
                      />
                      <Button
                        type="submit"
                        variant={
                          inv.status === InvoiceStatus.PAID
                            ? "secondary"
                            : "default"
                        }
                        disabled={
                          inv.status !== InvoiceStatus.PAID &&
                          inv.approvalStatus === InvoiceApprovalStatus.DRAFT
                        }
                      >
                        {inv.status === InvoiceStatus.PAID
                          ? "Mark Unpaid"
                          : "Mark Paid"}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="text-center text-sm text-muted-foreground"
              >
                No invoices yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </>
  );
}
