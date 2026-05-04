import Link from "next/link";
import { notFound } from "next/navigation";

import { getClientById, updateClient } from "@/actions/client";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserRole, TaxMethod } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const { clientId } = await params;
  const client = await getClientById(clientId);

  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Edit Client</h1>
          <p className="text-sm text-muted-foreground">
            Update client details.
          </p>
        </div>
        <Link href="/clients">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateClient} className="grid gap-4">
              <input type="hidden" name="id" value={client.id} />

                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={client.name}
                    required
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      defaultValue={client.companyName ?? ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="npwp">NPWP</Label>
                    <Input id="npwp" name="npwp" defaultValue={client.npwp ?? ""} />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={client.email ?? ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={client.address ?? ""}
                  />
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
                          defaultValue={client.defaultTaxMethod}
                        >
                          <option value={TaxMethod.EXCLUSIVE}>EXCLUSIVE (Tax added to total)</option>
                          <option value={TaxMethod.INCLUSIVE}>INCLUSIVE (Tax included in price)</option>
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="defaultPpnRate">Default PPN (%)</Label>
                        <Input id="defaultPpnRate" name="defaultPpnRate" type="number" step="0.1" defaultValue={(client.defaultPpnRate ?? "0").toString()} />
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="defaultPphRate">Default PPh (%)</Label>
                        <Input id="defaultPphRate" name="defaultPphRate" type="number" step="0.1" defaultValue={(client.defaultPphRate ?? "0").toString()} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="defaultPphType">Default PPh Label</Label>
                        <Input id="defaultPphType" name="defaultPphType" defaultValue={client.defaultPphType ?? ""} placeholder="e.g. PPh 23" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Link href="/clients">
                    <Button variant="outline">Cancel</Button>
                  </Link>
                  <Button type="submit">Save Changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

