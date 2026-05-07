import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addInvoiceAttachment,
  addInvoicePayment,
  approveInvoice,
  deleteInvoice,
  deleteInvoiceAttachment,
  deleteInvoicePayment,
  getInvoiceById,
  markInvoiceSent,
  markPphPaid,
  setInvoiceStatus,
  updateInvoicePresentation,
} from "@/actions/invoice";
import { sendInvoiceEmail, sendReceiptEmail } from "@/actions/email";
import { addInvoiceFollowUp } from "@/actions/collection";
import { getCompanySettingsByTenantId } from "@/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateID, formatIDR, formatWhatsAppPhone } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { InvoiceApprovalStatus, InvoiceStatus, InvoiceTemplate, PaymentMethod, UserRole, TaxMethod } from "@prisma/client";
import { AddPaymentForm } from "./add-payment-form";
import { MessageCircle } from "lucide-react";
import { ArrowUpRight, Receipt, Wallet, Landmark, Bell, TrendingUp, TrendingDown, CircleDollarSign, Briefcase, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ error?: string; email?: string; msg?: string }>;
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  const { invoiceId } = await params;
  const { error, email, msg } = await searchParams;
  const invoice = await getInvoiceById(invoiceId);

  if (!invoice) notFound();

  const settings = await getCompanySettingsByTenantId(invoice.tenantId);
  const activeBanks = settings.bankAccounts.filter((b) => b.isActive);
  const selectedBanks =
    invoice.bankAccounts.length > 0
      ? invoice.bankAccounts.map((x) => x.bankAccount)
      : activeBanks;
  const selectedBankIds = new Set(invoice.bankAccounts.map((x) => x.bankAccountId));
  const canFinance = user.role === UserRole.ADMIN || user.role === UserRole.FINANCE;
  const canDelete = user.role === UserRole.ADMIN;
  const canApprove = user.role === UserRole.ADMIN && invoice.approvalStatus === InvoiceApprovalStatus.DRAFT;
  const canSend = canFinance && invoice.approvalStatus === InvoiceApprovalStatus.APPROVED;
  const canMarkPaid = canFinance && invoice.approvalStatus !== InvoiceApprovalStatus.DRAFT;

  const statusBadge =
    invoice.status === InvoiceStatus.PAID ? (
      <Badge variant="success">PAID</Badge>
    ) : (
      <Badge variant="warning">UNPAID</Badge>
    );

  const approvalBadge =
    invoice.approvalStatus === InvoiceApprovalStatus.DRAFT ? (
      <Badge variant="warning">DRAFT</Badge>
    ) : invoice.approvalStatus === InvoiceApprovalStatus.APPROVED ? (
      <Badge variant="secondary">APPROVED</Badge>
    ) : (
      <Badge variant="success">SENT</Badge>
    );

  const amountBruto = Number(invoice.amountBruto.toString());
  const ppnAmount = Number(invoice.taxPpnAmount.toString());
  const pphAmount = Number(invoice.taxPphAmount.toString());
  const otherAmount = Number(invoice.taxOtherAmount.toString());
  const isInclusive = invoice.taxMethod === TaxMethod.INCLUSIVE;

  let dpp = amountBruto + pphAmount - ppnAmount - otherAmount;
  if (isInclusive) {
    // If inclusive, dpp was calculated as: dpp = items_total / (1 + PPN_rate/100)
    // and amountBruto was dpp + taxPpnAmount + taxOtherAmount - taxPphAmount
    // This is getting complicated to reverse engineer accurately without items.
    // Let's use the stored amounts.
    dpp = amountBruto + pphAmount - ppnAmount - otherAmount;
  }

  const totalPaid = invoice.payments.reduce(
    (acc, p) => acc + Number(p.amount.toString()),
    0,
  );
  const remaining = Math.max(0, amountBruto - totalPaid);

  const waPhone = formatWhatsAppPhone(invoice.client.phone);
  
  const waInvoiceMessage = encodeURIComponent(
    `Halo *${invoice.client.name}*,\n\n` +
    `Berikut kami kirimkan invoice *${invoice.invoiceNumber}* untuk project *${invoice.project?.name ?? "Services"}*.\n\n` +
    `Total: *${formatIDR(invoice.amountBruto.toString())}*\n` +
    `Jatuh Tempo: *${formatDateID(invoice.dueDate)}*\n\n` +
    `Terima kasih.`
  );

  const waReceiptMessage = encodeURIComponent(
    `Halo *${invoice.client.name}*,\n\n` +
    `Terima kasih atas pembayarannya untuk invoice *${invoice.invoiceNumber}*.\n\n` +
    `Pembayaran sebesar *${formatIDR(invoice.amountBruto.toString())}* telah kami terima dengan status *LUNAS*.\n\n` +
    `Terima kasih.`
  );

  const errorMessage =
    error === "invalid"
      ? "Input tidak valid. Silakan cek lagi."
      : error === "attachment_missing"
        ? "Pilih file atau isi URL untuk lampiran."
        : error === "not_approved"
          ? "Invoice masih DRAFT. Approve dulu sebelum kirim / catat pembayaran."
          : error === "email_failed"
      ? `Gagal meng-queue email: ${msg ?? "Pastikan client punya email dan SMTP sudah dikonfigurasi."}`
      : null;

  const infoMessage = email === "queued" ? "Email berhasil di-queue untuk dikirim." : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {invoice.invoiceNumber}
            </h1>
            {statusBadge}
            {approvalBadge}
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.client.companyName ?? invoice.client.name} • {invoice.type}
            {invoice.project ? (
              <>
                {" "}
                •{" "}
                <Link className="underline" href={`/projects/${invoice.project.id}`}>
                  {invoice.project.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href={`/invoices/${invoice.id}/print`}>
            <Button variant="outline">Print</Button>
          </Link>
          {invoice.status === InvoiceStatus.PAID && (
            <>
              <Link href={`/invoices/${invoice.id}/receipt`}>
                <Button variant="outline">Kwitansi</Button>
              </Link>
              {canFinance && (
                <form action={sendReceiptEmail}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Button type="submit" variant="outline" disabled={!invoice.client.email}>
                    Kirim Kwitansi
                  </Button>
                </form>
              )}
            </>
          )}
          {canApprove ? (
            <form action={approveInvoice}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <Button type="submit" variant="outline">
                Approve
              </Button>
            </form>
          ) : null}
          {canSend ? (
            <form action={markInvoiceSent}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <Button type="submit" variant="outline">
                Mark Sent
              </Button>
            </form>
          ) : null}
          {canFinance ? (
            <form action={setInvoiceStatus}>
              <input type="hidden" name="id" value={invoice.id} />
              <input
                type="hidden"
                name="status"
                value={
                  invoice.status === InvoiceStatus.PAID
                    ? InvoiceStatus.UNPAID
                    : InvoiceStatus.PAID
                }
              />
              <Button type="submit" disabled={!canMarkPaid && invoice.status !== InvoiceStatus.PAID}>
                {invoice.status === InvoiceStatus.PAID ? "Mark Unpaid" : canMarkPaid ? "Mark Paid" : "Mark Paid (Need approval)"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {errorMessage}
        </div>
      ) : null}
      {infoMessage ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {infoMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border text-left font-medium">
                  <tr>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.length > 0 ? (
                    invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-right">{item.quantity.toString()}</td>
                        <td className="px-4 py-2 text-right">{formatIDR(item.price.toString())}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatIDR(item.amount.toString())}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-2">{invoice.project?.name ?? "Services"}</td>
                      <td className="px-4 py-2 text-right">1</td>
                      <td className="px-4 py-2 text-right">{formatIDR(dpp)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatIDR(dpp)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <div className="text-xs text-muted-foreground uppercase font-bold">Subtotal (DPP)</div>
                <div className="mt-1 text-lg font-semibold">{formatIDR(dpp)}</div>
              </div>
              <div className="rounded-lg border border-border p-4 bg-blue-50/30">
                <div className="text-xs text-blue-700 uppercase font-bold">PPN ({invoice.taxPpnRate.toString()}%)</div>
                <div className="mt-1 text-lg font-semibold text-blue-900">{formatIDR(ppnAmount)}</div>
              </div>
              <div className="rounded-lg border border-border p-4 bg-rose-50/30">
                <div className="text-xs text-rose-700 uppercase font-bold">{invoice.taxPphType || 'Potongan PPh'} ({invoice.taxPphRate.toString()}%)</div>
                <div className="mt-1 text-lg font-semibold text-rose-900">({formatIDR(pphAmount)})</div>
              </div>
              <div className="rounded-lg border border-border p-4 bg-primary/10">
                <div className="text-xs text-primary uppercase font-bold font-mono">Total Bayar</div>
                <div className="mt-1 text-lg font-bold text-primary">{formatIDR(amountBruto)}</div>
              </div>
            </div>

            {otherAmount > 0 && (
              <div className="rounded-lg border border-border p-4 bg-amber-50/30">
                <div className="text-xs text-amber-700 uppercase font-bold">{invoice.taxOtherLabel || 'Pajak Lainnya'} ({invoice.taxOtherRate.toString()}%)</div>
                <div className="mt-1 text-lg font-semibold text-amber-900">{formatIDR(otherAmount)}</div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">Total Paid</div>
                <div className="mt-1 text-lg font-semibold">{formatIDR(totalPaid)}</div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">Remaining</div>
                <div className="mt-1 text-lg font-semibold">{formatIDR(remaining)}</div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">Due Date</div>
                <div className="mt-1 text-sm font-medium">{formatDateID(invoice.dueDate)}</div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">Paid At</div>
                <div className="mt-1 text-sm font-medium">{formatDateID(invoice.paidAt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank Transfer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {selectedBanks.map((b) => (
              <div key={b.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{b.label}</div>
                  {b.isActive ? <Badge variant="success">ACTIVE</Badge> : <Badge variant="muted">INACTIVE</Badge>}
                </div>
                <div className="text-muted-foreground">{b.accountName}</div>
                <div className="mt-1 font-mono text-xs">{b.accountNumber}</div>
              </div>
            ))}
            {selectedBanks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No active bank accounts. Configure in{" "}
                <Link className="underline" href="/settings">
                  Settings
                </Link>
                .
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canFinance ? (
              <form action={updateInvoicePresentation} className="grid gap-4 rounded-xl border border-border p-4">
                <input type="hidden" name="invoiceId" value={invoice.id} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="template">Template</Label>
                    <select
                      id="template"
                      name="template"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue={invoice.template}
                    >
                      <option value={InvoiceTemplate.DEFAULT}>DEFAULT</option>
                      <option value={InvoiceTemplate.MODERN}>MODERN</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="poReference">PO / Reference</Label>
                    <Input id="poReference" name="poReference" defaultValue={invoice.poReference ?? ""} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="terms">Terms</Label>
                  <Textarea id="terms" name="terms" defaultValue={invoice.terms ?? ""} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="footer">Footer</Label>
                  <Textarea id="footer" name="footer" defaultValue={invoice.footer ?? ""} />
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-semibold">Bank Accounts</div>
                  <div className="grid gap-2">
                    {activeBanks.map((b) => (
                      <label key={b.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                        <input
                          type="checkbox"
                          name="bankAccountIds"
                          value={b.id}
                          defaultChecked={selectedBankIds.size === 0 ? true : selectedBankIds.has(b.id)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <div className="min-w-0">
                          <div className="text-foreground">{b.label}</div>
                          <div className="text-xs text-muted-foreground">{b.accountName}</div>
                          <div className="font-mono text-xs text-muted-foreground">{b.accountNumber}</div>
                        </div>
                      </label>
                    ))}
                    {activeBanks.length === 0 ? (
                      <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                        No active bank accounts. Configure in Settings.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="outline">
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Only FINANCE/ADMIN can edit template.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Email</h3>
              <div className="text-sm text-muted-foreground">
                Client email: {invoice.client.email ?? "-"}
              </div>
              {canFinance ? (
                <div className="flex flex-col gap-2">
                  <form action={sendInvoiceEmail}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <Button type="submit" variant="outline" className="w-full" disabled={!invoice.client.email}>
                      Send Invoice Email
                    </Button>
                  </form>
                  {invoice.status === InvoiceStatus.PAID && (
                    <form action={sendReceiptEmail}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <Button type="submit" variant="outline" className="w-full" disabled={!invoice.client.email}>
                        Send Receipt Email (Kwitansi)
                      </Button>
                    </form>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-medium">WhatsApp</h3>
              <div className="text-sm text-muted-foreground">
                Client phone: {invoice.client.phone ?? "-"}
              </div>
              {waPhone ? (
                <div className="flex flex-col gap-2">
                  <a 
                    href={`https://wa.me/${waPhone}?text=${waInvoiceMessage}`} 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    <Button variant="outline" className="w-full border-green-200 hover:bg-green-50 hover:text-green-700">
                      <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                      Send Invoice via WA
                    </Button>
                  </a>
                  {invoice.status === InvoiceStatus.PAID && (
                    <a 
                      href={`https://wa.me/${waPhone}?text=${waReceiptMessage}`} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      <Button variant="outline" className="w-full border-green-200 hover:bg-green-50 hover:text-green-700">
                        <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                        Send Receipt via WA
                      </Button>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                  Nomor WhatsApp tidak tersedia. Silakan lengkapi data client.
                </p>
              )}
            </div>

            <div className="grid gap-2 pt-4 border-t border-border">
              <h3 className="text-sm font-medium">Activity</h3>
              {invoice.emails.map((e) => (
                <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{e.type}</div>
                    <Badge variant={e.status === "SENT" ? "success" : e.status === "FAILED" ? "danger" : "secondary"}>
                      {e.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    To: {e.toEmail} • Attempts: {e.attempts} • Scheduled: {formatDateID(e.scheduledAt)}
                  </div>
                  {e.sentAt ? (
                    <div className="mt-1 text-xs text-muted-foreground">Sent: {formatDateID(e.sentAt)}</div>
                  ) : null}
                  {e.lastError ? (
                    <div className="mt-2 rounded-md border border-border bg-muted p-2 text-xs">
                      {e.lastError}
                    </div>
                  ) : null}
                </div>
              ))}
              {invoice.emails.length === 0 ? (
                <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                  No email activity yet.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PPh Final 0.5%</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-1">
                {invoice.pphPaidAt ? <Badge variant="success">PAID</Badge> : <Badge variant="warning">UNPAID</Badge>}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4 sm:col-span-2">
              <div className="text-xs text-muted-foreground">Proof</div>
              <div className="mt-1 text-sm">
                {invoice.pphAttachmentUrl ? (
                  <a className="underline" href={invoice.pphAttachmentUrl} target="_blank" rel="noreferrer">
                    Open attachment
                  </a>
                ) : (
                  <span className="text-muted-foreground">No attachment.</span>
                )}
              </div>
            </div>
          </div>

          {canFinance ? (
            <form
              action={markPphPaid}
              className="grid gap-4 rounded-xl border border-border p-4"
            >
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="pphPaidAt">Paid At</Label>
                  <Input id="pphPaidAt" name="pphPaidAt" type="date" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pphNtpn">NTPN (optional)</Label>
                  <Input id="pphNtpn" name="pphNtpn" placeholder="..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pphBillingId">ID Billing (optional)</Label>
                  <Input id="pphBillingId" name="pphBillingId" placeholder="..." />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor="pphAttachmentFile">Upload Proof (optional)</Label>
                  <Input id="pphAttachmentFile" name="pphAttachmentFile" type="file" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="pphAttachmentUrl">Proof URL (optional)</Label>
                  <Input id="pphAttachmentUrl" name="pphAttachmentUrl" type="url" placeholder="https://..." />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="outline">
                  Mark PPh Paid
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addInvoiceAttachment} className="grid gap-4 rounded-xl border border-border p-4">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor="label">Label</Label>
                <Input id="label" name="label" placeholder="PO / Contract / Proof" required />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="file">Upload File (optional)</Label>
                <Input id="file" name="file" type="file" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL (optional)</Label>
              <Input id="url" name="url" type="url" placeholder="https://..." />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline">
                Add Attachment
              </Button>
            </div>
          </form>

          <div className="grid gap-2">
            {invoice.attachments.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.label}</div>
                  <a className="text-sm text-muted-foreground underline" href={a.url} target="_blank" rel="noreferrer">
                    {a.url}
                  </a>
                </div>
                <form action={deleteInvoiceAttachment}>
                  <input type="hidden" name="attachmentId" value={a.id} />
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Button variant="destructive" type="submit">
                    Delete
                  </Button>
                </form>
              </div>
            ))}
            {invoice.attachments.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                No attachments.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canFinance && invoice.approvalStatus !== InvoiceApprovalStatus.DRAFT ? (
            <AddPaymentForm invoiceId={invoice.id} remaining={remaining} />
          ) : null}

          <div className="grid gap-2">
            {invoice.payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{formatIDR(p.amount.toString())}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.method} • {formatDateID(p.paidAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/invoices/${invoice.id}/payments/${p.id}/receipt`}>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      <FileText className="h-3 w-3" />
                      Kwitansi
                    </Button>
                  </Link>
                  {canFinance ? (
                    <form action={deleteInvoicePayment}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <Button variant="destructive" size="sm" className="h-8" type="submit">
                        Delete
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            {invoice.payments.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                No payments recorded.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collection Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canFinance ? (
            <form action={addInvoiceFollowUp} className="grid gap-4 rounded-xl border border-border p-4">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <div className="grid gap-2">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" placeholder="Contoh: follow up via WA / email, janji bayar..." required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nextFollowUpAt">Next Follow-up Date (optional)</Label>
                <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline">
                  Add Follow-up
                </Button>
              </div>
            </form>
          ) : null}

          <div className="grid gap-2">
            {invoice.followUps.map((f) => (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.note}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {f.createdByUser ? `${f.createdByUser.name} (${f.createdByUser.email})` : "-"} • {formatDateID(f.createdAt)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Next: {f.nextFollowUpAt ? formatDateID(f.nextFollowUpAt) : "-"}
                  </div>
                </div>
              </div>
            ))}
            {invoice.followUps.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Belum ada catatan follow-up.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canDelete ? (
        <div className="flex justify-end">
          <form action={deleteInvoice}>
            <input type="hidden" name="id" value={invoice.id} />
            <Button variant="destructive" type="submit">
              Delete Invoice
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

