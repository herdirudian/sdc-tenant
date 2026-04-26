import Link from "next/link";

import { deleteClient, getClientsPaged } from "@/actions/client";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; imported?: string }>;
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.STAFF, UserRole.FINANCE]);
  const { q, page, imported } = await searchParams;
  const pageNumber = page ? Number(page) : 1;
  const result = await getClientsPaged({ q, page: Number.isFinite(pageNumber) ? pageNumber : 1 });
  const clients = result.items;
  const canWrite = user.role === UserRole.ADMIN || user.role === UserRole.STAFF;
  const canDelete = user.role === UserRole.ADMIN;
  const importedCount = imported ? Number(imported) : null;

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    return `/clients?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Manage client master data.</CardDescription>
          </div>
          <div className="flex gap-2">
            <a href="/api/export/clients">
              <Button variant="outline">Export CSV</Button>
            </a>
            {user.role === UserRole.ADMIN ? (
              <Link href="/clients/import">
                <Button variant="outline">Import CSV</Button>
              </Link>
            ) : null}
            {canWrite ? (
              <Link href="/clients/new">
                <Button>Add Client</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </CardHeader>

      {typeof importedCount === "number" && Number.isFinite(importedCount) ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          Imported {importedCount} client(s).
        </div>
      ) : null}

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          placeholder="Search name, company, email, phone, NPWP..."
          defaultValue={q ?? ""}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="w-[200px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.companyName ?? "-"}</TableCell>
              <TableCell>{c.email ?? "-"}</TableCell>
              <TableCell>{c.phone ?? "-"}</TableCell>
              <TableCell className="text-right">
                {canWrite ? (
                  <div className="flex justify-end gap-2">
                    <Link href={`/clients/${c.id}/edit`}>
                      <Button variant="outline">Edit</Button>
                    </Link>
                    {canDelete ? (
                      <form action={deleteClient}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button variant="destructive" type="submit">
                          Delete
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No clients yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Page {result.page} of {result.pageCount} • {result.total} client(s)
        </div>
        <div className="flex gap-2">
          <Link href={buildHref(Math.max(1, result.page - 1))}>
            <Button variant="outline" disabled={result.page <= 1}>
              Prev
            </Button>
          </Link>
          <Link href={buildHref(Math.min(result.pageCount, result.page + 1))}>
            <Button variant="outline" disabled={result.page >= result.pageCount}>
              Next
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

