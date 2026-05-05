import Link from "next/link";

import { redirect } from "next/navigation";
import { getDashboardData } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIDR } from "@/lib/format";
import { getSession, requireRole, requireSubscription } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/enums";
import { formatDateID } from "@/lib/format";
import { getGlobalSettings } from "@/actions/saas-admin";
import { Megaphone, Info } from "lucide-react";
import { ArrowUpRight, Receipt, Wallet, Landmark, Bell, TrendingUp, TrendingDown, CircleDollarSign, Briefcase } from "lucide-react";
import { SimpleBarChart } from "@/components/dashboard-charts";
import { SyncPaidInvoicesButton } from "@/components/sync-paid-invoices-button";
import { LandingPage } from "@/components/landing-page";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { SubscriptionBanner } from "@/components/subscription-banner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tenantInfo = await requireSubscription();
  const user = session.user;
  
  const [data, settings] = await Promise.all([
    getDashboardData(),
    getGlobalSettings(),
  ]);
  const summary = data.summary;
  const subscription = tenantInfo.subscription;

  const canCreateClient = user.role === UserRole.ADMIN || user.role === UserRole.STAFF;
  const canCreateInvoice = user.role === UserRole.ADMIN || user.role === UserRole.FINANCE;

  return (
    <div className="space-y-8">
      {subscription && (
        <SubscriptionBanner 
          status={subscription.status} 
          expiresAt={subscription.expiresAt} 
        />
      )}

      {settings.announcementTitle && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:bg-orange-950/20 dark:border-orange-900/50">
          <div className="flex items-start gap-3">
            <Megaphone className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-orange-900 dark:text-orange-400">{settings.announcementTitle}</h3>
              <p className="text-sm text-orange-800/80 dark:text-orange-300/70">{settings.announcementText}</p>
            </div>
          </div>
        </div>
      )}

      <OnboardingBanner onboarding={data.onboarding} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            {subscription && (
              <Badge variant={subscription.status === "ACTIVE" ? "default" : "outline"} className={subscription.status === "TRIAL" ? "bg-amber-100 text-amber-700 border-amber-200" : ""}>
                {subscription.status === "TRIAL" ? "Trial" : "Premium"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Overview ringkas untuk operasional finance dan project.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {canCreateInvoice ? (
            <div className="col-span-2 sm:col-auto">
              <SyncPaidInvoicesButton />
            </div>
          ) : null}
          {canCreateClient ? (
            <Link href="/clients/new" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">Add Client</Button>
            </Link>
          ) : null}
          {canCreateInvoice ? (
            <Link href="/invoices/new" className="w-full sm:w-auto">
              <Button className="w-full">Create Invoice</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs sm:text-sm">Total Revenue</CardDescription>
                <CardTitle className="text-lg sm:text-xl">{formatIDR(summary.totalRevenue)}</CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-1.5 sm:p-2 shrink-0">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 text-[10px] sm:text-xs text-muted-foreground">
            Total pendapatan dari invoice PAID.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs sm:text-sm">Net Profit</CardDescription>
                <CardTitle className={`text-lg sm:text-xl ${Number(summary.netProfit) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatIDR(summary.netProfit)}
                </CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-1.5 sm:p-2 shrink-0">
                <CircleDollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 text-[10px] sm:text-xs text-muted-foreground">
            Revenue dikurangi total pengeluaran.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs sm:text-sm">Pending Payments</CardDescription>
                <CardTitle className="text-lg sm:text-xl">{formatIDR(summary.pendingPayments)}</CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-1.5 sm:p-2 shrink-0">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 text-[10px] sm:text-xs text-muted-foreground">
            Total tagihan yang belum dibayar (UNPAID).
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Active Projects</CardDescription>
                <CardTitle className="text-xl">{summary.activeProjects}</CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Proyek dengan status ONGOING.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Tax to Pay (This Month)</CardDescription>
                <CardTitle className="text-xl">{formatIDR(summary.taxToPayThisMonth)}</CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-2">
                <Landmark className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            PPh Final dari invoice yang dibayar bulan ini.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs sm:text-sm">Total Tax (PPh)</CardDescription>
                <CardTitle className="text-lg sm:text-xl">{formatIDR(summary.totalTaxToPay)}</CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-1.5 sm:p-2 shrink-0">
                <Landmark className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 text-[10px] sm:text-xs text-muted-foreground">
            Total PPh Final yang belum disetor (semua periode).
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs sm:text-sm">Total Expenses</CardDescription>
                <CardTitle className="text-lg sm:text-xl">{formatIDR(summary.totalExpenses)}</CardTitle>
              </div>
              <div className="rounded-xl border border-border bg-muted p-1.5 sm:p-2 shrink-0">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 text-[10px] sm:text-xs text-muted-foreground">
            Total seluruh pengeluaran operasional.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aging Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "0-30d", val: summary.agingSummary["0-30"], color: "bg-muted" },
              { label: "31-60d", val: summary.agingSummary["31-60"], color: "bg-secondary" },
              { label: "61-90d", val: summary.agingSummary["61-90"], color: "bg-amber-500" },
              { label: "90d+", val: summary.agingSummary["90+"], color: "bg-destructive" },
            ].map((b) => (
              <div key={b.label} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1">
                  <div className={`h-1.5 w-1.5 rounded-full ${b.color}`} />
                  <span className="text-muted-foreground">{b.label}</span>
                </div>
                <span className="font-medium">{formatIDR(b.val)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Financial Trend</CardTitle>
                <CardDescription>Income vs Expense (6 Months)</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-green-500" />
                  <span>Income</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded-sm bg-red-500" />
                  <span>Expense</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={data.monthlyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
            <CardDescription>Top pengeluaran per kategori.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.expenseBreakdown.slice(0, 5).map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{item.category}</span>
                  <span>{formatIDR(item.amount)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-red-500" 
                    style={{ 
                      width: `${(Number(item.amount) / Number(summary.totalExpenses)) * 100}%` 
                    }} 
                  />
                </div>
              </div>
            ))}
            {summary.expenseBreakdown.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada data pengeluaran.</p>
            )}
            {summary.expenseBreakdown.length > 5 && (
              <Link href="/expenses">
                <Button variant="link" size="sm" className="w-full text-xs text-muted-foreground">
                  Lihat Semua Pengeluaran
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">Recent Invoices</CardTitle>
                <CardDescription className="text-xs truncate">Invoice terbaru.</CardDescription>
              </div>
              <Link href="/invoices" className="shrink-0">
                <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                  See all <ArrowUpRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px] px-2 sm:px-3 sm:w-auto">Invoice</TableHead>
                    <TableHead className="px-2 sm:px-3">Client</TableHead>
                    <TableHead className="text-right px-2 sm:px-3">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium px-2 py-3 sm:px-3">
                        <Link className="hover:underline block truncate max-w-[110px] sm:max-w-none" href={`/invoices/${inv.id}`}>
                          {inv.invoiceNumber}
                        </Link>
                        <div className="text-[10px] text-muted-foreground">{formatDateID(inv.createdAt)}</div>
                      </TableCell>
                      <TableCell className="px-2 py-3 sm:px-3">
                        <div className="text-xs sm:text-sm line-clamp-2 sm:line-clamp-none">
                          {inv.client.companyName ?? inv.client.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap px-2 py-3 sm:px-3">
                        <div className="text-xs sm:text-sm font-semibold">
                          {formatIDR(inv.amountBruto.toString())}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="h-8 w-8 text-muted-foreground/50" />
                          <div className="text-sm font-medium text-muted-foreground">Belum ada invoice.</div>
                          {canCreateInvoice && (
                            <Link href="/invoices/new">
                              <Button variant="link" size="sm" className="h-8">Buat invoice pertama Anda</Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">Notifications</CardTitle>
                  <CardDescription className="text-xs truncate">Reminder finance ops.</CardDescription>
                </div>
                <Link href="/collections" className="shrink-0">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                    Open <ArrowUpRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 sm:p-6">
              {data.notifications.map((n) => (
                <Link key={n.key} href={n.href} className="rounded-xl border border-border p-2 sm:p-3 hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="rounded-lg border border-border bg-muted p-1.5 sm:p-2 shrink-0">
                        <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      </div>
                      <div className="text-xs sm:text-sm font-medium truncate">{n.label}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{n.count}</Badge>
                  </div>
                </Link>
              ))}
              {data.notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <div className="text-sm font-medium text-muted-foreground">Tidak ada notifikasi</div>
                  <p className="text-[10px] text-muted-foreground/70">Semua pekerjaan Anda sudah up-to-date.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">Activity</CardTitle>
                  <CardDescription className="text-xs truncate">Audit trail ringkas.</CardDescription>
                </div>
                <Link href="/audit-log" className="shrink-0">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3">
                    Open <ArrowUpRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 sm:p-6">
              {data.recentActivity.slice(0, 5).map((l) => (
                <div key={l.id} className="rounded-xl border border-border p-2 sm:p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary" className="text-[9px] sm:text-[10px]">{l.action}</Badge>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground">{formatDateID(l.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-[11px] sm:text-xs truncate font-medium">
                    {l.actorUser ? `${l.actorUser.name}` : "-"}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                    {l.entityType} • {l.entityId ?? "-"}
                  </div>
                </div>
              ))}
              {data.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
                  <Info className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <div className="text-sm font-medium text-muted-foreground">Belum ada aktivitas</div>
                  <p className="text-[10px] text-muted-foreground/70">Aktivitas sistem Anda akan muncul di sini.</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
