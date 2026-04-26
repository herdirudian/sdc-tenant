import Link from "next/link";

import { getClients } from "@/actions/client";
import { createProject } from "@/actions/project";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectStatus, UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New Project</h1>
          <p className="text-sm text-muted-foreground">Create a new project.</p>
        </div>
        <Link href="/projects">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <form action={createProject} className="grid max-w-2xl gap-4">
        <div className="grid gap-2">
          <Label htmlFor="clientId">Client</Label>
          <select
            id="clientId"
            name="clientId"
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={clients[0]?.id ?? ""}
          >
            {clients.length === 0 ? (
              <option value="" disabled>
                Create a client first
              </option>
            ) : null}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName ? `${c.companyName} — ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Project Name</Label>
          <Input id="name" name="name" placeholder="e.g. Website Revamp" required />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={ProjectStatus.LEAD}
            >
              <option value={ProjectStatus.LEAD}>LEAD</option>
              <option value={ProjectStatus.ONGOING}>ONGOING</option>
              <option value={ProjectStatus.COMPLETED}>COMPLETED</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="totalValue">Total Value</Label>
            <Input id="totalValue" name="totalValue" inputMode="decimal" placeholder="10000000" required />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" placeholder="Scope, milestones, notes..." />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/projects">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={clients.length === 0}>
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}
