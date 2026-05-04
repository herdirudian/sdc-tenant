import { ShieldAlert, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-6">
            <ShieldAlert className="h-16 w-12 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Sedang Dalam Perawatan</h1>
          <p className="text-muted-foreground text-lg">
            Mohon maaf, sistem kami sedang melakukan pemeliharaan rutin untuk meningkatkan kualitas layanan.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-6">
          <p className="text-sm font-medium">Kami akan segera kembali!</p>
          <p className="text-xs text-muted-foreground mt-2">
            Estimasi waktu pengerjaan biasanya berkisar antara 30-60 menit. Terima kasih atas kesabaran Anda.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Coba Segarkan Halaman
          </Button>
          <Button asChild>
            <a href="mailto:support@sdc.local">
              <Mail className="mr-2 h-4 w-4" /> Hubungi Bantuan
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
