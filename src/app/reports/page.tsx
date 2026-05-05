import { requireRole, requireSubscription } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { FinancialReportsUI } from "@/components/reports/FinancialReportsUI";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireSubscription();
  await requireRole([UserRole.ADMIN, UserRole.FINANCE]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laporan Keuangan</h1>
          <p className="text-sm text-muted-foreground">
            Laporan Laba Rugi dan Rekapitulasi Pajak PPh.
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
        </Link>
      </div>

      <FinancialReportsUI />
    </div>
  );
}
