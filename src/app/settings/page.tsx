import { createBankAccount, deleteBankAccount, getCompanySettings, testSmtpSettings, toggleBankAccount, updateCompanySettings, updateSmtpSettings } from "@/actions/settings";
import { createSubscriptionInvoice } from "@/actions/subscription";
import { requireTenant, requireSubscription } from "@/lib/auth";
import { getGlobalSettings } from "@/actions/saas-admin";
import { formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmailOutboxStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string; saved?: string; smtpTest?: string; sub?: string }>;
}) {
  await requireSubscription();
  const { tenantId, user, subscription } = await requireTenant();
  if (user.role !== UserRole.ADMIN) redirect("/");

  const { error, msg, saved, smtpTest, sub } = await searchParams;
  const settings = await getCompanySettings();
  const globalSettings = await getGlobalSettings();

  const outboxStats = await prisma.emailOutbox.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: true,
  });

  const recentFailures = await prisma.emailOutbox.findMany({
    where: { status: EmailOutboxStatus.FAILED, tenantId },
    orderBy: { lastAttemptAt: "desc" },
    take: 5,
  });

  const message =
    sub === "success"
      ? "Pembayaran langganan berhasil! Status akan segera diperbarui."
      : sub === "failed"
        ? "Pembayaran langganan gagal atau dibatalkan."
        : saved === "smtp"
      ? "SMTP settings saved."
      : smtpTest === "ok"
        ? "SMTP test email sent."
        : error === "smtp_test"
          ? `SMTP test failed: ${msg ?? "unknown"}`
          : error === "missing_encryption_key"
            ? "APP_ENCRYPTION_KEY belum di-set. Tambahkan env APP_ENCRYPTION_KEY (base64 32 bytes) lalu restart server."
            : error === "invalid_encryption_key"
              ? "APP_ENCRYPTION_KEY tidak valid. Harus base64 dari 32 bytes."
              : error === "smtp_save"
                ? `Gagal menyimpan SMTP: ${msg ?? "unknown"}`
          : error === "invalid"
            ? "Input tidak valid."
            : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company identity, billing defaults, and bank accounts.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Status langganan sistem Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <div className="text-sm font-medium">Status Langganan</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={subscription?.status === "ACTIVE" ? "success" : "secondary"}>
                  {subscription?.status || "TRIAL"}
                </Badge>
                {subscription?.expiresAt && (
                  <span className="text-xs text-muted-foreground">
                    Berakhir pada {subscription.expiresAt.toLocaleDateString("id-ID")}
                  </span>
                )}
              </div>
            </div>
            {subscription?.status !== "ACTIVE" && (
              <form action={createSubscriptionInvoice}>
                <Button type="submit">Bayar Langganan ({formatIDR(Number(globalSettings.subscriptionPrice))} / bln)</Button>
              </form>
            )}
            {subscription?.status === "ACTIVE" && (
              <form action={createSubscriptionInvoice}>
                <Button type="submit" variant="outline">Perpanjang Langganan ({formatIDR(Number(globalSettings.subscriptionPrice))})</Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Used for invoice header and signature.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCompanySettings} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                name="companyName"
                defaultValue={settings.companyName}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="npwp">NPWP</Label>
                <Input id="npwp" name="npwp" defaultValue={settings.npwp ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defaultDueDays">Default Due Days</Label>
                <Input
                  id="defaultDueDays"
                  name="defaultDueDays"
                  inputMode="numeric"
                  defaultValue={String(settings.defaultDueDays)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" defaultValue={settings.address ?? ""} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" name="logoUrl" defaultValue={settings.logoUrl ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logoFile">Upload Logo</Label>
                <Input id="logoFile" name="logoFile" type="file" accept="image/*" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="signatureUrl">Signature URL</Label>
                <Input id="signatureUrl" name="signatureUrl" defaultValue={settings.signatureUrl ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="signatureFile">Upload Signature Image</Label>
                <Input id="signatureFile" name="signatureFile" type="file" accept="image/*" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="signatureName">Signature Name</Label>
                <Input
                  id="signatureName"
                  name="signatureName"
                  defaultValue={settings.signatureName ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="signatureTitle">Signature Title</Label>
                <Input
                  id="signatureTitle"
                  name="signatureTitle"
                  defaultValue={settings.signatureTitle ?? ""}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoiceTerms">Default Invoice Terms</Label>
              <Textarea id="invoiceTerms" name="invoiceTerms" defaultValue={settings.invoiceTerms ?? ""} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoiceFooter">Default Invoice Footer</Label>
              <Textarea id="invoiceFooter" name="invoiceFooter" defaultValue={settings.invoiceFooter ?? ""} />
            </div>

            <div className="flex justify-end">
              <Button type="submit">Save Settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email (SMTP)</CardTitle>
          <CardDescription>Dipakai untuk kirim invoice email + reminder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={updateSmtpSettings} className="grid gap-4 rounded-xl border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="smtpHost">SMTP Host</Label>
                <Input id="smtpHost" name="smtpHost" defaultValue={settings.smtpHost ?? ""} placeholder="smtp.gmail.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input id="smtpPort" name="smtpPort" inputMode="numeric" defaultValue={settings.smtpPort ? String(settings.smtpPort) : ""} placeholder="587" required />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="smtpUser">SMTP User</Label>
                <Input id="smtpUser" name="smtpUser" defaultValue={settings.smtpUser ?? ""} placeholder="user@domain.com" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="smtpPass">SMTP Password</Label>
                <Input id="smtpPass" name="smtpPass" type="password" placeholder={settings.smtpPassEnc ? "•••••••• (keep as is)" : ""} />
                <div className="text-xs text-muted-foreground">Kosongkan kalau tidak ingin ganti password.</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="smtpFrom">From Email</Label>
                <Input id="smtpFrom" name="smtpFrom" defaultValue={settings.smtpFrom ?? ""} placeholder="no-reply@domain.com" required />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="smtpSecure" defaultChecked={Boolean(settings.smtpSecure)} className="h-4 w-4 accent-primary" />
                  Secure (SSL/TLS, biasanya port 465)
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Save SMTP</Button>
            </div>
          </form>

          <form action={testSmtpSettings} className="grid gap-3 rounded-xl border border-border p-4">
            <div className="text-sm font-semibold">Test Email</div>
            <div className="grid gap-2">
              <Label htmlFor="toEmail">Send to</Label>
              <Input id="toEmail" name="toEmail" type="email" placeholder="test@domain.com" required />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline">
                Send Test
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Outbox Status</CardTitle>
          <CardDescription>Status antrian pengiriman email otomatis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.values(EmailOutboxStatus).map((status) => {
              const stat = outboxStats.find((s) => s.status === status);
              return (
                <div key={status} className="rounded-lg border border-border p-3 text-center">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">{status}</div>
                  <div className="text-2xl font-bold">{stat?._count ?? 0}</div>
                </div>
              );
            })}
          </div>

          {recentFailures.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-destructive">Recent Failures</div>
              <div className="rounded-xl border border-destructive/20 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-destructive/5 border-b border-destructive/20 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">To</th>
                      <th className="px-4 py-2 font-medium">Error</th>
                      <th className="px-4 py-2 font-medium">Last Attempt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-destructive/10">
                    {recentFailures.map((f) => (
                      <tr key={f.id} className="bg-destructive/[0.02]">
                        <td className="px-4 py-2 whitespace-nowrap">{f.toEmail}</td>
                        <td className="px-4 py-2 text-xs text-destructive break-words max-w-[300px]">
                          {f.lastError}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {f.lastAttemptAt ? f.lastAttemptAt.toLocaleString("id-ID", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Accounts</CardTitle>
          <CardDescription>Shown on invoice payment instructions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {settings.bankAccounts.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{b.label}</div>
                    {b.isActive ? <Badge variant="success">ACTIVE</Badge> : <Badge variant="muted">INACTIVE</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">{b.accountName}</div>
                  <div className="mt-1 font-mono text-xs">{b.accountNumber}</div>
                </div>
                <div className="flex gap-2">
                  <form action={toggleBankAccount}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="isActive" value={b.isActive ? "false" : "true"} />
                    <Button variant="outline" type="submit">
                      {b.isActive ? "Disable" : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteBankAccount}>
                    <input type="hidden" name="id" value={b.id} />
                    <Button variant="destructive" type="submit">
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            ))}

            {settings.bankAccounts.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                No bank accounts yet.
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="text-sm font-semibold">Add Bank Account</div>
            <form action={createBankAccount} className="mt-3 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" name="label" placeholder="CIMB Niaga" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    name="accountName"
                    placeholder="PT Solusi Digital Creative"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input id="accountNumber" name="accountNumber" placeholder="0000000000" required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 accent-primary" />
                Active
              </label>
              <div className="flex justify-end">
                <Button type="submit">Add</Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
