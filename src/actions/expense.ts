"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  AuditAction,
  AuditEntityType,
  LedgerEntryType,
  PaymentMethod,
  Prisma,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { enqueueInternalNotification } from "@/lib/email-outbox";

const expenseSchema = z.object({
  occurredAt: z.string().min(1),
  amount: z
    .string()
    .transform((v) => v.replaceAll(",", ".").trim())
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  vendor: z.string().trim().optional().or(z.literal("")),
  reference: z.string().trim().optional().or(z.literal("")),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.TRANSFER),
  attachmentUrl: z.string().trim().optional().or(z.literal("")),
});

export async function getExpensesPaged(input: {
  page?: number;
  limit?: number;
  category?: string;
  from?: string;
  to?: string;
}) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);

  const page = Math.max(1, input.page ?? 1);
  const limit = Math.max(1, input.limit ?? 50);
  const skip = (page - 1) * limit;

  const where: Prisma.ExpenseWhereInput = { tenantId: actor.tenantId };
  if (input.category) {
    where.category = input.category;
  }
  if (input.from || input.to) {
    where.occurredAt = {};
    if (input.from) where.occurredAt.gte = new Date(input.from);
    if (input.to) where.occurredAt.lte = new Date(input.to);
  }

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip,
      take: limit,
      include: { createdByUser: { select: { name: true } } },
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createExpenseAction(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = expenseSchema.safeParse({
    occurredAt: formData.get("occurredAt"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    description: formData.get("description"),
    vendor: formData.get("vendor"),
    reference: formData.get("reference"),
    paymentMethod: formData.get("paymentMethod"),
    attachmentUrl: formData.get("attachmentUrl"),
  });

  if (!parsed.success) redirect("/expenses?error=invalid");

  const occurredAt = new Date(parsed.data.occurredAt);
  const amount = new Prisma.Decimal(parsed.data.amount);

  const created = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.create({
      data: {
        tenantId: actor.tenantId,
        occurredAt,
        amount,
        category: parsed.data.category,
        description: parsed.data.description,
        vendor: parsed.data.vendor === "" ? null : parsed.data.vendor,
        reference: parsed.data.reference === "" ? null : parsed.data.reference,
        paymentMethod: parsed.data.paymentMethod,
        attachmentUrl: parsed.data.attachmentUrl === "" ? null : parsed.data.attachmentUrl,
        createdByUserId: actor.id,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        tenantId: actor.tenantId,
        type: LedgerEntryType.EXPENSE,
        occurredAt,
        amount,
        account: parsed.data.paymentMethod,
        description: exp.description,
        reference: exp.reference,
        expenseId: exp.id,
      },
    });

    return exp;
  });

  // Notification for large expenses (> 10jt)
  const LARGE_EXPENSE_THRESHOLD = 10000000;
  if (amount.toNumber() >= LARGE_EXPENSE_THRESHOLD) {
    const adminUsers = await prisma.user.findMany({
      where: { 
        role: { in: [UserRole.ADMIN, UserRole.FINANCE] },
        isActive: true,
        email: { not: "" }
      },
      select: { email: true }
    });

    if (adminUsers.length > 0) {
      const emails = adminUsers.map(u => u.email);
      const formattedAmount = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(amount.toNumber());
      
      await enqueueInternalNotification({
        tenantId: actor.tenantId,
        toEmails: emails,
        subject: `[NOTIFIKASI] Pengeluaran Besar: ${parsed.data.category}`,
        html: `
          <div style="font-family:sans-serif;padding:20px;border:1px solid #eee;border-radius:8px">
            <h2 style="color:#dc2626">Peringatan Pengeluaran Besar</h2>
            <p>Sistem mendeteksi input pengeluaran baru dengan jumlah yang signifikan:</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0">
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;color:#666">Kategori</td>
                <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold">${parsed.data.category}</td>
              </tr>
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;color:#666">Jumlah</td>
                <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#dc2626">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;color:#666">Deskripsi</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${parsed.data.description}</td>
              </tr>
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;color:#666">Oleh</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${actor.name}</td>
              </tr>
            </table>
            <p style="font-size:12px;color:#999">Email ini dikirim otomatis untuk tujuan transparansi keuangan.</p>
          </div>
        `,
        createdByUserId: actor.id,
      });
    }
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.EXPENSE,
    entityId: created.id,
    afterJson: { category: created.category, amount: created.amount.toString(), occurredAt: created.occurredAt },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/expenses");
  revalidatePath("/ledger");
  revalidatePath("/");
  redirect("/expenses?created=1");
}

export async function updateExpenseAction(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const id = z.string().min(1).parse(formData.get("id"));

  const parsed = expenseSchema.safeParse({
    occurredAt: formData.get("occurredAt"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    description: formData.get("description"),
    vendor: formData.get("vendor"),
    reference: formData.get("reference"),
    paymentMethod: formData.get("paymentMethod"),
    attachmentUrl: formData.get("attachmentUrl"),
  });

  if (!parsed.success) redirect("/expenses?error=invalid");

  const occurredAt = new Date(parsed.data.occurredAt);
  const amount = new Prisma.Decimal(parsed.data.amount);

  const before = await prisma.expense.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!before) redirect("/expenses?error=not_found");

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id },
      data: {
        occurredAt,
        amount,
        category: parsed.data.category,
        description: parsed.data.description,
        vendor: parsed.data.vendor === "" ? null : parsed.data.vendor,
        reference: parsed.data.reference === "" ? null : parsed.data.reference,
        paymentMethod: parsed.data.paymentMethod,
        attachmentUrl: parsed.data.attachmentUrl === "" ? null : parsed.data.attachmentUrl,
      },
    });

    await tx.ledgerEntry.updateMany({
      where: { expenseId: id },
      data: {
        occurredAt,
        amount,
        account: parsed.data.paymentMethod,
        description: parsed.data.description,
        reference: parsed.data.reference,
      },
    });
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.EXPENSE,
    entityId: id,
    beforeJson: { category: before.category, amount: before.amount.toString(), occurredAt: before.occurredAt },
    afterJson: { category: parsed.data.category, amount: amount.toString(), occurredAt },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/expenses");
  revalidatePath("/ledger");
  revalidatePath("/");
  redirect("/expenses?updated=1");
}

export async function deleteExpenseAction(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.expense.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!before) redirect("/expenses?error=not_found");

  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { expenseId: id } }),
    prisma.expense.delete({ where: { id } }),
  ]);

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.DELETE,
    entityType: AuditEntityType.EXPENSE,
    entityId: id,
    beforeJson: { category: before.category, amount: before.amount.toString(), occurredAt: before.occurredAt },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/expenses");
  revalidatePath("/ledger");
  revalidatePath("/");
  redirect("/expenses?deleted=1");
}

export async function getExpenseCategories() {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const categories = await prisma.expense.groupBy({
    by: ["category"],
    where: { tenantId: actor.tenantId },
    _count: { category: true },
  });
  return categories.map((c) => c.category);
}

export async function getExpenseById(id: string) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  return prisma.expense.findFirst({
    where: { id, tenantId: actor.tenantId },
  });
}
