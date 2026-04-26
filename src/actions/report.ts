"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { LedgerEntryType, UserRole, Prisma, InvoiceStatus } from "@/generated/prisma/client";

export interface PnLData {
  period: string;
  income: string;
  expenses: string;
  payroll: string;
  netProfit: string;
  expenseBreakdown: { category: string; amount: string }[];
}

export async function getPnLReport(input: { from: string; to: string }): Promise<PnLData> {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const from = new Date(input.from);
  const to = new Date(input.to);
  to.setHours(23, 59, 59, 999);

  const [incomeAgg, expenseAgg, expenseBreakdownRaw] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: {
        type: LedgerEntryType.INCOME,
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        type: LedgerEntryType.EXPENSE,
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: {
        occurredAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);

  const payrollCategories = ["Gaji Staff", "Payroll", "Gaji"];
  
  let payrollTotal = new Prisma.Decimal(0);
  const filteredBreakdown: { category: string; amount: string }[] = [];

  expenseBreakdownRaw.forEach((b) => {
    const amount = new Prisma.Decimal(b._sum.amount ?? 0);
    if (payrollCategories.some(cat => b.category.toLowerCase() === cat.toLowerCase())) {
      payrollTotal = payrollTotal.add(amount);
    } else {
      filteredBreakdown.push({
        category: b.category,
        amount: amount.toString(),
      });
    }
  });

  const income = new Prisma.Decimal(incomeAgg._sum.amount ?? 0);
  const totalExpenseEntries = new Prisma.Decimal(expenseAgg._sum.amount ?? 0);
  
  // Expenses in report is total expenses minus payroll
  const expenses = totalExpenseEntries.minus(payrollTotal);
  const netProfit = income.minus(totalExpenseEntries);

  return {
    period: `${input.from} to ${input.to}`,
    income: income.toString(),
    expenses: expenses.toString(),
    payroll: payrollTotal.toString(),
    netProfit: netProfit.toString(),
    expenseBreakdown: filteredBreakdown,
  };
}

export interface TaxRecapData {
  totalTax: string;
  paidTax: string;
  unpaidTax: string;
  items: {
    invoiceNumber: string;
    clientName: string;
    paidAt: Date | null;
    amountBruto: string;
    taxPphFinal: string;
    pphPaidAt: Date | null;
    pphNtpn: string | null;
  }[];
}

export async function getTaxRecapReport(input: { from: string; to: string }): Promise<TaxRecapData> {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const from = new Date(input.from);
  const to = new Date(input.to);
  to.setHours(23, 59, 59, 999);

  const invoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.PAID,
      paidAt: { gte: from, lte: to },
    },
    include: { client: { select: { name: true } } },
    orderBy: { paidAt: "asc" },
  });

  let totalTax = new Prisma.Decimal(0);
  let paidTax = new Prisma.Decimal(0);
  let unpaidTax = new Prisma.Decimal(0);

  const items = invoices.map((inv) => {
    const tax = new Prisma.Decimal(inv.taxPphFinal);
    totalTax = totalTax.add(tax);
    if (inv.pphPaidAt) {
      paidTax = paidTax.add(tax);
    } else {
      unpaidTax = unpaidTax.add(tax);
    }

    return {
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client.name,
      paidAt: inv.paidAt,
      amountBruto: inv.amountBruto.toString(),
      taxPphFinal: inv.taxPphFinal.toString(),
      pphPaidAt: inv.pphPaidAt,
      pphNtpn: inv.pphNtpn,
    };
  });

  return {
    totalTax: totalTax.toString(),
    paidTax: paidTax.toString(),
    unpaidTax: unpaidTax.toString(),
    items,
  };
}
