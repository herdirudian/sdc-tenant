import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoiceById } from "@/actions/invoice";
import { getCompanySettings } from "@/actions/settings";
import { formatDateID, formatIDR, terbilang } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { UserRole, InvoiceStatus } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { PrintControls } from "@/components/print-controls";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { invoiceId } = await params;
  const { token } = await searchParams;
  const invoice = await getInvoiceById(invoiceId);

  if (!invoice) notFound();

  // Jika tidak ada token portal yang valid, cek login
  if (!token || token !== invoice.client.portalToken) {
    const session = await getSession();
    if (!session || ![UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF].includes(session.user.role)) {
      redirect("/login");
    }
  }

  // Kwitansi hanya untuk invoice yang sudah PAID
  if (invoice.status !== InvoiceStatus.PAID) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-xl font-bold text-destructive mb-2">Invoice Not Paid</h1>
        <p className="text-muted-foreground mb-4">Kwitansi hanya tersedia untuk invoice yang sudah lunas (PAID).</p>
        <Link href={`/invoices/${invoice.id}`}>
          <Button>Back to Invoice</Button>
        </Link>
      </div>
    );
  }

  const settings = await getCompanySettings();
  const bruto = Number(invoice.amountBruto.toString());
  const tax = Number(invoice.taxPphFinal.toString());
  const net = bruto - tax;
  const amountToDisplay = invoice.isDeductedByClient ? net : bruto;

  return (
    <div className="min-h-screen bg-muted/30 print:bg-transparent flex flex-col items-center p-0 md:p-8 print:p-0 portal-light-theme">
      <style dangerouslySetInnerHTML={{ __html: `
        .portal-light-theme {
          --background: 0 0% 100%;
          --foreground: 222.2 84% 4.9%;
          --card: 0 0% 100%;
          --card-foreground: 222.2 84% 4.9%;
          --muted: 210 40% 96.1%;
          --muted-foreground: 215.4 16.3% 46.9%;
          --border: 214.3 31.8% 91.4%;
          --primary: 221.2 83.2% 53.3%;
          background-color: white !important;
          color: #0f172a !important;
        }
        .portal-light-theme * {
          border-color: #cbd5e1 !important;
        }
        .portal-light-theme .text-slate-900,
        .portal-light-theme .text-slate-800,
        .portal-light-theme .text-slate-700,
        .portal-light-theme .text-black,
        .portal-light-theme .font-bold {
          color: #0f172a !important;
        }
        .portal-light-theme .text-muted-foreground {
          color: #64748b !important;
        }
        .portal-light-theme .bg-muted\/30 {
          background-color: #f1f5f9 !important;
        }
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
        <Link href={`/invoices/${invoice.id}`} className="text-sm underline">
          Back to Invoice
        </Link>
        <PrintControls />
      </div>

      <div className="print-container relative w-full md:w-[210mm] min-h-[148mm] bg-white shadow-2xl print:shadow-none p-[15mm] border-t-8 border-[#3b82f6]">
        <div className="flex justify-between items-start mb-10 pb-6 border-b-2 border-slate-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4 mb-2">
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
              )}
              <h1 className="text-4xl font-black uppercase tracking-tighter text-[#3b82f6]">Kwitansi</h1>
            </div>
            <p className="text-sm font-mono text-slate-500 font-bold tracking-widest bg-slate-50 px-3 py-1 rounded-full w-fit">
              NO. {invoice.invoiceNumber.replace("INV", "KWT")}
            </p>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="font-black text-xl text-slate-900">{settings.companyName}</div>
            <div className="text-[10px] text-slate-500 max-w-[250px] leading-relaxed mt-1 font-medium">
              {settings.address}
            </div>
          </div>
        </div>

        <div className="space-y-8 text-sm">
          <div className="flex border-b-2 border-slate-200 border-dashed pb-3 items-center">
            <div className="w-44 text-slate-400 uppercase text-[10px] font-black tracking-widest">Telah Terima Dari</div>
            <div className="flex-1 font-bold text-lg text-slate-900">{invoice.client.companyName ?? invoice.client.name}</div>
          </div>

          <div className="flex border-b-2 border-slate-200 border-dashed pb-3 items-center">
            <div className="w-44 text-slate-400 uppercase text-[10px] font-black tracking-widest">Uang Sejumlah</div>
            <div className="flex-1 italic bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700 font-medium text-base">
              ### {terbilang(amountToDisplay)} Rupiah ###
            </div>
          </div>

          <div className="flex border-b-2 border-slate-200 border-dashed pb-3 items-center">
            <div className="w-44 text-slate-400 uppercase text-[10px] font-black tracking-widest">Untuk Pembayaran</div>
            <div className="flex-1 font-semibold text-slate-700">
              {invoice.project?.name ?? "Layanan Jasa"} (Invoice: {invoice.invoiceNumber})
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-between items-end">
          <div className="bg-[#3b82f6] text-white px-8 py-4 rounded-2xl shadow-xl shadow-blue-100 border-2 border-white">
            <div className="text-[10px] uppercase font-black opacity-90 tracking-widest mb-1">Terbilang (IDR)</div>
            <div className="text-3xl font-black tracking-tight">
              {formatIDR(amountToDisplay.toString())}
            </div>
          </div>

          <div className="text-center w-64 flex flex-col items-center">
            <div className="text-[11px] mb-12 font-bold text-slate-500">Bandung, {formatDateID(new Date())}</div>
            <div className="h-20 flex items-center justify-center mb-2 relative">
              {settings.signatureUrl && (
                <img src={settings.signatureUrl} alt="" className="max-h-full object-contain" />
              )}
            </div>
            <div className="font-black text-slate-900 border-b-2 border-slate-900 px-6 pb-1 text-sm">{settings.signatureName}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">Authorized Signature</div>
          </div>
        </div>

        <div className="mt-16 pt-4 border-t border-slate-100 text-[9px] text-slate-400 font-medium flex justify-between">
          <div>Generated automatically by {settings.companyName} System</div>
          <div className="uppercase tracking-widest">Dokumen ini adalah bukti pembayaran sah.</div>
        </div>
      </div>
    </div>
  );
}
