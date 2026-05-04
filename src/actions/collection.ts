"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole, requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, InvoiceStatus, Prisma, UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const followUpSchema = z.object({
  invoiceId: z.string().min(1),
  note: z.string().trim().min(1),
  nextFollowUpAt: z.string().optional().or(z.literal("")),
});

export async function addInvoiceFollowUp(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const parsed = followUpSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    note: formData.get("note"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
  });
  if (!parsed.success) redirect(`/invoices/${String(formData.get("invoiceId"))}?error=invalid`);

  const nextFollowUpAt =
    parsed.data.nextFollowUpAt && parsed.data.nextFollowUpAt !== ""
      ? new Date(parsed.data.nextFollowUpAt)
      : null;

  const before = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (!before) redirect("/invoices");

  await prisma.$transaction([
    prisma.invoiceFollowUp.create({
      data: {
        invoiceId: parsed.data.invoiceId,
        createdByUserId: actor.id,
        note: parsed.data.note,
        nextFollowUpAt,
      },
    }),
    prisma.invoice.update({
      where: { id: parsed.data.invoiceId },
      data: { nextFollowUpAt },
    }),
  ]);

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.INVOICE,
    entityId: parsed.data.invoiceId,
    beforeJson: before ?? undefined,
    afterJson: { followUp: { note: parsed.data.note, nextFollowUpAt } },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath(`/invoices/${parsed.data.invoiceId}`);
  revalidatePath("/collections");
  revalidatePath("/");
  redirect(`/invoices/${parsed.data.invoiceId}`);
}

export async function getAgingCollection() {
  const actor = await requireRole([UserRole.ADMIN, UserRole.FINANCE]);

  const invoices = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.UNPAID, tenantId: actor.tenantId },
    include: {
      client: true,
      project: true,
      payments: { select: { amount: true } },
      followUps: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { createdByUser: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toNumber = (d: Prisma.Decimal) => Number(d.toString());
  const bucketOf = (daysOverdue: number) => {
    if (daysOverdue <= 0) return "0-30";
    if (daysOverdue <= 30) return "0-30";
    if (daysOverdue <= 60) return "31-60";
    if (daysOverdue <= 90) return "61-90";
    return "90+";
  };

  const items = invoices
    .map((inv) => {
      const bruto = new Prisma.Decimal(inv.amountBruto);
      const paidSum = inv.payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
      const outstanding = bruto.minus(paidSum).toDecimalPlaces(2);

      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (due) due.setHours(0, 0, 0, 0);
      const daysOverdue = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.companyName ?? inv.client.name,
        projectName: inv.project?.name ?? "",
        dueDate: inv.dueDate,
        nextFollowUpAt: inv.nextFollowUpAt,
        daysOverdue,
        bucket: bucketOf(daysOverdue),
        outstanding: toNumber(outstanding),
        lastFollowUp: inv.followUps[0]
          ? {
              note: inv.followUps[0].note,
              createdAt: inv.followUps[0].createdAt,
              actor: inv.followUps[0].createdByUser
                ? `${inv.followUps[0].createdByUser.name} (${inv.followUps[0].createdByUser.email})`
                : "-",
            }
          : null,
      };
    })
    .filter((i) => i.outstanding > 0);

  const totals = items.reduce<Record<string, { count: number; sum: number }>>((acc, it) => {
    acc[it.bucket] ??= { count: 0, sum: 0 };
    acc[it.bucket].count += 1;
    acc[it.bucket].sum += it.outstanding;
    return acc;
  }, {});

  return { items, totals };
}

export async function getDashboardNotifications() {
  const user = await requireUser();
  const tenantId = user.tenantId;
  const canFinance = user.role === UserRole.ADMIN || user.role === UserRole.FINANCE;
  if (!canFinance) return [];

  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const dueSoonEnd = new Date(start);
  dueSoonEnd.setDate(dueSoonEnd.getDate() + 7);

  const [overdue, dueSoon, followUpDue, pphUnpaid] = await Promise.all([
    prisma.invoice.count({
      where: {
        tenantId,
        status: InvoiceStatus.UNPAID,
        dueDate: { lt: start },
      },
    }),
    prisma.invoice.count({
      where: {
        tenantId,
        status: InvoiceStatus.UNPAID,
        dueDate: { gte: start, lte: dueSoonEnd },
      },
    }),
    prisma.invoice.count({
      where: {
        tenantId,
        status: InvoiceStatus.UNPAID,
        nextFollowUpAt: { lte: start },
      },
    }),
    prisma.invoice.count({
      where: {
        tenantId,
        isDeductedByClient: false,
        status: InvoiceStatus.PAID,
        pphPaidAt: null,
      },
    }),
  ]);

  return [
    { key: "overdue", label: "Overdue invoices", count: overdue, href: "/collections?tab=overdue" },
    { key: "dueSoon", label: "Due within 7 days", count: dueSoon, href: "/collections?tab=dueSoon" },
    { key: "followUp", label: "Follow-up due", count: followUpDue, href: "/collections?tab=followUp" },
    { key: "pph", label: "Bukti Potong Missing (PAID)", count: pphUnpaid, href: "/tax-reminder" },
  ].filter((n) => n.count > 0);
}
