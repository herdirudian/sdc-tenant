import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentById } from "@/actions/invoice";
import { getCompanySettings } from "@/actions/settings";
import { formatDateID, formatIDR } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { PrintControls } from "@/components/print-controls";

export const dynamic = "force-dynamic";

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ invoiceId: string; paymentId: string }>;
}) {
  await requireRole([UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF]);
  const { paymentId } = await params;
  const payment = await getPaymentById(paymentId);

  if (!payment) notFound();

  const settings = await getCompanySettings();
  const amountToDisplay = Number(payment.amount.toString());

  // Terbilang sederhana (untuk versi Indonesia)
  const terbilang = (n: number): string => {
    const units = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    if (n < 12) return units[n];
    if (n < 20) return terbilang(n - 10) + " Belas";
    if (n < 100) return terbilang(Math.floor(n / 10)) + " Puluh " + terbilang(n % 10);
    if (n < 200) return "Seratus " + terbilang(n - 100);
    if (n < 1000) return terbilang(Math.floor(n / 100)) + " Ratus " + terbilang(n % 100);
    if (n < 2000) return "Seribu " + terbilang(n - 1000);
    if (n < 1000000) return terbilang(Math.floor(n / 1000)) + " Ribu " + terbilang(n % 1000);
    if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + " Juta " + terbilang(n % 1000000);
    return n.toString();
  };

  return (
    <div className="min-h-screen bg-muted/30 print:bg-transparent flex flex-col items-center p-0 md:p-8 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            background-color: transparent !important;
          }
          .print-container {
            width: 100% !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />

      <div className="flex items-center justify-between print:hidden w-full max-w-[210mm] mb-4 px-4 md:px-0">
        <Link href={`/invoices/${payment.invoiceId}`} className="text-sm underline">
          Back to Invoice
        </Link>
        <PrintControls />
      </div>

      <div className="print-container relative w-full md:w-[210mm] min-h-[148mm] bg-white shadow-2xl print:shadow-none p-[15mm] border-t-8 border-primary">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-start gap-4">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter text-primary">Kwitansi</h1>
              <p className="text-sm font-mono text-muted-foreground">No. {payment.invoice.invoiceNumber.replace("INV", "KWT")}/PAY/{payment.id.slice(0, 4).toUpperCase()}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">{settings.companyName}</div>
            <div className="text-xs text-muted-foreground max-w-[200px] leading-tight">
              {settings.address}
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm">
          <div className="flex border-b border-dashed pb-2">
            <div className="w-48 text-muted-foreground uppercase text-[10px] font-bold">Telah Terima Dari</div>
            <div className="flex-1 font-bold text-base">{payment.invoice.client.companyName ?? payment.invoice.client.name}</div>
          </div>

          <div className="flex border-b border-dashed pb-2">
            <div className="w-48 text-muted-foreground uppercase text-[10px] font-bold">Uang Sejumlah</div>
            <div className="flex-1 italic bg-muted/30 p-2 rounded">
              ### {terbilang(amountToDisplay)} Rupiah ###
            </div>
          </div>

          <div className="flex border-b border-dashed pb-2">
            <div className="w-48 text-muted-foreground uppercase text-[10px] font-bold">Untuk Pembayaran</div>
            <div className="flex-1">
              {payment.note || `Pembayaran termin untuk ${payment.invoice.project?.name ?? "Services"}`}
              <span className="ml-1 text-muted-foreground">(Invoice: {payment.invoice.invoiceNumber})</span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-between items-end">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-sm shadow-lg">
            <div className="text-[10px] uppercase font-bold opacity-80">Terbilang (IDR)</div>
            <div className="text-2xl font-black tracking-tight">
              {formatIDR(amountToDisplay.toString())}
            </div>
          </div>

          <div className="text-center w-64">
            <div className="text-[11px] mb-12">Bandung, {formatDateID(payment.paidAt)}</div>
            <div className="h-16 flex items-center justify-center mb-2">
              {settings.signatureUrl && (
                <img src={settings.signatureUrl} alt="" className="max-h-full" />
              )}
            </div>
            <div className="font-bold border-b border-black inline-block px-4">{settings.signatureName}</div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">Authorized Signature</div>
          </div>
        </div>

        <div className="mt-12 pt-4 border-t text-[9px] text-muted-foreground flex justify-between">
          <div>Generated automatically by {settings.companyName} System</div>
          <div>Dokumen ini adalah bukti pembayaran sah.</div>
        </div>
      </div>
    </div>
  );
}
