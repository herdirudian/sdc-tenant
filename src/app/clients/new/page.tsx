import Link from "next/link";

import { createClient } from "@/actions/client";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserRole, TaxMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Client</h1>
          <p className="text-sm text-muted-foreground">Create a new client record.</p>
        </div>
        <Link href="/clients">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <form action={createClient} className="grid max-w-2xl gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Client name" required />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" name="companyName" placeholder="Company" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="npwp">NPWP</Label>
            <Input id="npwp" name="npwp" placeholder="NPWP" />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="email@company.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" placeholder="+62..." />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" placeholder="Address" />
        </div>

        <div className="rounded-xl border border-border p-4 bg-blue-50/30">
          <div className="text-sm font-semibold flex items-center gap-2 mb-3 text-blue-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold italic">%</span>
            Default Tax Settings (Template)
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="defaultTaxMethod">Default Tax Method</Label>
                <select
                  id="defaultTaxMethod"
                  name="defaultTaxMethod"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue={TaxMethod.EXCLUSIVE}
                >
                  <option value={TaxMethod.EXCLUSIVE}>EXCLUSIVE (Tax added to total)</option>
                  <option value={TaxMethod.INCLUSIVE}>INCLUSIVE (Tax included in price)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defaultPpnRate">Default PPN (%)</Label>
                <Input id="defaultPpnRate" name="defaultPpnRate" type="number" step="0.1" defaultValue="0" />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="defaultPphRate">Default PPh (%)</Label>
                <Input id="defaultPphRate" name="defaultPphRate" type="number" step="0.1" defaultValue="0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defaultPphType">Default PPh Label</Label>
                <Input id="defaultPphType" name="defaultPphType" placeholder="e.g. PPh 23" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/clients">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </div>
  );
}

