"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole, requireTenant } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { enqueueInvoiceEmail } from "@/lib/email-outbox";
import {
  AuditAction,
  AuditEntityType,
  EmailMessageType,
  InvoiceApprovalStatus,
  InvoiceStatus,
  InvoiceTemplate,
  InvoiceType,
  LedgerEntryType,
  PaymentMethod,
  Prisma,
  TaxMethod,
  UserRole,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const invoiceSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional().or(z.literal("")),
  type: z.nativeEnum(InvoiceType),
  template: z.nativeEnum(InvoiceTemplate).default(InvoiceTemplate.DEFAULT),
  taxMethod: z.nativeEnum(TaxMethod).default(TaxMethod.EXCLUSIVE),
  taxInvoiceNumber: z.string().trim().optional().or(z.literal("")),
  poReference: z.string().trim().optional().or(z.literal("")),
  terms: z.string().trim().optional().or(z.literal("")),
  footer: z.string().trim().optional().or(z.literal("")),
  bankAccountIds: z.array(z.string()).optional().default([]),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.string().transform((v) => new Prisma.Decimal(v || "1")),
    price: z.string().transform((v) => new Prisma.Decimal(v || "0")),
  })).min(1),
  taxPpnRate: z.string().transform((v) => new Prisma.Decimal(v || "0")),
  taxPphRate: z.string().transform((v) => new Prisma.Decimal(v || "0")),
  taxPphType: z.string().trim().optional().or(z.literal("")),
  taxOtherRate: z.string().transform((v) => new Prisma.Decimal(v || "0")),
  taxOtherLabel: z.string().trim().optional().or(z.literal("")),
  isDeductedByClient: z.boolean().default(false),
  dueDate: z.string().optional().or(z.literal("")),
});

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z
    .string()
    .transform((v) => {
      let cleaned = v.trim();
      // Handle Indonesian standard: 1.000.000,50
      // If it contains dots and ends with a comma-based decimal
      if (cleaned.includes(".") && cleaned.includes(",")) {
        const lastDot = cleaned.lastIndexOf(".");
        const lastComma = cleaned.lastIndexOf(",");
        if (lastComma > lastDot) {
          // Indonesian: 1.000.000,50 -> remove dots, replace comma with dot
          cleaned = cleaned.replaceAll(".", "").replace(",", ".");
        } else {
          // International: 1,000,000.50 (if they used dots as thousands?)
          // actually this is rare, usually it's one or the other
          cleaned = cleaned.replaceAll(",", "");
        }
      } else if (cleaned.includes(",")) {
        // Only comma: 1,5 or 1.000 (if they use comma as thousand)
        // In IDR, if it's 1.000 it's likely a thousand
        if (cleaned.split(",").length > 1 && cleaned.split(",").pop()?.length === 3) {
          cleaned = cleaned.replaceAll(",", "");
        } else {
          cleaned = cleaned.replace(",", ".");
        }
      } else if (cleaned.includes(".")) {
        // Only dot: 1.000 or 1.5
        // If it's likely a thousand separator (e.g. 1.000)
        const parts = cleaned.split(".");
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
          cleaned = cleaned.replaceAll(".", "");
        }
      }
      return cleaned;
    })
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.TRANSFER),
  paidAt: z.string().optional().or(z.literal("")),
  note: z.string().trim().optional().or(z.literal("")),
});

const pphSchema = z.object({
  invoiceId: z.string().min(1),
  pphPaidAt: z.string().optional().or(z.literal("")),
  pphNtpn: z.string().trim().optional().or(z.literal("")),
  pphBillingId: z.string().trim().optional().or(z.literal("")),
  pphAttachmentUrl: z.string().trim().optional().or(z.literal("")),
});

const attachmentSchema = z.object({
  invoiceId: z.string().min(1),
  label: z.string().trim().min(1),
  url: z.string().trim().optional().or(z.literal("")),
});

const approvalSchema = z.object({
  invoiceId: z.string().min(1),
});

const invoicePresentationSchema = z.object({
  invoiceId: z.string().min(1),
  template: z.nativeEnum(InvoiceTemplate),
  poReference: z.string().trim().optional().or(z.literal("")),
  terms: z.string().trim().optional().or(z.literal("")),
  footer: z.string().trim().optional().or(z.literal("")),
  bankAccountIds: z.array(z.string()).optional().default([]),
});

