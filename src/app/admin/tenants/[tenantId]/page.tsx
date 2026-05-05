import { getTenantDetail, updateTenantSubscriptionManual, impersonateUser } from "@/actions/saas-admin";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Receipt, Briefcase, UserCircle, LogIn, Save } from "lucide-react";
import Link from "next/link";
import { SubscriptionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantDetail(tenantId);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm text-muted-foreground hover:underline">Dashboard Admin</Link>
            <span className="text-muted-foreground">/</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-muted-foreground">ID: {tenant.id}</p>
        </div>
        <Badge className="text-lg px-4 py-1" variant={tenant.subscription?.status === "ACTIVE" ? "success" : "secondary"}>
          {tenant.subscription?.status || "TRIAL"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pengguna</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoice</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant._count.invoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proyek</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant._count.projects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Lainnya</CardTitle>
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant._count.clients} Klien</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Pengguna</CardTitle>
              <CardDescription>Semua personil yang terdaftar di perusahaan ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                      <TableCell className="text-right">
                        <form action={async () => { "use server"; await impersonateUser(user.id); }}>
                          <Button size="sm" variant="outline">
                            <LogIn className="mr-2 h-4 w-4" />
                            Impersonate
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Aktivasi Manual</CardTitle>
              <CardDescription>Ubah status langganan secara manual.</CardDescription>
            </CardHeader>
            <form action={updateTenantSubscriptionManual}>
              <CardContent className="space-y-4">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <div className="space-y-2">
                  <Label htmlFor="status">Status Langganan</Label>
                  <Select name="status" defaultValue={tenant.subscription?.status || "TRIAL"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRIAL">TRIAL</SelectItem>
                      <SelectItem value="ACTIVE">ACTIVE (Paid)</SelectItem>
                      <SelectItem value="PAST_DUE">PAST_DUE</SelectItem>
                      <SelectItem value="CANCELED">CANCELED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Tanggal Berakhir</Label>
                  <Input 
                    id="expiresAt" 
                    name="expiresAt" 
                    type="date" 
                    defaultValue={tenant.subscription?.expiresAt ? tenant.subscription.expiresAt.toISOString().split('T')[0] : ""}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Perubahan
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
