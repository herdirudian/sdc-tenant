"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncPaidInvoices } from "@/actions/invoice";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

export function SyncPaidInvoicesButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    if (!confirm("Ini akan membuat record pembayaran untuk invoice yang statusnya PAID tapi belum ada datanya di dashboard revenue. Lanjutkan?")) {
      return;
    }

    setLoading(true);
    try {
      const result = await syncPaidInvoices();
      if (result.success) {
        alert(`Berhasil sinkronisasi ${result.count} invoice.`);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat sinkronisasi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleSync} 
      disabled={loading}
      className="w-full gap-2"
    >
      <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Sync Revenue
    </Button>
  );
}
