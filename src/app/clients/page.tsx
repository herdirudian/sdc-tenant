import Link from "next/link";

import { deleteClient, getClientsPaged } from "@/actions/client";
import { getSession, requireRole, requireSubscription } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRole } from "@/generated/prisma/client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; imported?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  
  await requireSubscription();
  
  const user = session.user;
  await requireRole([UserRole.ADMIN, UserRole.STAFF, UserRole.FINANCE]);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Manage client master data.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <a href="/api/export/clients" className="flex-1 sm:flex-initial">
              <Button variant="outline" className="w-full">Export CSV</Button>
            </a>
            {user.role === UserRole.ADMIN ? (
              <Link href="/clients/import" className="flex-1 sm:flex-initial">
                <Button variant="outline" className="w-full">Import CSV</Button>
              </Link>
            ) : null}
            {canWrite ? (
              <Link href="/clients/new" className="flex-1 sm:flex-initial">
                <Button className="w-full">Add Client</Button>
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

      <form method="get" className="flex flex-col sm:flex-row gap-2">
        <Input
          name="q"
          placeholder="Search name, company, email, phone, NPWP..."
          defaultValue={q ?? ""}
          className="w-full sm:flex-1"
        />
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          Search
        </Button>
      </form>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-muted-foreground/20">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Company</TableHead>
                <TableHead className="whitespace-nowrap">Email</TableHead>
                <TableHead className="whitespace-nowrap">Phone</TableHead>
                <TableHead className="w-[150px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium whitespace-nowrap">{c.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.companyName ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.email ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.phone ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-2">
                        <Link href={`/clients/${c.id}/edit`}>
                          <Button variant="outline" size="sm">Edit</Button>
                        </Link>
                        {canDelete ? (
                          <form action={deleteClient}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button variant="destructive" size="sm" type="submit">
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
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                    No clients yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div className="text-muted-foreground order-2 sm:order-1">
          Page {result.page} of {result.pageCount} • {result.total} client(s)
        </div>
        <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
          <Link href={buildHref(Math.max(1, result.page - 1))} className="flex-1 sm:flex-initial">
            <Button variant="outline" disabled={result.page <= 1} className="w-full">
              Prev
            </Button>
          </Link>
          <Link href={buildHref(Math.min(result.pageCount, result.page + 1))} className="flex-1 sm:flex-initial">
            <Button variant="outline" disabled={result.page >= result.pageCount} className="w-full">
              Next
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

