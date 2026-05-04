"use server";

import { prisma } from "@/lib/prisma";
import { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { getDashboardNotifications } from "@/actions/collection";
import { requireTenant } from "@/lib/auth";

export async function getDashboardSummary() {
  const { tenantId } = await requireTenant();
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
      where: { invoice: { tenantId } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "UNPAID" as any, tenantId },
      _sum: { amountBruto: true },
      _count: { _all: true },
    }),
    prisma.invoicePayment.aggregate({
      where: { invoice: { status: "UNPAID" as any, tenantId } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        isDeductedByClient: false,
        status: "PAID" as any,
        pphPaidAt: null,
      },
      _sum: { taxPphFinal: true },
    }),
    prisma.invoice.aggregate({
      where: {
        tenantId,
        isDeductedByClient: false,
        status: "PAID" as any,
        pphPaidAt: null,
        paidAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { taxPphFinal: true },
    }),
    prisma.expense.aggregate({
      where: { tenantId },
      _sum: { amount: true },
    }),
    prisma.project.count({
      where: { status: "ONGOING" as any, tenantId },
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
    where: { tenantId },
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
    agingSummary: await getAgingSummaryForDashboard(tenantId),
    expenseBreakdown: expenseCategories.map((c) => ({
      category: c.category,
      amount: (c._sum.amount ?? 0).toString(),
    })),
  };
}

async function getAgingSummaryForDashboard(tenantId: string) {
  const unpaid = await prisma.invoice.findMany({
    where: { status: "UNPAID" as any, tenantId },
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

export async function getOnboardingStatus() {
  const { tenantId } = await requireTenant();

  const [company, clientCount, projectCount, invoiceCount, bankCount] = await Promise.all([
    prisma.companySettings.findFirst({ where: { tenantId } }),
    prisma.client.count({ where: { tenantId } }),
    prisma.project.count({ where: { tenantId } }),
    prisma.invoice.count({ where: { tenantId } }),
    prisma.bankAccount.count({ where: { tenantId } }),
  ]);

  const steps = [
    {
      id: "profile",
      label: "Lengkapi Profil & Logo",
      description: "Unggah logo dan alamat perusahaan Anda.",
      completed: !!company?.logoUrl && !!company?.address,
      href: "/settings",
    },
    {
      id: "bank",
      label: "Atur Rekening Bank",
      description: "Tambahkan rekening untuk menerima pembayaran.",
      completed: bankCount > 0,
      href: "/settings",
    },
    {
      id: "client",
      label: "Tambah Klien Pertama",
      description: "Daftarkan klien atau mitra bisnis Anda.",
      completed: clientCount > 0,
      href: "/clients",
    },
    {
      id: "project",
      label: "Buat Proyek Baru",
      description: "Kelola pekerjaan dalam bentuk proyek.",
      completed: projectCount > 0,
      href: "/projects",
    },
    {
      id: "invoice",
      label: "Terbitkan Invoice",
      description: "Mulai menagih pembayaran ke klien.",
      completed: invoiceCount > 0,
      href: "/invoices",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const isFinished = completedCount === steps.length;

  return { steps, completedCount, totalSteps: steps.length, isFinished };
}

export async function getDashboardData() {
  const { tenantId, subscription } = await requireTenant();
  
  // If no active/trial subscription, return empty or limited data
  if (!subscription || (subscription.status !== "ACTIVE" && subscription.status !== "TRIAL")) {
    return {
      summary: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        unpaidInvoicesCount: 0,
        unpaidInvoicesAmount: 0,
        paidInvoicesCount: 0,
        upcomingFollowUps: 0,
        overdueInvoicesCount: 0,
        aging: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
        taxPayableThisMonth: 0,
        taxPayableTotal: 0
      },
      onboarding: { 
        steps: [], 
        completedCount: 0, 
        totalSteps: 0, 
        isFinished: false 
      },
      recentInvoices: [],
      recentActivity: [],
      notifications: [],
      monthlyTrend: []
    };
  }
  const summary = await getDashboardSummary();
  const onboarding = await getOnboardingStatus();

  const [recentInvoices, recentActivity, notifications, monthlyTrend] = await Promise.all([
    prisma.invoice.findMany({
      where: { 
        tenantId,
        type: { in: ["PROFESSIONAL", "SIMPLE"] as any }
      },
      include: { client: true, project: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.auditLog.findMany({
      where: { tenantId },
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    getDashboardNotifications(),
    getMonthlyTrend(tenantId),
  ]);

  return { summary, recentInvoices, recentActivity, notifications, monthlyTrend, onboarding };
}

async function getMonthlyTrend(tenantId: string) {
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
            invoice: { tenantId } as any,
            paidAt: { gte: m.start, lte: m.end },
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            tenantId,
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