function calcPphFinal(amountBruto: Prisma.Decimal) {
  return amountBruto.mul(new Prisma.Decimal("0.005")).toDecimalPlaces(2);
}

async function savePublicUpload(input: { folder: string; file: File }) {
  if (input.file.size <= 0) throw new Error("Empty file");
  if (input.file.size > 10 * 1024 * 1024) throw new Error("File too large");

  const ext = (() => {
    const lastDot = input.file.name.lastIndexOf(".");
    if (lastDot === -1) return "";
    const raw = input.file.name.slice(lastDot).toLowerCase();
    if (!/^\.[a-z0-9]+$/.test(raw)) return "";
    return raw;
  })();

  const safeFolder = input.folder
    .split(/[\\/]/g)
    .filter((p) => p && p !== "." && p !== "..")
    .join(path.sep);

  const publicDir = path.join(process.cwd(), "public");
  const diskDir = path.join(publicDir, "uploads", safeFolder);
  await mkdir(diskDir, { recursive: true });

  const fileName = `${randomUUID()}${ext}`;
  const diskPath = path.join(diskDir, fileName);
  const buf = Buffer.from(await input.file.arrayBuffer());
  await writeFile(diskPath, buf);

  const urlPath = `/uploads/${safeFolder.split(path.sep).join("/")}/${fileName}`.replaceAll(
    "//",
    "/",
  );
  return urlPath;
}

async function tryDeletePublicFile(url: string) {
  if (!url.startsWith("/uploads/")) return;

  const publicDir = path.join(process.cwd(), "public");
  const diskPath = path.normalize(path.join(publicDir, url));

  const publicDirLower = publicDir.toLowerCase();
  const diskPathLower = diskPath.toLowerCase();
  if (!diskPathLower.startsWith(publicDirLower)) return;

  await unlink(diskPath).catch(() => undefined);
}

