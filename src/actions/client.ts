"use server";

import { prisma } from "@/lib/prisma";
import { getRequestMeta, requireRole, requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { AuditAction, AuditEntityType, UserRole, TaxMethod, Prisma } from "@prisma/client";
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
  defaultTaxMethod: z.nativeEnum(TaxMethod).default(TaxMethod.EXCLUSIVE),
  defaultPpnRate: z.string().transform((v) => new Prisma.Decimal(v || "0")),
  defaultPphRate: z.string().transform((v) => new Prisma.Decimal(v || "0")),
  defaultPphType: z.string().trim().optional().or(z.literal("")),
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
    defaultTaxMethod: formData.get("defaultTaxMethod"),
    defaultPpnRate: formData.get("defaultPpnRate"),
    defaultPphRate: formData.get("defaultPphRate"),
    defaultPphType: formData.get("defaultPphType"),
  });

  if (!parsed.success) {
    redirect(`/clients/new?error=invalid`);
  }

  const data = parsed.data;

  const created = await prisma.client.create({
    data: {
      tenantId: actor.tenantId,
      name: data.name,
      email: emptyToNull(data.email === "" ? undefined : data.email),
      phone: emptyToNull(data.phone === "" ? undefined : data.phone),
      companyName: emptyToNull(data.companyName === "" ? undefined : data.companyName),
      npwp: emptyToNull(data.npwp === "" ? undefined : data.npwp),
      address: emptyToNull(data.address === "" ? undefined : data.address),
      defaultTaxMethod: data.defaultTaxMethod,
      defaultPpnRate: data.defaultPpnRate,
      defaultPphRate: data.defaultPphRate,
      defaultPphType: emptyToNull(data.defaultPphType === "" ? undefined : data.defaultPphType),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
    actorUserId: actor.id,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.CLIENT,
    entityId: created.id,
    afterJson: created as any,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${created.id}/edit`);
  redirect("/clients");
}

export async function updateClient(formData: FormData) {
  const actor = await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const id = z.string().min(1).parse(formData.get("id"));

  const before = await prisma.client.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!before) redirect("/clients?error=not_found");

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    companyName: formData.get("companyName"),
    npwp: formData.get("npwp"),
    address: formData.get("address"),
    defaultTaxMethod: formData.get("defaultTaxMethod"),
    defaultPpnRate: formData.get("defaultPpnRate"),
    defaultPphRate: formData.get("defaultPphRate"),
    defaultPphType: formData.get("defaultPphType"),
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
      defaultTaxMethod: data.defaultTaxMethod,
      defaultPpnRate: data.defaultPpnRate,
      defaultPphRate: data.defaultPphRate,
      defaultPphType: emptyToNull(data.defaultPphType === "" ? undefined : data.defaultPphType),
    },
  });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
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

  const before = await prisma.client.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!before) redirect("/clients?error=not_found");
  
  await prisma.client.delete({ where: { id } });

  const meta = await getRequestMeta();
  await writeAuditLog({
    tenantId: actor.tenantId,
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
  const user = await requireUser();
  return prisma.client.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getClientsPaged(input: {
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const user = await requireUser();
  const tenantId = user.tenantId;
  const q = input.q?.trim();
  const pageSize = input.pageSize ?? 20;
  const page = input.page ?? 1;
  const skip = Math.max(0, (page - 1) * pageSize);

  const where: any = { tenantId };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { companyName: { contains: q } },
      { npwp: { contains: q } },
    ];
  }

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
  const user = await requireUser();
  return prisma.client.findFirst({ where: { id, tenantId: user.tenantId } });
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
        tenantId: actor.tenantId,
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
    tenantId: actor.tenantId,
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
