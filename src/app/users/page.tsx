import Link from "next/link";

import { createUser, listUsers, resetUserPassword, setUserActive, updateUserRole } from "@/actions/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
}) {
  await requireRole([UserRole.ADMIN]);
  const { error, created, updated } = await searchParams;
  const users = await listUsers();

  const message =
    error === "invalid"
      ? "Input tidak valid."
      : error === "duplicate"
        ? "Email sudah terdaftar."
        : created === "1"
          ? "User berhasil dibuat."
          : updated === "1"
            ? "Perubahan berhasil disimpan."
            : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Buat user baru, set role, reset password, dan disable user.</p>
        </div>
        <Link href="/">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {message ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create User</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUser} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="user@sdc.co.id" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Nama User" required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue={UserRole.STAFF}
                >
                  <option value={UserRole.ADMIN}>ADMIN</option>
                  <option value={UserRole.FINANCE}>FINANCE</option>
                  <option value={UserRole.STAFF}>STAFF</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password (min 6)</Label>
                <Input id="password" name="password" type="password" required />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            {users.map((u) => (
              <div key={u.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{u.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{u.role}</Badge>
                      {u.isActive ? <Badge variant="success">ACTIVE</Badge> : <Badge variant="danger">DISABLED</Badge>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:w-[420px]">
                    <form action={updateUserRole} className="flex gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="role"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        defaultValue={u.role}
                      >
                        <option value={UserRole.ADMIN}>ADMIN</option>
                        <option value={UserRole.FINANCE}>FINANCE</option>
                        <option value={UserRole.STAFF}>STAFF</option>
                      </select>
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                    </form>

                    <form action={setUserActive} className="flex gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="isActive" value={u.isActive ? "false" : "true"} />
                      <Button type="submit" variant={u.isActive ? "destructive" : "outline"} className="w-full">
                        {u.isActive ? "Disable User" : "Enable User"}
                      </Button>
                    </form>

                    <form action={resetUserPassword} className="flex gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <Input name="password" type="text" placeholder="New password (min 6)" required />
                      <Button type="submit" variant="outline">
                        Reset
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))}

            {users.length === 0 ? (
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                No users yet.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

