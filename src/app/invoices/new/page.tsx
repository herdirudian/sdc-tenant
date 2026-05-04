import Link from "next/link";

import { getClients } from "@/actions/client";
import { createInvoice } from "@/actions/invoice";
import { getProjects } from "@/actions/project";
import { getCompanySettings } from "@/actions/settings";
import { InvoiceItemsEditor } from "@/components/invoice-items-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth";
import { InvoiceTemplate, InvoiceType, UserRole, TaxMethod } from "@/generated/prisma/client";
import { InvoiceTaxSection } from "./invoice-tax-section";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; error?: string }>;
}) {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);
  const { projectId, error } = await searchParams;
  const clients = await getClients();
  const projects = await getProjects();
  const settings = await getCompanySettings();
  const activeBanks = settings.bankAccounts.filter((b) => b.isActive);
  const selectedProject = projectId ? projects.find((p) => p.id === projectId) : null;
  const defaultClientId = selectedProject?.clientId ?? clients[0]?.id ?? "";
  const message =
    error === "invalid"
      ? "Input tidak valid. Silakan cek lagi."
      : error === "numbering"
        ? "Nomor invoice sedang digunakan. Silakan submit ulang."
        : null;

  const sanitizedClients = clients.map(c => ({
    id: c.id,
    name: c.name,
    companyName: c.companyName,
    defaultTaxMethod: c.defaultTaxMethod || "EXCLUSIVE",
    defaultPpnRate: (c.defaultPpnRate ?? "0").toString(),
    defaultPphRate: (c.defaultPphRate ?? "0").toString(),
    defaultPphType: c.defaultPphType,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Sistem invoice profesional dengan dukungan multi-pajak dan E-Faktur.
          </p>
        </div>
        <Link href="/invoices">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {message ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <form action={createInvoice} className="grid max-w-2xl gap-4">
        <div className="rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Template & Reference</div>
          <div className="mt-3 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="template">Template</Label>
                <select
                  id="template"
                  name="template"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue={InvoiceTemplate.DEFAULT}
                >
                  <option value={InvoiceTemplate.DEFAULT}>DEFAULT</option>
                  <option value={InvoiceTemplate.MODERN}>MODERN</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="poReference">PO / Reference (optional)</Label>
                <Input id="poReference" name="poReference" placeholder="PO-123 / Kontrak-01" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms">Terms (optional)</Label>
              <Textarea id="terms" name="terms" defaultValue={settings.invoiceTerms ?? ""} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="footer">Footer (optional)</Label>
              <Textarea id="footer" name="footer" defaultValue={settings.invoiceFooter ?? ""} />
            </div>
          </div>
        </div>

        <InvoiceTaxSection 
          clients={sanitizedClients} 
          initialClientId={defaultClientId} 
        />

        <div className="grid gap-2">
          <Label htmlFor="projectId">Project (optional)</Label>
          <select
            id="projectId"
            name="projectId"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={selectedProject?.id ?? ""}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.client.companyName ?? p.client.name} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={InvoiceType.PROFESSIONAL}
            >
              <option value={InvoiceType.PROFESSIONAL}>PROFESSIONAL</option>
              <option value={InvoiceType.SIMPLE}>SIMPLE</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" name="dueDate" type="date" />
          </div>
        </div>

        <InvoiceItemsEditor />

        <label className="flex items-start gap-3 rounded-lg border border-border p-4">
          <input
            type="checkbox"
            name="isDeductedByClient"
            className="mt-1 h-4 w-4 accent-primary"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight">
              Tax is deducted by client
            </div>
            <div className="text-sm text-muted-foreground">
              If enabled, client pays net of 0.5% tax. If disabled, you pay the tax manually.
            </div>
          </div>
        </label>

        <div className="rounded-xl border border-border p-4">
          <div className="text-sm font-semibold">Bank Accounts (shown on invoice)</div>
          <div className="mt-2 grid gap-3 text-sm text-muted-foreground">
            {activeBanks.map((b) => (
              <label key={b.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  name="bankAccountIds"
                  value={b.id}
                  defaultChecked
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div className="min-w-0">
                  <div className="text-foreground">{b.label}</div>
                  <div className="text-sm text-muted-foreground">{b.accountName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{b.accountNumber}</div>
                </div>
              </label>
            ))}
            {activeBanks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No active bank accounts. Configure in{" "}
                <Link className="underline" href="/settings">
                  Settings
                </Link>
                .
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/invoices">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={clients.length === 0}>
            Generate
          </Button>
        </div>
      </form>
    </div>
  );
}

