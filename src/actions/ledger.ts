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
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export async function getLedgerSummary(input: { from?: string; to?: string }) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const from = input.from ? new Date(input.from) : null;
  const to = input.to ? new Date(input.to) : null;

  const where = {
    tenantId: actor.tenantId,
    ...(from ? { occurredAt: { gte: from } } : {}),
    ...(to ? { occurredAt: { ...(from ? { gte: from } : {}), lte: to } } : {}),
  };

  const [incomeAgg, expenseAgg, latest] = await Promise.all([
    prisma.ledgerEntry.aggregate({ where: { ...where, type: LedgerEntryType.INCOME }, _sum: { amount: true } }),
    prisma.ledgerEntry.aggregate({ where: { ...where, type: LedgerEntryType.EXPENSE }, _sum: { amount: true } }),
    prisma.ledgerEntry.findMany({
      where,
      include: { invoice: { select: { invoiceNumber: true, client: true } } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  const income = new Prisma.Decimal(incomeAgg._sum.amount ?? 0);
  const expense = new Prisma.Decimal(expenseAgg._sum.amount ?? 0);
  const net = income.minus(expense).toDecimalPlaces(2);

  return {
    income: income.toString(),
    expense: expense.toString(),
    net: net.toString(),
    entries: latest,
  };
}

export async function backfillLedgerFromPayments() {
  const actor = await requireRole([UserRole.ADMIN]);

  const payments = await prisma.invoicePayment.findMany({
    where: { ledgerEntry: null },
    include: { invoice: { select: { id: true, invoiceNumber: true } } },
    take: 500,
  });

  const createdCount = await prisma.$transaction(async (tx) => {
    let created = 0;
    for (const p of payments) {
      await tx.ledgerEntry.create({
        data: {
          tenantId: actor.tenantId,
          type: LedgerEntryType.INCOME,
          occurredAt: p.paidAt,
          amount: p.amount,
          account: p.method,
          description: `Invoice payment ${p.invoice.invoiceNumber}`,
          reference: p.invoice.invoiceNumber,
          invoiceId: p.invoiceId,
          paymentId: p.id,
        },
      });
      created += 1;
    }
    return created;
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.LEDGER_ENTRY,
    entityId: null,
    afterJson: { backfilled: createdCount },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/ledger");
  redirect("/ledger?backfilled=1");
}
