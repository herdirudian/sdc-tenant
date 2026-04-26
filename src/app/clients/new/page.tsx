import Link from "next/link";

import { createClient } from "@/actions/client";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserRole } from "@/generated/prisma/client";

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

