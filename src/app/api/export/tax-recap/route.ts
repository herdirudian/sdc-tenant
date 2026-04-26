import { requireRole } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { getTaxRecapReport } from "@/actions/report";

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

  const data = await getTaxRecapReport({ from, to });

  const lines = [
    ["Laporan Rekapitulasi Pajak PPh Final (0.5%)"].join(","),
    [`Periode: ${from} s/d ${to}`].join(","),
    [""].join(","),
    ["Ringkasan", "Jumlah"].join(","),
    ["Total PPh Terhutang", data.totalTax].map(csvEscape).join(","),
    ["Sudah Setor", data.paidTax].map(csvEscape).join(","),
    ["Belum Setor", data.unpaidTax].map(csvEscape).join(","),
    [""].join(","),
    ["Invoice Number", "Client Name", "Tgl Bayar Invoice", "Amount Bruto", "PPh Final", "Status Setor", "Tgl Setor PPh", "NTPN"].join(","),
    ...data.items.map(i => [
      i.invoiceNumber,
      i.clientName,
      i.paidAt ? i.paidAt.toISOString().split("T")[0] : "-",
      i.amountBruto,
      i.taxPphFinal,
      i.pphPaidAt ? "LUNAS" : "PENDING",
      i.pphPaidAt ? i.pphPaidAt.toISOString().split("T")[0] : "-",
      i.pphNtpn || "-"
    ].map(csvEscape).join(",")),
  ];

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="Tax_Recap_${from}_${to}.csv"`,
    },
  });
}
