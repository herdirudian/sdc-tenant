"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import * as crypto from "crypto";

const clientSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  companyName: z.string().trim().optional().or(z.literal("")),
  npwp: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
});

function emptyToNull(value: string | undefined) {
  if (!value || value === "") return null;
  return value;
}

export async function createClient(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    npwp: formData.get("npwp"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    redirect(`/clients/new?error=invalid`);
  }

  const data = parsed.data;

  const created = await prisma.client.create({
    data: {
      name: data.name,
      email: emptyToNull(data.email === "" ? undefined : data.email),
      phone: emptyToNull(data.phone === "" ? undefined : data.phone),
      companyName: emptyToNull(data.companyName === "" ? undefined : data.companyName),
      npwp: emptyToNull(data.npwp === "" ? undefined : data.npwp),
      address: emptyToNull(data.address === "" ? undefined : data.address),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.CLIENT,
    entityId: created.id,
    afterJson: created,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${created.id}/edit`);
  redirect("/clients");
}

export async function generatePortalToken(clientId: string) {
  console.log("Generating portal token for client:", clientId);
  try {
    await requireRole([UserRole.ADMIN, UserRole.STAFF]);

    const token = crypto.randomBytes(32).toString("hex");
    console.log("Generated token:", token);

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { portalToken: token },
    });
    console.log("Database updated for client:", updated.id);

    revalidatePath(`/clients/${clientId}/edit`);
    return { ok: true, token };
  } catch (err) {
    console.error("Failed to generate portal token:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getClientByPortalToken(token: string) {
  const client = await prisma.client.findUnique({
    where: { portalToken: token },
    include: {
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          project: true,
        },
      },
    },
  });

  return client;
}

export async function updateClient(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.client.findUnique({ where: { id } });

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    npwp: formData.get("npwp"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    redirect(`/clients/${id}/edit?error=invalid`);
  }

  const data = parsed.data;

  const after = await prisma.client.update({
    where: { id },
    data: {
      name: data.name,
      email: emptyToNull(data.email === "" ? undefined : data.email),
      phone: emptyToNull(data.phone === "" ? undefined : data.phone),
      companyName: emptyToNull(data.companyName === "" ? undefined : data.companyName),
      npwp: emptyToNull(data.npwp === "" ? undefined : data.npwp),
      address: emptyToNull(data.address === "" ? undefined : data.address),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.CLIENT,
    entityId: id,
    beforeJson: before ?? undefined,
    afterJson: after,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}/edit`);
  redirect("/clients");
}

export async function deleteClient(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.client.findUnique({ where: { id } });
  await prisma.client.delete({ where: { id } });

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.DELETE,
    entityType: AuditEntityType.CLIENT,
    entityId: id,
    beforeJson: before ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function getClients() {
  return prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getClientsPaged(input: {
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const q = input.q?.trim();
  const pageSize = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const skip = Math.max(0, (page - 1) * pageSize);

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { companyName: { contains: q } },
          { npwp: { contains: q } },
        ],
      }
    : undefined;

  const [items, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    prisma.client.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({ where: { id } });
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      pushCell();
      continue;
    }

    if (ch === "\r") continue;

    if (ch === "\n") {
      pushRow();
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) pushRow();

  return rows;
}

export async function importClientsFromCsv(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN]);
  const maybeFile = formData.get("file");
  const file = maybeFile instanceof File ? maybeFile : null;
  const csvText =
    file && file.size > 0 ? await file.text() : (formData.get("csv") as string | null);
  if (!csvText) redirect("/clients/import?error=missing");
  const csv = z.string().trim().min(1).safeParse(csvText);
  if (!csv.success) redirect("/clients/import?error=empty");
  const rows = parseCsv(csv.data).filter((r) => r.some((c) => c.trim() !== ""));

  const header = rows[0].map((h) => h.trim());
  const expected = ["name", "email", "phone", "companyName", "npwp", "address"];
  const isHeader = expected.every((k) => header.includes(k));


  const dataRows = isHeader ? rows.slice(1) : rows;
  const index = (key: string) => (isHeader ? header.indexOf(key) : expected.indexOf(key));

  const created = [];
  for (const r of dataRows) {
    const name = (r[index("name")] ?? "").trim();
    if (!name) continue;

    const email = (r[index("email")] ?? "").trim();
    const phone = (r[index("phone")] ?? "").trim();
    const companyName = (r[index("companyName")] ?? "").trim();
    const npwp = (r[index("npwp")] ?? "").trim();
    const address = (r[index("address")] ?? "").trim();

    const c = await prisma.client.create({
      data: {
        name,
        email: emptyToNull(email),
        phone: emptyToNull(phone),
        companyName: emptyToNull(companyName),
        npwp: emptyToNull(npwp),
        address: emptyToNull(address),
      },
    });
    created.push(c);
  }

  const meta = await getRequestMeta();
  await writeAuditLog({
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.CLIENT,
    entityId: null,
    afterJson: { count: created.length },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/clients");
  redirect(`/clients?imported=${created.length}`);
}
