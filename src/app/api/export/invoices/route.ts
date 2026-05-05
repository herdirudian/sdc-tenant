import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export async function GET() {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);

  const invoices = await prisma.invoice.findMany({
    include: { client: true, project: true },
    orderBy: { createdAt: "desc" },
  });

  const header = [
    "invoiceNumber",
    "client",
    "project",
    "type",
    "amountBruto",
    "taxPphFinal",
    "isDeductedByClient",
    "status",
    "dueDate",
    "paidAt",
    "pphPaidAt",
    "createdAt",
  ];

  const lines = [
    header.join(","),
    ...invoices.map((inv) =>
      [
        inv.invoiceNumber,
        inv.client.companyName ?? inv.client.name,
        inv.project?.name ?? "",
        inv.type,
        inv.amountBruto.toString(),
        inv.taxPphFinal.toString(),
        inv.isDeductedByClient ? "true" : "false",
        inv.status,
        inv.dueDate?.toISOString() ?? "",
        inv.paidAt?.toISOString() ?? "",
        inv.pphPaidAt?.toISOString() ?? "",
        inv.createdAt.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="invoices.csv"',
    },
  });
}

