import { requireTenant } from "@/lib/auth";
import { createSubscriptionInvoice, startFreeTrial } from "@/actions/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getGlobalSettings } from "@/actions/saas-admin";
import { formatIDR } from "@/lib/format";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aktivasi Akun - Solusi Invoice",
  description: "Aktifkan akun Solusi Invoice Anda",
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string }>;
}) {
  const { tenant, subscription } = await requireTenant();
  const { sub } = await searchParams;
  const settings = await getGlobalSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50/30 p-4 dark:bg-blue-950/10">
      <div className="w-full max-w-xl">
        {sub === "failed" && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
            Pembayaran gagal atau dibatalkan. Silakan coba lagi.
          </div>
        )}
        <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
          <div className="bg-primary p-6 text-primary-foreground text-center">
            <img src="/icon.png" alt="Solusi Invoice" className="mx-auto mb-4 h-20 w-auto brightness-0 invert" />
            <h1 className="text-2xl font-bold">Satu Langkah Lagi!</h1>
            <p className="opacity-90">Aktifkan akun {tenant.name} Anda</p>
          </div>
          
          <CardHeader className="text-center pt-8">
            <CardTitle className="text-3xl font-bold">{formatIDR(Number(settings.subscriptionPrice))}<span className="text-sm font-normal text-muted-foreground"> / bulan</span></CardTitle>
            <CardDescription>Akses penuh ke semua fitur Solusi Invoice</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Invoice & Penawaran Tanpa Batas</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Multi-Pajak (PPN, PPh 23, PB1)</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Sinkronisasi Nomor E-Faktur</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Notifikasi Email Otomatis</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Laporan Keuangan & Laba Rugi</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Manajemen Klien & Proyek</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Pencatatan Ledger & Biaya</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">Audit Log & Keamanan Data</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-semibold mb-1 text-primary">Informasi Aktivasi</p>
              <p className="text-muted-foreground leading-relaxed">
                Silakan lakukan pembayaran untuk mendapatkan akses penuh ke seluruh fitur sistem **Solusi Invoice**. Jika Anda ingin mencoba terlebih dahulu, Anda juga dapat mengaktifkan versi uji coba (Trial) secara gratis melalui link di bawah ini.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 p-8 pt-4">
            <form action={createSubscriptionInvoice} className="w-full">
              <Button type="submit" size="lg" className="w-full text-lg h-14 font-bold shadow-lg hover:scale-[1.02] transition-transform">
                Bayar Sekarang
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Aman & Terpercaya. Mendukung Transfer Bank, E-Wallet, dan QRIS.
            </p>
            <form action={startFreeTrial} className="text-center w-full">
              <button type="submit" className="text-sm text-primary hover:underline bg-transparent border-none cursor-pointer">
                Coba versi Trial {settings.trialDays} hari dulu
              </button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
