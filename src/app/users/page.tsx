import Link from "next/link";

import {
  createUser,
  inviteUser,
  listInvitations,
  listUsers,
  resetUserPassword,
  revokeInvitation,
  setUserActive,
  updateUserRole,
} from "@/actions/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole, requireSubscription } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { Mail, Trash2, UserPlus, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; updated?: string; invited?: string }>;
}) {
  await requireSubscription();
  await requireRole([UserRole.ADMIN]);
  const { error, created, updated, invited } = await searchParams;
  const users = await listUsers();
  const invitations = await listInvitations();

  const message =
    error === "invalid"
      ? "Input tidak valid."
      : error === "duplicate"
        ? "Email sudah terdaftar sebagai user."
        : error === "already_user"
          ? "Email ini sudah terdaftar di sistem."
          : created === "1"
            ? "User berhasil dibuat."
            : updated === "1"
              ? "Perubahan berhasil disimpan."
              : invited === "1"
                ? "Undangan berhasil dikirim via email."
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
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteUser} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input id="invite-email" name="email" type="email" placeholder="staff@company.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  name="role"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue={UserRole.STAFF}
                >
                  <option value={UserRole.ADMIN}>ADMIN (Full Access)</option>
                  <option value={UserRole.FINANCE}>FINANCE (Billing & Reports)</option>
                  <option value={UserRole.STAFF}>STAFF (Clients & Invoices)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Send Invitation</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{inv.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{inv.role}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <form action={async () => {
                    "use server";
                    await revokeInvitation(inv.id);
                  }}>
                    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Team Members
          </CardTitle>
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