async function generateInvoiceNumber(tenantId: string) {
  const year = new Date().getFullYear();
  const prefix = `INV/SDC/${year}/`;

  const latest = await prisma.invoice.findFirst({
    where: { 
      tenantId,
      invoiceNumber: { startsWith: prefix } 
    },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });

  const latestSuffix = latest?.invoiceNumber.slice(prefix.length) ?? "";
  const latestNumber = Number.parseInt(latestSuffix, 10);
  const next = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function createInvoice(formData: FormData) {
  const { tenantId, user: actor } = await requireTenant();
  if (actor.role === UserRole.STAFF) redirect("/invoices?error=forbidden");

  // Extract items from formData
  const itemDescriptions = formData.getAll("itemDescription[]");
  const itemQuantities = formData.getAll("itemQuantity[]");
  const itemPrices = formData.getAll("itemPrice[]");

  const items = itemDescriptions.map((desc, i) => ({
    description: desc.toString(),
    quantity: itemQuantities[i]?.toString() || "1",
    price: itemPrices[i]?.toString() || "0",
  }));

  const parsed = invoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    type: formData.get("type"),
    template: formData.get("template"),
    poReference: formData.get("poReference"),
    terms: formData.get("terms"),
    footer: formData.get("footer"),
    bankAccountIds: formData.getAll("bankAccountIds"),
    items,
    taxPpnRate: formData.get("taxPpnRate"),
    taxPphRate: formData.get("taxPphRate"),
    taxPphType: formData.get("taxPphType"),
    taxOtherRate: formData.get("taxOtherRate"),
    taxOtherLabel: formData.get("taxOtherLabel"),
    taxMethod: formData.get("taxMethod"),
    taxInvoiceNumber: formData.get("taxInvoiceNumber"),
    isDeductedByClient: formData.get("isDeductedByClient") === "on",
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    console.error("Validation error:", parsed.error);
    redirect(`/invoices/new?error=invalid`);
  }

  const itemsWithAmount = parsed.data.items.map(item => ({
    ...item,
    amount: item.quantity.mul(item.price)
  }));

  const amountBruto = itemsWithAmount.reduce((acc, item) => acc.add(item.amount), new Prisma.Decimal(0));
  
  // Tax Calculations
  const taxPpnRate = parsed.data.taxPpnRate;
  const taxPphRate = parsed.data.taxPphRate;
  const taxOtherRate = parsed.data.taxOtherRate;
  const isInclusive = parsed.data.taxMethod === TaxMethod.INCLUSIVE;

  let dpp = amountBruto;
  if (isInclusive) {
    const ppnFactor = new Prisma.Decimal(1).add(taxPpnRate.div(100));
    dpp = amountBruto.div(ppnFactor).toDecimalPlaces(2);
  }

  const taxPpnAmount = dpp.mul(taxPpnRate.div(100)).toDecimalPlaces(2);
  const taxPphAmount = dpp.mul(taxPphRate.div(100)).toDecimalPlaces(2);
  const taxOtherAmount = dpp.mul(taxOtherRate.div(100)).toDecimalPlaces(2);

  // Total Tagihan yang harus dibayar klien (Net of PPh)
  const amountPayable = dpp.add(taxPpnAmount).add(taxOtherAmount).sub(taxPphAmount);
  
  // Backwards compatibility
  const taxPphFinal = calcPphFinal(amountBruto);
  const settings = await prisma.companySettings.findFirst({
    where: { tenantId },
    select: { defaultDueDays: true },
  });

  const dueDate = (() => {
    if (parsed.data.dueDate && parsed.data.dueDate !== "") {
      return new Date(parsed.data.dueDate);
    }
    const days = settings?.defaultDueDays ?? 14;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  })();

  let createdId: string | null = null;
  const bankAccountIds = Array.from(new Set(parsed.data.bankAccountIds)).filter(Boolean);

  for (let attempt = 0; attempt < 20; attempt++) {
    const invoiceNumber = await generateInvoiceNumber(tenantId);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            tenantId,
            invoiceNumber,
            clientId: parsed.data.clientId,
            projectId: parsed.data.projectId === "" ? null : parsed.data.projectId,
            type: parsed.data.type,
            template: parsed.data.template,
            taxMethod: parsed.data.taxMethod,
            taxInvoiceNumber: parsed.data.taxInvoiceNumber === "" ? null : parsed.data.taxInvoiceNumber,
            poReference: parsed.data.poReference === "" ? null : parsed.data.poReference,
            terms: parsed.data.terms === "" ? null : parsed.data.terms,
            footer: parsed.data.footer === "" ? null : parsed.data.footer,
            amountBruto: amountPayable,
            taxPpnRate,
            taxPpnAmount,
            taxPphRate,
            taxPphAmount,
            taxPphType: parsed.data.taxPphType === "" ? null : parsed.data.taxPphType,
            taxOtherRate,
            taxOtherAmount,
            taxOtherLabel: parsed.data.taxOtherLabel === "" ? null : parsed.data.taxOtherLabel,
            taxPphFinal,
            isDeductedByClient: parsed.data.isDeductedByClient,
            approvalStatus: InvoiceApprovalStatus.DRAFT,
            status: InvoiceStatus.UNPAID,
            dueDate,
            items: {
              create: itemsWithAmount.map(item => ({
                description: item.description,
                quantity: item.quantity,
                price: item.price,
                amount: item.amount,
              }))
            }
          },
          select: { id: true },
        });

        if (bankAccountIds.length > 0) {
          await tx.invoiceBankAccount.createMany({
            data: bankAccountIds.map((bankAccountId) => ({
              invoiceId: inv.id,
              bankAccountId,
            })),
            skipDuplicates: true,
          });
        }

        return inv;
      });
      createdId = created.id;
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        continue;
      }
      throw err;
    }
  }

  if (!createdId) redirect(`/invoices/new?error=numbering`);

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.INVOICE,
    entityId: createdId,
    afterJson: { invoiceNumber: await prisma.invoice.findUnique({ where: { id: createdId }, select: { invoiceNumber: true } }) },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/invoices");
  revalidatePath("/tax-reminder");
  revalidatePath("/");
  redirect(`/invoices/${createdId}`);
}

