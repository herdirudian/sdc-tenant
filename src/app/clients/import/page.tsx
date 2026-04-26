import Link from "next/link";

import { importClientsFromCsv } from "@/actions/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ImportClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole([UserRole.ADMIN]);
  const { error } = await searchParams;
  const message =
    error === "missing"
      ? "Upload file CSV atau isi textarea CSV."
      : error === "empty"
        ? "CSV kosong."
        : error === "invalid"
          ? "CSV tidak valid."
          : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Import Clients (CSV)</h1>
          <p className="text-sm text-muted-foreground">
            Columns: name,email,phone,companyName,npwp,address
          </p>
        </div>
        <Link href="/clients">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {message ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <form action={importClientsFromCsv} encType="multipart/form-data" className="grid max-w-3xl gap-4">
        <div className="grid gap-2">
          <Label htmlFor="file">CSV File (optional)</Label>
          <Input id="file" name="file" type="file" accept=".csv,text/csv" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="csv">CSV</Label>
          <Textarea
            id="csv"
            name="csv"
            placeholder={'name,email,phone,companyName,npwp,address\nJohn Doe,john@acme.com,+62812...,PT ACME,12.345.678.9-012.345,"Jl. Example No. 1"'}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Link href="/clients">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit">Import</Button>
        </div>
      </form>
    </div>
  );
}
