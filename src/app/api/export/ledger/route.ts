import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { LedgerEntryType, UserRole } from "@prisma/client";

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
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where = {
    ...(from ? { occurredAt: { gte: new Date(from) } } : {}),
    ...(to ? { occurredAt: { ...(from ? { gte: new Date(from) } : {}), lte: new Date(to) } } : {}),
  };

  const entries = await prisma.ledgerEntry.findMany({
    where,
    include: {
      invoice: { include: { client: true } },
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    take: 5000,
  });

  const lines = [
    [
      "occurredAt",
      "type",
      "amount",
      "account",
      "description",
      "reference",
      "invoiceNumber",
      "client",
      "paymentId",
      "expenseId",
    ].join(","),
    ...entries.map((e) =>
      [
        e.occurredAt.toISOString(),
        e.type === LedgerEntryType.INCOME ? "INCOME" : "EXPENSE",
        e.amount.toString(),
        e.account,
        e.description,
        e.reference ?? "",
        e.invoice?.invoiceNumber ?? "",
        e.invoice ? e.invoice.client.companyName ?? e.invoice.client.name : "",
        e.paymentId ?? "",
        e.expenseId ?? "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="ledger.csv"',
    },
  });
}

