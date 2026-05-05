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
  await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);

  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });

  const header = ["name", "email", "phone", "companyName", "npwp", "address"];
  const lines = [
    header.join(","),
    ...clients.map((c) =>
      [
        c.name,
        c.email ?? "",
        c.phone ?? "",
        c.companyName ?? "",
        c.npwp ?? "",
        c.address ?? "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="clients.csv"',
    },
  });
}