export async function updateInvoicePresentation(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = invoicePresentationSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    template: formData.get("template"),
    poReference: formData.get("poReference"),
    terms: formData.get("terms"),
    footer: formData.get("footer"),
    bankAccountIds: formData.getAll("bankAccountIds"),
  });

  if (!parsed.success) redirect(`/invoices/${String(formData.get("invoiceId"))}?error=invalid`);

  const bankAccountIds = Array.from(new Set(parsed.data.bankAccountIds)).filter(Boolean);

  const before = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    include: { bankAccounts: true },
  });
  if (!before) redirect("/invoices");

  const after = await prisma.$transaction(async (tx) => {
    await tx.invoiceBankAccount.deleteMany({ where: { invoiceId: parsed.data.invoiceId } });
    if (bankAccountIds.length > 0) {
      await tx.invoiceBankAccount.createMany({
        data: bankAccountIds.map((bankAccountId) => ({
          invoiceId: parsed.data.invoiceId,
          bankAccountId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: {
        template: parsed.data.template,
        poReference: parsed.data.poReference === "" ? null : parsed.data.poReference,
        terms: parsed.data.terms === "" ? null : parsed.data.terms,
        footer: parsed.data.footer === "" ? null : parsed.data.footer,
      },
    });
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: parsed.data.invoiceId,
    beforeJson: { template: before.template, poReference: before.poReference, terms: before.terms, footer: before.footer, bankAccountIds: before.bankAccounts.map(b => b.bankAccountId) },
    afterJson: { template: after.template, poReference: after.poReference, terms: after.terms, footer: after.footer, bankAccountIds },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath(`/invoices/${after.id}`);
  revalidatePath(`/invoices/${after.id}/print`);
  revalidatePath("/invoices");
  redirect(`/invoices/${after.id}`);
}

export async function approveInvoice(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const parsed = approvalSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
  });
  if (!parsed.success) redirect("/invoices?error=invalid");

  const before = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (!before) redirect("/invoices");
  if (before.approvalStatus !== InvoiceApprovalStatus.DRAFT) {
    redirect(`/invoices/${before.id}`);
  }

  const after = await prisma.invoice.update({
    where: { id: before.id },
    data: { approvalStatus: InvoiceApprovalStatus.APPROVED, approvedAt: new Date() },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: after.id,
    beforeJson: before ?? undefined,
    afterJson: { approvalStatus: after.approvalStatus, approvedAt: after.approvedAt },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${after.id}`);
  redirect(`/invoices/${after.id}`);
}

export async function markInvoiceSent(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = approvalSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
  });
  if (!parsed.success) redirect("/invoices?error=invalid");

  const before = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (!before) redirect("/invoices");
  if (before.approvalStatus === InvoiceApprovalStatus.DRAFT) {
    redirect(`/invoices/${before.id}?error=not_approved`);
  }
  if (before.approvalStatus === InvoiceApprovalStatus.SENT) {
    redirect(`/invoices/${before.id}`);
  }

  const after = await prisma.invoice.update({
    where: { id: before.id },
    data: { approvalStatus: InvoiceApprovalStatus.SENT, sentAt: new Date() },
  });

  let emailQueued = false;
  try {
    await enqueueInvoiceEmail({
      invoiceId: after.id,
      type: EmailMessageType.INVOICE_SENT,
      dedupeKey: `AUTO_INVOICE_SENT:${after.id}`,
      createdByUserId: actor.id,
    });
    emailQueued = true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      emailQueued = false;
    } else {
      const msg = err instanceof Error ? err.message : "unknown";
      redirect(`/invoices/${after.id}?error=email_failed&msg=${encodeURIComponent(msg)}`);
    }
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: after.id,
    beforeJson: before ?? undefined,
    afterJson: { approvalStatus: after.approvalStatus, sentAt: after.sentAt, emailQueued },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${after.id}`);
  redirect(`/invoices/${after.id}`);
}

export async function setInvoiceStatus(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const id = z.string().min(1).parse(formData.get("id"));
  const status = z.nativeEnum(InvoiceStatus).parse(formData.get("status"));

  const before = await prisma.invoice.findUnique({ 
    where: { id },
    include: { payments: { select: { amount: true } } }
  });

  if (!before) redirect("/invoices");

  if (
    status === InvoiceStatus.PAID &&
    before.approvalStatus === InvoiceApprovalStatus.DRAFT
  ) {
    redirect(`/invoices/${id}?error=not_approved`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        status,
        paidAt: status === InvoiceStatus.PAID ? new Date() : null,
      },
    });

    // If marking as PAID, ensure there is a payment record for the revenue to show on dashboard
    if (status === InvoiceStatus.PAID) {
      const totalPaid = before.payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
      const remaining = before.amountBruto.minus(totalPaid);

      if (remaining.greaterThan(0)) {
        const paidAt = new Date();
        const payment = await tx.invoicePayment.create({
          data: {
            invoiceId: id,
            amount: remaining,
            paidAt,
            method: PaymentMethod.TRANSFER,
            note: "Automatically created via Mark Paid",
          },
        });

        await tx.ledgerEntry.create({
          data: {
            type: LedgerEntryType.INCOME,
            occurredAt: paidAt,
            amount: remaining,
            account: PaymentMethod.TRANSFER,
            description: `Invoice payment ${before.invoiceNumber} (Mark Paid)`,
            reference: before.invoiceNumber,
            invoiceId: id,
            paymentId: payment.id,
          },
        });
      }
    }
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: status === InvoiceStatus.PAID ? AuditAction.MARK_PAID : AuditAction.MARK_UNPAID,
    entityType: AuditEntityType.INVOICE,
    entityId: id,
    beforeJson: before ?? undefined,
    afterJson: { status },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/invoices");
  revalidatePath("/tax-reminder");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/ledger");
  revalidatePath("/");
  redirect(`/invoices/${id}`);
}

/**
 * Fixes invoices that were marked as PAID but don't have corresponding payment records.
 * This can happen if they were marked paid before the automatic payment creation was implemented.
 */
export async function syncPaidInvoices() {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);

  const paidInvoicesWithoutPayments = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.PAID,
      payments: { none: {} },
    },
  });

  if (paidInvoicesWithoutPayments.length === 0) {
    return { success: true, count: 0 };
  }

  const results = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (const inv of paidInvoicesWithoutPayments) {
      const paidAt = inv.paidAt || new Date();
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: inv.id,
          amount: inv.amountBruto,
          paidAt,
          method: PaymentMethod.TRANSFER,
          note: "Automatically created via Sync Paid Invoices",
        },
      });

      await tx.ledgerEntry.create({
        data: {
          type: LedgerEntryType.INCOME,
          occurredAt: paidAt,
          amount: inv.amountBruto,
          account: PaymentMethod.TRANSFER,
          description: `Invoice payment ${inv.invoiceNumber} (Sync)`,
          reference: inv.invoiceNumber,
          invoiceId: inv.id,
          paymentId: payment.id,
        },
      });
      count++;
    }
    return count;
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: "SYSTEM",
    afterJson: { syncCount: results },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath("/ledger");

  return { success: true, count: results };
}

