import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getInvoiceById } from "@/actions/invoice";
import { getCompanySettingsByTenantId } from "@/actions/settings";
import { PrintControls } from "@/components/print-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { InvoiceTemplate, InvoiceType, UserRole, TaxMethod } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage(props: {
  params: Promise<{ invoiceId: string }>;
}) {
  let invoiceId: string;
  try {
    const params = await props.params;
    invoiceId = params.invoiceId;
  } catch (e) {
    console.error("[Print] Error awaiting params:", e);
    return <div>Error loading parameters</div>;
  }

  try {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return notFound();

    // Cek login
    const session = await getSession();
    if (!session) return redirect("/login");
    
    const userRole = session.user.role;
      if (![UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF].includes(userRole)) {
        return redirect("/login");
      }

      const settings = await getCompanySettingsByTenantId(invoice.tenantId);
      if (!settings) return notFound();

    // Defensive check for relations
    if (!invoice.client) {
      console.error(`[Print] Invoice ${invoiceId} has no client relation`);
      return (
        <div className="p-8 text-center">
          <h1 className="text-xl font-bold text-red-600">Data Error</h1>
          <p>Invoice ini tidak memiliki data Client yang valid. Silakan hubungi admin.</p>
          <Link href={`/invoices/${invoiceId}`} className="text-blue-600 underline mt-4 block">Kembali</Link>
        </div>
      );
    }

    const banks = (settings.bankAccounts || []).filter((b) => b.isActive);
    
    // Mapping bank yang aman dari null reference
    const rawBanks = (invoice.bankAccounts && invoice.bankAccounts.length > 0)
      ? invoice.bankAccounts.map((x) => x.bankAccount).filter(Boolean)
      : banks;

    const displayBanks = rawBanks.map(bank => ({
      label: bank?.label || "Bank",
      accountNumber: bank?.accountNumber || "-",
      accountName: bank?.accountName || "-"
    }));

    const termsText = invoice.terms ?? settings.invoiceTerms ?? "";
    const footerText = invoice.footer ?? settings.invoiceFooter ?? "";

    const amountBruto = Number(invoice.amountBruto?.toString() || "0");
    const isInclusive = invoice.taxMethod === TaxMethod.INCLUSIVE;

    const ppnRate = Number(invoice.taxPpnRate?.toString() || "0");
    const pphRate = Number(invoice.taxPphRate?.toString() || "0");
    const otherRate = Number(invoice.taxOtherRate?.toString() || "0");

    let dpp = amountBruto;
    if (isInclusive) {
      dpp = amountBruto / (1 + ppnRate / 100);
    }

    const ppnAmount = dpp * (ppnRate / 100);
    const pphAmount = dpp * (pphRate / 100);
    const otherAmount = dpp * (otherRate / 100);

    const totalTagihan = dpp + ppnAmount + otherAmount - pphAmount;

    const primaryColor = "text-blue-700";
    const borderColor = "border-slate-200";
    const headerBg = "bg-slate-50";

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
            background-color: white;
            color: #1e293b !important;
          }
          @media print {
            .portal-light-theme {
              background-color: transparent !important;
            }
            @page {
              size: A4;
              margin: 0;
            }
            body {
              margin: 0;
              -webkit-print-color-adjust: exact;
            }
            .bg-kop {
              position: fixed;
              top: 0;
              left: 0;
              width: 210mm;
              height: 297mm;
              z-index: -1;
            }
            .bg-slate-50 {
              background-color: #f8fafc !important;
              -webkit-print-color-adjust: exact;
            }
            .bg-slate-900 {
              background-color: #0f172a !important;
              -webkit-print-color-adjust: exact;
            }
            .print-header-space {
              height: 10mm;
            }
            .print-footer-space {
              height: 10mm;
            }
          }
          .portal-light-theme * {
            border-color: #e2e8f0 !important;
          }
          .print-container {
            width: 100%;
            max-width: 210mm;
          }
        `}} />
        
        {settings.letterheadUrl && (
          <div className="bg-kop fixed top-0 left-0 w-[210mm] h-[297mm] pointer-events-none hidden print:block" style={{ zIndex: -1 }}>
            <img
              src={settings.letterheadUrl}
              alt=""
              className="w-full h-full object-fill"
            />
          </div>
        )}

        <div className="flex items-center justify-between print:hidden w-full max-w-[210mm] mb-4 px-4 md:px-0">
          <Link href={`/invoices/${invoice.id}`} className="text-sm underline">
            Back to Invoice
          </Link>
          <PrintControls />
        </div>

        <div className="print-container relative bg-white print:bg-transparent shadow-2xl print:shadow-none overflow-hidden">
          {/* Screen Background */}
          {settings.letterheadUrl && (
            <div className="absolute inset-0 pointer-events-none print:hidden">
              <img src={settings.letterheadUrl} alt="" className="w-full h-full object-fill" />
            </div>
          )}

          <div className="relative z-10 px-[15mm] py-[10mm]">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-4" />
                )}
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-slate-900 uppercase">{settings.companyName}</div>
                <div className="text-[11px] text-slate-500 max-w-[300px] mt-1">{settings.address}</div>
                <div className="text-[11px] font-semibold mt-1">NPWP: {settings.npwp || "-"}</div>
              </div>
            </div>

            {/* Title */}
            <div className="flex justify-between items-end mb-10 border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-4xl font-black text-slate-900 uppercase">Invoice</h1>
                <div className="font-mono text-sm mt-2 text-slate-600 font-bold">{invoice.invoiceNumber}</div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex justify-end gap-4 text-[11px]">
                  <span className="text-slate-400 font-bold uppercase">Issue Date</span>
                  <span className="font-bold text-slate-900">{formatDateID(invoice.createdAt)}</span>
                </div>
                <div className="flex justify-end gap-4 text-[11px]">
                  <span className="text-slate-400 font-bold uppercase">Due Date</span>
                  <span className="font-bold text-red-600">{formatDateID(invoice.dueDate)}</span>
                </div>
              </div>
            </div>

            {/* Billing */}
            <div className="grid grid-cols-2 gap-12 mb-10">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Bill To:</div>
                <div className="font-bold text-base text-slate-900">{invoice.client?.companyName ?? invoice.client?.name ?? "No Name"}</div>
                <div className="text-[11px] text-slate-500 mt-1">{invoice.client?.address}</div>
                <div className="text-[11px] font-semibold mt-1">NPWP: {invoice.client?.npwp || "-"}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Project / Reference:</div>
                <div className="font-bold text-slate-900">{invoice.project?.name ?? "Layanan Jasa"}</div>
                <div className="text-[11px] mt-1 text-slate-600">Type: {invoice.type}</div>
              </div>
            </div>

            {/* Items */}
            <div className="mb-8">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2 border-slate-900">
                    <TableHead className="h-10 text-[11px] font-black uppercase text-slate-900">Description</TableHead>
                    <TableHead className="h-10 text-center text-[11px] font-black uppercase text-slate-900 w-20">Qty</TableHead>
                    <TableHead className="h-10 text-right text-[11px] font-black uppercase text-slate-900 w-32">Price</TableHead>
                    <TableHead className="h-10 text-right text-[11px] font-black uppercase text-slate-900 w-32">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-transparent border-b border-slate-100">
                        <TableCell className="p-3 align-top font-bold text-slate-900">{item.description}</TableCell>
                        <TableCell className="p-3 text-center align-top">{item.quantity?.toString() || "0"}</TableCell>
                        <TableCell className="p-3 text-right align-top">{formatIDR(item.price?.toString() || "0")}</TableCell>
                        <TableCell className="p-3 text-right align-top font-bold">{formatIDR(item.amount?.toString() || "0")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="p-3 font-bold">{invoice.type}</TableCell>
                      <TableCell className="p-3 text-center">1</TableCell>
                      <TableCell className="p-3 text-right">{formatIDR(amountBruto.toString())}</TableCell>
                      <TableCell className="p-3 text-right font-bold">{formatIDR(amountBruto.toString())}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-between items-start mb-12">
              <div className="w-1/2 text-[10px] text-slate-500 pr-8">
                <div className="font-black uppercase text-slate-400 mb-1">Terms:</div>
                <div className="whitespace-pre-wrap">{termsText}</div>
              </div>
              <div className="w-[280px] space-y-2">
                <div className="flex justify-between text-[11px] px-2">
                  <span className="text-slate-400 font-bold uppercase">Subtotal</span>
                  <span className="font-bold text-slate-900">{formatIDR(dpp.toString())}</span>
                </div>
                {ppnRate > 0 && (
                  <div className="flex justify-between text-[11px] px-2">
                    <span className="text-slate-400 font-bold uppercase">PPN ({ppnRate}%)</span>
                    <span className="font-bold text-slate-900">{formatIDR(ppnAmount.toString())}</span>
                  </div>
                )}
                <div className="bg-slate-900 text-white p-4 rounded-xl mt-4 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase opacity-70">Total Payable</span>
                  <span className="text-xl font-black">{formatIDR(totalTagihan.toString())}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-100">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-400 mb-3">Payment Information:</div>
                <div className="space-y-2">
                  {displayBanks.map((bank, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="font-bold text-[11px]">{bank.label}</div>
                      <div className="font-mono text-[12px] font-bold text-blue-700">{bank.accountNumber}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{bank.accountName}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-center flex flex-col items-center justify-end">
                <div className="text-[11px] font-bold text-slate-400 uppercase mb-12">Authorized Signature</div>
                {settings.signatureUrl && (
                  <img src={settings.signatureUrl} alt="Signature" className="h-20 w-auto object-contain mb-2" />
                )}
                <div className="font-black text-slate-900 border-b-2 border-slate-900 px-6 pb-1 text-sm">{settings.signatureName}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-2">{settings.signatureTitle || "Manager"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error(`[Print] Fatal error rendering invoice ${invoiceId}:`, err);
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Server Error</h1>
        <p>Terjadi kesalahan saat memproses halaman print invoice.</p>
        <p className="text-xs text-slate-400 mt-2">Error: {err instanceof Error ? err.message : "Unknown"}</p>
        <Link href={`/invoices/${invoiceId}`} className="text-blue-600 underline mt-4 block">Kembali</Link>
      </div>
    );
  }
}
