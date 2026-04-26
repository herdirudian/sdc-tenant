import { requireRole } from "@/lib/auth";
import { UserRole, LedgerEntryType } from "@/generated/prisma/client";
import { getPnLReport } from "@/actions/report";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  const data = await getPnLReport({ from, to });

  const lines = [
    ["Laporan Laba Rugi (P&L)"].join(","),
    [`Periode: ${from} s/d ${to}`].join(","),
    [""].join(","),
    ["Kategori", "Jumlah"].join(","),
    ["Total Pendapatan (Income)", data.income].map(csvEscape).join(","),
    ["Total Pengeluaran (Expenses)", data.expenses].map(csvEscape).join(","),
    ["Total Gaji (Payroll)", data.payroll].map(csvEscape).join(","),
    ["Laba Bersih (Net Profit)", data.netProfit].map(csvEscape).join(","),
    [""].join(","),
    ["Breakdown Pengeluaran"].join(","),
    ["Kategori", "Amount"].join(","),
    ...data.expenseBreakdown.map(b => [b.category, b.amount].map(csvEscape).join(",")),
  ];

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="P&L_Report_${from}_${to}.csv"`,
    },
  });
}
