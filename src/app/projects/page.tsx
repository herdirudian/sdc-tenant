import Link from "next/link";

import { getProjects, deleteProject } from "@/actions/project";
import { requireRole, requireSubscription } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import { ProjectStatus, UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function statusBadge(status: ProjectStatus) {
  if (status === ProjectStatus.COMPLETED) return <Badge variant="success">COMPLETED</Badge>;
  if (status === ProjectStatus.ONGOING) return <Badge variant="secondary">ONGOING</Badge>;
  return <Badge variant="muted">LEAD</Badge>;
}

export default async function ProjectsPage() {
  await requireSubscription();
  await requireRole([UserRole.ADMIN, UserRole.STAFF]);
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Track leads, ongoing work, and completed delivery.</CardDescription>
          </div>
          <Link href="/projects/new">
            <Button>Create Project</Button>
          </Link>
        </div>
      </CardHeader>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total Value</TableHead>
            <TableHead>Invoices</TableHead>
            <TableHead className="w-[260px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <Link className="hover:underline" href={`/projects/${p.id}`}>
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>{p.client.companyName ?? p.client.name}</TableCell>
              <TableCell>{statusBadge(p.status)}</TableCell>
              <TableCell>{formatIDR(p.totalValue.toString())}</TableCell>
              <TableCell>{p._count.invoices}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/projects/${p.id}`}>
                    <Button variant="outline">View</Button>
                  </Link>
                  <Link href={`/projects/${p.id}/edit`}>
                    <Button variant="outline">Edit</Button>
                  </Link>
                  <form action={deleteProject}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button variant="destructive" type="submit">
                      Delete
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                No projects yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
