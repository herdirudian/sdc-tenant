"use server";

import { enqueueInvoiceEmail, enqueueReceiptEmail, processEmailOutbox } from "@/lib/email-outbox";
import { getRequestMeta, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, EmailMessageType, UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const sendSchema = z.object({
  invoiceId: z.string().min(1),
});

export async function sendInvoiceEmail(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = sendSchema.safeParse({ invoiceId: formData.get("invoiceId") });
  if (!parsed.success) redirect(`/invoices/${String(formData.get("invoiceId"))}?error=invalid`);

  try {
    await enqueueInvoiceEmail({
      invoiceId: parsed.data.invoiceId,
      type: EmailMessageType.INVOICE_SENT,
      createdByUserId: actor.id,
      dedupeKey: null,
    });

    // Proactively try to process outbox for immediate feedback in manual sends
    // especially useful in environments without a background worker
    processEmailOutbox({ limit: 5 }).catch(err => {
      console.error("Immediate outbox processing failed:", err);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    redirect(`/invoices/${parsed.data.invoiceId}?error=email_failed&msg=${encodeURIComponent(msg)}`);
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: parsed.data.invoiceId,
    afterJson: { email: { type: "INVOICE_SENT", status: "QUEUED" } },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  redirect(`/invoices/${parsed.data.invoiceId}?email=queued`);
}

export async function sendReceiptEmail(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = sendSchema.safeParse({ invoiceId: formData.get("invoiceId") });
  if (!parsed.success) redirect(`/invoices/${String(formData.get("invoiceId"))}?error=invalid`);

  try {
    await enqueueReceiptEmail({
      invoiceId: parsed.data.invoiceId,
      createdByUserId: actor.id,
    });

    processEmailOutbox({ limit: 5 }).catch(err => {
      console.error("Immediate outbox processing failed:", err);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    redirect(`/invoices/${parsed.data.invoiceId}?error=email_failed&msg=${encodeURIComponent(msg)}`);
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: parsed.data.invoiceId,
    afterJson: { email: { type: "RECEIPT_SENT", status: "QUEUED" } },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  redirect(`/invoices/${parsed.data.invoiceId}?email=queued`);
}
