import { getAdminStats, getTenantsList, getRevenueStats, getGlobalSettings, updateGlobalSettings, getGlobalAuditLogs, getDatabaseHealth } from "@/actions/saas-admin";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { Users, Building2, CreditCard, Clock, Search, Eye, DollarSign, ArrowUpRight, History, Settings, Megaphone, ShieldAlert, ShieldCheck, Database, Server, Cpu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const stats = await getAdminStats();
  const revenue = await getRevenueStats();
  const settings = await getGlobalSettings();
  const audit = await getGlobalAuditLogs({ q, page: page ? parseInt(page) : 1 });
  const health = await getDatabaseHealth();
  const { tenants, totalPages, currentPage } = await getTenantsList({
    q,
    status,
    page: page ? parseInt(page) : 1
  });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Owner Dashboard</h1>
        <p className="text-muted-foreground">Pantau pertumbuhan dan pendapatan sistem Anda.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (Estimasi)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(revenue.mrr)}</div>
            <p className="text-xs text-muted-foreground">Pendapatan 30 hari terakhir</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Konversi Trial</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenue.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Trial menjadi Berbayar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Perusahaan</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
            <p className="text-xs text-muted-foreground">Bisnis yang terdaftar</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Langganan Aktif</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Akun berbayar saat ini</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Daftar Perusahaan</TabsTrigger>
          <TabsTrigger value="revenue">Riwayat Pendapatan</TabsTrigger>
          <TabsTrigger value="audit">Log Aktivitas Global</TabsTrigger>
          <TabsTrigger value="health">Kesehatan Sistem</TabsTrigger>
          <TabsTrigger value="settings">Kendali Sistem</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Semua Tenant</CardTitle>
                  <CardDescription>Kelola dan pantau semua perusahaan terdaftar.</CardDescription>
                </div>
                <form className="flex items-center gap-2">
                  <Select name="status" defaultValue={status || "ALL"}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua Status</SelectItem>
                      <SelectItem value="TRIAL">TRIAL</SelectItem>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="PAST_DUE">PAST DUE</SelectItem>
                      <SelectItem value="CANCELED">CANCELED</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      name="q"
                      placeholder="Cari perusahaan..."
                      className="pl-8 w-[200px]"
                      defaultValue={q}
                    />
                  </div>
                  <Button type="submit">Filter</Button>
                </form>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Perusahaan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Tgl Daftar</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.subscription?.status === "ACTIVE" ? "success" : "secondary"}>
                          {tenant.subscription?.status || "TRIAL"}
                        </Badge>
                      </TableCell>
                      <TableCell>{tenant._count.users} User</TableCell>
                      <TableCell>{formatDateID(tenant.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/tenants/${tenant.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Riwayat Transaksi</CardTitle>
                  <CardDescription>Semua upaya pembayaran langganan sistem melalui Xendit.</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">Total Pendapatan</div>
                  <div className="text-2xl font-bold text-primary">{formatIDR(revenue.totalRevenue)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Perusahaan</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.subscription.tenant.name}
                      </TableCell>
                      <TableCell>{formatIDR(payment.amount)}</TableCell>
                      <TableCell className="uppercase">{payment.method || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={
                          payment.status === "PAID" ? "success" : 
                          payment.status === "PENDING" ? "secondary" : "destructive"
                        }>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateID(payment.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {revenue.recentPayments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Belum ada riwayat transaksi.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Global Audit Log</CardTitle>
                  <CardDescription>Pantau seluruh aktivitas pengguna di semua perusahaan.</CardDescription>
                </div>
                <form className="flex items-center gap-2">
                  <Input name="q" placeholder="Cari email/user/ID..." defaultValue={q} className="w-[250px]" />
                  <Button type="submit">Cari</Button>
                </form>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Perusahaan</TableHead>
                    <TableHead>Aktor</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>Entitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateID(log.createdAt)}</TableCell>
                      <TableCell className="font-medium text-xs">{log.tenant.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>{log.actorUser.name}</span>
                          <span className="text-muted-foreground">{log.actorUser.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{log.entityType}</span>
                        <span className="ml-2 text-muted-foreground">({log.entityId.substring(0, 8)}...)</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Server Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.floor(health.uptime / 3600)} jam</div>
                <p className="text-xs text-muted-foreground">Sejak terakhir restart</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory RSS</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{health.memory.rss} MB</div>
                <p className="text-xs text-muted-foreground">Penggunaan RAM Fisik</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Heap Used</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{health.memory.heapUsed} MB</div>
                <p className="text-xs text-muted-foreground">Dari total {health.memory.heapTotal} MB</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Statistik Tabel Database</CardTitle>
              </div>
              <CardDescription>Ukuran dan jumlah baris data per tabel di MySQL.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Tabel</TableHead>
                    <TableHead>Jumlah Baris (Estimasi)</TableHead>
                    <TableHead className="text-right">Ukuran (MB)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.tableStats.map((table: any) => (
                    <TableRow key={table.tableName}>
                      <TableCell className="font-mono font-medium">{table.tableName}</TableCell>
                      <TableCell>{table.rowCount.toString()}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{table.sizeMB.toString()} MB</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-destructive/20">
              <CardHeader className="bg-destructive/5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <CardTitle>Mode Perawatan (Maintenance)</CardTitle>
                </div>
                <CardDescription>Matikan akses sistem untuk seluruh pengguna publik.</CardDescription>
              </CardHeader>
              <form action={updateGlobalSettings}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="maintenanceMode" name="maintenanceMode" defaultChecked={settings.maintenanceMode} />
                    <Label htmlFor="maintenanceMode" className="font-bold text-destructive">Aktifkan Mode Perawatan</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Saat aktif, hanya akun System Owner yang bisa masuk. Pengguna lain akan melihat halaman pengumuman.</p>
                </CardContent>
                <CardFooter className="bg-muted/30 pt-4">
                  <Button type="submit" variant="destructive">Simpan Status</Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <CardTitle>Paket & Harga</CardTitle>
                </div>
                <CardDescription>Atur tarif langganan dan masa trial global.</CardDescription>
              </CardHeader>
              <form action={updateGlobalSettings}>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="subscriptionPrice">Harga Langganan (IDR / Bulan)</Label>
                    <Input id="subscriptionPrice" name="subscriptionPrice" type="number" defaultValue={settings.subscriptionPrice.toString()} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="trialDays">Durasi Masa Trial (Hari)</Label>
                    <Input id="trialDays" name="trialDays" type="number" defaultValue={settings.trialDays.toString()} />
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 pt-4">
                  <Button type="submit">Update Harga</Button>
                </CardFooter>
              </form>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-orange-500" />
                  <CardTitle>Pengumuman Global (Broadcast)</CardTitle>
                </div>
                <CardDescription>Munculkan banner informasi di dashboard seluruh pengguna.</CardDescription>
              </CardHeader>
              <form action={updateGlobalSettings}>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="announcementTitle">Judul Pengumuman</Label>
                    <Input id="announcementTitle" name="announcementTitle" placeholder="Contoh: Pemeliharaan Sistem Mendatang" defaultValue={settings.announcementTitle || ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="announcementText">Pesan Lengkap</Label>
                    <Textarea id="announcementText" name="announcementText" placeholder="Tuliskan detail pengumuman di sini..." className="min-h-[100px]" defaultValue={settings.announcementText || ""} />
                  </div>
                  <p className="text-xs text-muted-foreground italic">Kosongkan judul untuk menyembunyikan pengumuman dari dashboard pengguna.</p>
                </CardContent>
                <CardFooter className="bg-muted/30 pt-4">
                  <Button type="submit">Siarkan Pengumuman</Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