export async function addInvoicePayment(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = paymentSchema.safeParse({
    invoiceId: formData.get("invoiceId")?.toString(),
    amount: formData.get("amount")?.toString(),
    method: formData.get("method")?.toString(),
    paidAt: formData.get("paidAt")?.toString(),
    note: formData.get("note")?.toString() ?? "",
  });

  if (!parsed.success) {
    console.error("Validation failed:", parsed.error.format());
    redirect(`/invoices/${String(formData.get("invoiceId"))}?error=invalid`);
  }

  const inv = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: { approvalStatus: true },
  });
  if (inv?.approvalStatus === InvoiceApprovalStatus.DRAFT) {
    redirect(`/invoices/${parsed.data.invoiceId}?error=not_approved`);
  }

  const amount = new Prisma.Decimal(parsed.data.amount);
  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
  const note = parsed.data.note === "" ? null : parsed.data.note;

  const payment = await prisma.$transaction(async (tx) => {
    const createdPayment = await tx.invoicePayment.create({
      data: {
        invoiceId: parsed.data.invoiceId,
        amount,
        paidAt,
        method: parsed.data.method,
        note,
      },
    });

    const invoiceNumber = await tx.invoice.findUnique({
      where: { id: parsed.data.invoiceId },
      select: { invoiceNumber: true },
    });

    await tx.ledgerEntry.create({
      data: {
        type: LedgerEntryType.INCOME,
        occurredAt: paidAt,
        amount,
        account: parsed.data.method,
        description: invoiceNumber ? `Invoice payment ${invoiceNumber.invoiceNumber}` : "Invoice payment",
        reference: invoiceNumber?.invoiceNumber ?? null,
        invoiceId: parsed.data.invoiceId,
        paymentId: createdPayment.id,
      },
    });

    return createdPayment;
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.ADD_PAYMENT,
    entityType: AuditEntityType.PAYMENT,
    entityId: parsed.data.invoiceId,
    afterJson: { paymentId: payment.id, amount: amount.toString(), method: parsed.data.method, paidAt },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    select: { amountBruto: true },
  });

  const paidAgg = await prisma.invoicePayment.aggregate({
    where: { invoiceId: parsed.data.invoiceId },
    _sum: { amount: true },
  });

  const totalPaid = new Prisma.Decimal(paidAgg._sum.amount ?? 0);
  if (invoice && totalPaid.greaterThanOrEqualTo(invoice.amountBruto)) {
    await prisma.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: { status: InvoiceStatus.PAID, paidAt: paidAt },
    });
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  revalidatePath("/");
  redirect(`/invoices/${parsed.data.invoiceId}`);
}

