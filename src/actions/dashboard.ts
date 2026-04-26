"use server";

import { prisma } from "@/lib/prisma";
import { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { getDashboardNotifications } from "@/actions/collection";

export async function getDashboardSummary() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [
    revenue,
    pendingInvoices,
    pendingPayments,
    taxToPay,
    taxToPayThisMonth,
    expenses,
    activeProjects,
  ] = await Promise.all([
    prisma.invoicePayment.aggregate({
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: InvoiceStatus.UNPAID },
      _sum: { amountBruto: true },
      _count: { _all: true },
    }),
    prisma.invoicePayment.aggregate({
      where: { invoice: { status: InvoiceStatus.UNPAID } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        isDeductedByClient: false,
        status: InvoiceStatus.PAID,
        pphPaidAt: null,
      },
      _sum: { taxPphFinal: true },
    }),
    prisma.invoice.aggregate({
      where: {
        isDeductedByClient: false,
        status: InvoiceStatus.PAID,
        pphPaidAt: null,
        paidAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { taxPphFinal: true },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
    }),
    prisma.project.count({
      where: { status: "ONGOING" },
    }),
  ]);

  const asString = (value: unknown) =>
    value && typeof value === "object" && "toString" in value
      ? (value as { toString: () => string }).toString()
      : String(value ?? 0);

  const totalRevenue = new Prisma.Decimal(revenue._sum.amount ?? 0);
  const totalExpenses = new Prisma.Decimal(expenses._sum.amount ?? 0);
  const netProfit = totalRevenue.minus(totalExpenses).toDecimalPlaces(2);

  const pendingBruto = new Prisma.Decimal(pendingInvoices._sum.amountBruto ?? 0);
  const pendingPaid = new Prisma.Decimal(pendingPayments._sum.amount ?? 0);
  const pendingRemaining = pendingBruto.minus(pendingPaid).toDecimalPlaces(2);

  const expenseCategories = await prisma.expense.groupBy({
    by: ["category"],
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  return {
    totalRevenue: totalRevenue.toString(),
    totalExpenses: totalExpenses.toString(),
    netProfit: netProfit.toString(),
    pendingPayments: asString(pendingRemaining),
    pendingCount: pendingInvoices._count._all ?? 0,
    totalTaxToPay: asString(taxToPay._sum.taxPphFinal),
    taxToPayThisMonth: asString(taxToPayThisMonth._sum.taxPphFinal),
    activeProjects: activeProjects,
    agingSummary: await getAgingSummaryForDashboard(),
    expenseBreakdown: expenseCategories.map((c) => ({
      category: c.category,
      amount: (c._sum.amount ?? 0).toString(),
    })),
  };
}

async function getAgingSummaryForDashboard() {
  const unpaid = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.UNPAID },
    select: { amountBruto: true, dueDate: true, payments: { select: { amount: true } } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

  for (const inv of unpaid) {
    const paid = inv.payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
    const outstanding = new Prisma.Decimal(inv.amountBruto).minus(paid);
    if (outstanding.lte(0)) continue;

    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    const days = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;

    if (days <= 30) buckets["0-30"] += Number(outstanding.toString());
    else if (days <= 60) buckets["31-60"] += Number(outstanding.toString());
    else if (days <= 90) buckets["61-90"] += Number(outstanding.toString());
    else buckets["90+"] += Number(outstanding.toString());
  }

  return buckets;
}

export async function getDashboardData() {
  const summary = await getDashboardSummary();

  const [recentInvoices, recentActivity, notifications, monthlyTrend] = await Promise.all([
    prisma.invoice.findMany({
      include: { client: true, project: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.auditLog.findMany({
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    getDashboardNotifications(),
    getMonthlyTrend(),
  ]);

  return { summary, recentInvoices, recentActivity, notifications, monthlyTrend };
}

async function getMonthlyTrend() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
    });
  }

  const trend = await Promise.all(
    months.map(async (m) => {
      const [income, expense] = await Promise.all([
        prisma.invoicePayment.aggregate({
          where: {
            paidAt: { gte: m.start, lte: m.end },
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            occurredAt: { gte: m.start, lte: m.end },
          },
          _sum: { amount: true },
        }),
      ]);

      return {
        label: m.label,
        income: Number(income._sum.amount ?? 0),
        expense: Number(expense._sum.amount ?? 0),
      };
    }),
  );

  return trend;
}
