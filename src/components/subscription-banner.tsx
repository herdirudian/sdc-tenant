import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, CreditCard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionBannerProps {
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE";
  expiresAt: Date | null;
}

export function SubscriptionBanner({ status, expiresAt }: SubscriptionBannerProps) {
  if (!expiresAt && status !== "INACTIVE") return null;

  const now = new Date();
  const expiryDate = expiresAt ? new Date(expiresAt) : now;
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 1. Case: Account is INACTIVE (Just registered, no trial yet)
  if (status === "INACTIVE") {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
        <div className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:p-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300">Selamat Datang di Solusi Invoice!</h3>
              <p className="text-sm text-blue-800/80 dark:text-blue-400/70">Aktifkan akun Anda sekarang untuk mulai mengelola invoice profesional secara otomatis.</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/checkout">
              <Button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500">
                Aktivasi Sekarang
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Case: Trial Mode
  if (status === "TRIAL") {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:p-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">
                Masa Trial Berakhir dalam {diffDays} Hari
              </h3>
              <p className="text-sm text-amber-800/80 dark:text-amber-400/70">
                Akun Anda sedang dalam masa uji coba gratis. Berlangganan sekarang agar akses bisnis Anda tidak terputus.
              </p>
            </div>
          </div>
          <Link href="/checkout" className="shrink-0">
            <Button className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500">
              Berlangganan Sekarang
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Case: Premium Expiry Reminder (H-7)
  if (status === "ACTIVE" && diffDays <= 7 && diffDays >= 0) {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/20">
        <div className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:p-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-900 dark:text-rose-300">
                ⚠️ Segera Perpanjang Langganan Anda
              </h3>
              <p className="text-sm text-rose-800/80 dark:text-rose-400/70">
                Masa aktif Premium Anda akan berakhir dalam <span className="font-bold underline">{diffDays} hari</span>. Perpanjang sekarang untuk kenyamanan operasional Anda.
              </p>
            </div>
          </div>
          <Link href="/checkout" className="shrink-0">
            <Button variant="destructive" className="bg-rose-600 hover:bg-rose-700 shadow-lg animate-pulse">
              Perpanjang Sekarang
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Case: Past Due / Canceled
  if (status === "PAST_DUE" || status === "CANCELED") {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm dark:border-red-900/50 dark:bg-red-950/20">
        <div className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:p-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900 dark:text-red-300">Langganan Terhenti</h3>
              <p className="text-sm text-red-800/80 dark:text-red-400/70">Masa aktif akun Anda telah berakhir. Aktifkan kembali sekarang untuk melanjutkan pengelolaan invoice.</p>
            </div>
          </div>
          <Link href="/checkout" className="shrink-0">
            <Button className="bg-red-600 hover:bg-red-700">Aktifkan Kembali</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