export async function deleteInvoicePayment(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const paymentId = z.string().min(1).parse(formData.get("paymentId"));
  const invoiceId = z.string().min(1).parse(formData.get("invoiceId"));

  const before = await prisma.invoicePayment.findUnique({ where: { id: paymentId } });
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { paymentId } }),
    prisma.invoicePayment.delete({ where: { id: paymentId } }),
  ]);

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.DELETE_PAYMENT,
    entityType: AuditEntityType.PAYMENT,
    entityId: invoiceId,
    beforeJson: before ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  redirect(`/invoices/${invoiceId}`);
}

export async function addInvoiceAttachment(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  const parsed = attachmentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    label: formData.get("label"),
    url: formData.get("url"),
  });

  if (!parsed.success) redirect(`/invoices/${String(formData.get("invoiceId"))}?error=invalid`);

  const maybeFile = formData.get("file");
  const file = maybeFile instanceof File ? maybeFile : null;

  const url = (() => {
    if (file && file.size > 0) return null;
    const raw = (parsed.data.url ?? "").trim();
    if (!raw) return null;
    return z.string().url().parse(raw);
  })();

  if (!file && !url) redirect(`/invoices/${parsed.data.invoiceId}?error=attachment_missing`);

  const finalUrl =
    file && file.size > 0
      ? await savePublicUpload({ folder: `invoices/${parsed.data.invoiceId}`, file })
      : (url as string);

  const created = await prisma.invoiceAttachment.create({
    data: {
      invoiceId: parsed.data.invoiceId,
      label: parsed.data.label,
      url: finalUrl,
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.INVOICE,
    entityId: parsed.data.invoiceId,
    afterJson: { attachmentId: created.id, label: created.label, url: created.url },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  redirect(`/invoices/${parsed.data.invoiceId}`);
}

export async function deleteInvoiceAttachment(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  const attachmentId = z.string().min(1).parse(formData.get("attachmentId"));
  const invoiceId = z.string().min(1).parse(formData.get("invoiceId"));

  const before = await prisma.invoiceAttachment.findUnique({
    where: { id: attachmentId },
  });
  await prisma.invoiceAttachment.delete({ where: { id: attachmentId } });
  if (before?.url) await tryDeletePublicFile(before.url);

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.DELETE,
    entityType: AuditEntityType.INVOICE,
    entityId: invoiceId,
    beforeJson: before ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function markPphPaid(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = pphSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    pphPaidAt: formData.get("pphPaidAt"),
    pphNtpn: formData.get("pphNtpn"),
    pphBillingId: formData.get("pphBillingId"),
    pphAttachmentUrl: formData.get("pphAttachmentUrl"),
  });

  if (!parsed.success) redirect("/tax-reminder?error=invalid");

  const maybeFile = formData.get("pphAttachmentFile");
  const file = maybeFile instanceof File ? maybeFile : null;

  const pphAttachmentUrl = (() => {
    if (file && file.size > 0) return null;
    const raw = (parsed.data.pphAttachmentUrl ?? "").trim();
    if (!raw) return null;
    return z.string().url().parse(raw);
  })();

  const finalAttachmentUrl =
    file && file.size > 0
      ? await savePublicUpload({ folder: `pph/${parsed.data.invoiceId}`, file })
      : pphAttachmentUrl;

  const before = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (
    finalAttachmentUrl &&
    before?.pphAttachmentUrl &&
    before.pphAttachmentUrl !== finalAttachmentUrl
  ) {
    await tryDeletePublicFile(before.pphAttachmentUrl);
  }
  await prisma.invoice.update({
    where: { id: parsed.data.invoiceId },
    data: {
      pphPaidAt: parsed.data.pphPaidAt ? new Date(parsed.data.pphPaidAt) : new Date(),
      pphNtpn: parsed.data.pphNtpn === "" ? null : parsed.data.pphNtpn,
      pphBillingId:
        parsed.data.pphBillingId === "" ? null : parsed.data.pphBillingId,
      pphAttachmentUrl: finalAttachmentUrl ?? undefined,
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.MARK_PPH_PAID,
    entityType: AuditEntityType.INVOICE,
    entityId: parsed.data.invoiceId,
    beforeJson: before ?? undefined,
    afterJson: {
      pphPaidAt: parsed.data.pphPaidAt ?? "now",
      pphNtpn: parsed.data.pphNtpn,
      pphBillingId: parsed.data.pphBillingId,
      pphAttachmentUrl: finalAttachmentUrl ?? parsed.data.pphAttachmentUrl,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/tax-reminder");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  revalidatePath("/");
  redirect("/tax-reminder");
}

export async function deleteInvoice(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.invoice.findUnique({ where: { id } });
  await prisma.invoice.delete({ where: { id } });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.DELETE,
    entityType: AuditEntityType.INVOICE,
    entityId: id,
    beforeJson: before ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/invoices");
  revalidatePath("/tax-reminder");
  revalidatePath("/");
  redirect("/invoices");
}

export async function getInvoices() {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  return prisma.invoice.findMany({
    include: { client: true, project: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function bulkApproveInvoices(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const ids = formData.getAll("ids") as string[];
  if (ids.length === 0) redirect("/invoices");

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids }, approvalStatus: InvoiceApprovalStatus.DRAFT },
  });

  if (invoices.length === 0) redirect("/invoices");

  const meta = await getRequestMeta();
  for (const inv of invoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { approvalStatus: InvoiceApprovalStatus.APPROVED, approvedAt: new Date() },
    });
    await writeAuditLog({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.INVOICE,
      entityId: inv.id,
      beforeJson: inv,
      afterJson: { approvalStatus: InvoiceApprovalStatus.APPROVED, approvedAt: new Date() },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  revalidatePath("/invoices");
  redirect("/invoices?success=bulk_approved");
}

export async function bulkMarkSentInvoices(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const ids = formData.getAll("ids") as string[];
  if (ids.length === 0) redirect("/invoices");

  const invoices = await prisma.invoice.findMany({
    where: { 
      id: { in: ids }, 
      approvalStatus: InvoiceApprovalStatus.APPROVED 
    },
  });

  if (invoices.length === 0) redirect("/invoices");

  const meta = await getRequestMeta();
  for (const inv of invoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { approvalStatus: InvoiceApprovalStatus.SENT, sentAt: new Date() },
    });
    
    let emailQueued = false;
    try {
      await enqueueInvoiceEmail({
        invoiceId: inv.id,
        type: EmailMessageType.INVOICE_SENT,
        dedupeKey: `AUTO_INVOICE_SENT:${inv.id}`,
        createdByUserId: actor.id,
      });
      emailQueued = true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        emailQueued = false;
      }
    }

    await writeAuditLog({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.INVOICE,
      entityId: inv.id,
      beforeJson: inv,
      afterJson: { approvalStatus: InvoiceApprovalStatus.SENT, sentAt: new Date(), emailQueued },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  revalidatePath("/invoices");
  redirect("/invoices?success=bulk_sent");
}

export async function getInvoicesPaged(input: {
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  const q = input.q?.trim();
  const pageSize = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const skip = Math.max(0, (page - 1) * pageSize);

  const where: Prisma.InvoiceWhereInput = q
    ? {
        OR: [
          { invoiceNumber: { contains: q } },
          { client: { name: { contains: q } } },
          { client: { companyName: { contains: q } } },
          { project: { name: { contains: q } } },
        ],
      }
    : {};

  const [items, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where: {
        ...where,
        type: { in: ["PROFESSIONAL", "SIMPLE"] as any }
      },
      include: { client: true, project: true },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    prisma.invoice.count({ 
      where: {
        ...where,
        type: { in: ["PROFESSIONAL", "SIMPLE"] as any }
      }
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { createdAt: "desc" }, include: { createdByUser: true } },
      bankAccounts: { orderBy: { createdAt: "asc" }, include: { bankAccount: true } },
      emails: { orderBy: { createdAt: "desc" }, take: 10, include: { createdByUser: true } },
    },
  });
}

export async function getPaymentById(id: string) {
  return prisma.invoicePayment.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          client: true,
          project: true,
        },
      },
    },
  });
}

export async function getTaxReminderInvoices() {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  return prisma.invoice.findMany({
    where: {
      isDeductedByClient: false,
      status: "PAID" as any,
      pphPaidAt: null,
    },
    include: { client: true, project: true },
    orderBy: { createdAt: "desc" },
  });
}
