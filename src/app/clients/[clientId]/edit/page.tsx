import Link from "next/link";
import { notFound } from "next/navigation";

import { getClientById, updateClient } from "@/actions/client";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserRole } from "@/generated/prisma/client";
import { PortalManager } from "@/components/portal-manager";
import { headers } from "next/headers";

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

  // Determine base URL for portal links
  const host = (await headers()).get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Edit Client</h1>
          <p className="text-sm text-muted-foreground">
            Update client details and manage portal access.
          </p>
        </div>
        <Link href="/clients">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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

        <div>
          <PortalManager 
            clientId={client.id} 
            initialToken={client.portalToken} 
            baseUrl={baseUrl} 
          />
        </div>
      </div>
    </div>
  );
}

