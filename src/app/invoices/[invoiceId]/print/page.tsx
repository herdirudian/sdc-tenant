import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getInvoiceById } from "@/actions/invoice";
import { getCompanySettings } from "@/actions/settings";
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
  const params = await props.params;
  const invoiceId = params.invoiceId;
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return notFound();

  // Cek login
  const session = await getSession();
  if (!session || ![UserRole.ADMIN, UserRole.FINANCE, UserRole.STAFF].includes(session.user.role)) {
    return redirect("/login");
  }

  const settings = await getCompanySettings();
  if (!settings) return notFound();

  const banks = (settings.bankAccounts || []).filter((b) => b.isActive);
  const selectedBanks =
    (invoice.bankAccounts && invoice.bankAccounts.length > 0)
      ? invoice.bankAccounts.map((x) => x.bankAccount)
      : banks;
  const termsText = invoice.terms ?? settings.invoiceTerms ?? null;
  const footerText = invoice.footer ?? settings.invoiceFooter ?? null;

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

  const isModern = invoice.template === InvoiceTemplate.MODERN;
  const primaryColor = "text-blue-700";
  const borderColor = "border-slate-200";
  const headerBg = "bg-slate-50";

  // Re-fetch bank account details to ensure we have label, accountName, and accountNumber
  // The map above might only have IDs if getInvoiceById doesn't include the full object
  const displayBanks = selectedBanks.map(bank => ({
    label: bank.label || "Bank",
    accountNumber: bank.accountNumber || "-",
    accountName: bank.accountName || "-"
  }));

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
        }
        .portal-light-theme * {
          border-color: #e2e8f0 !important;
        }
        .portal-light-theme .text-white {
          color: white !important;
        }
        .portal-light-theme .text-slate-900,
        .portal-light-theme .text-slate-800,
        .portal-light-theme .text-slate-700,
        .portal-light-theme .text-black {
          color: #0f172a !important;
        }
        .portal-light-theme .text-muted-foreground {
          color: #64748b !important;
        }
        .portal-light-theme .text-destructive {
          color: #ef4444 !important;
        }
        .portal-light-theme .bg-muted\/30 {
          background-color: #f8fafc !important;
        }
        .portal-light-theme .bg-muted\/20 {
          background-color: #f1f5f9 !important;
        }
        .portal-light-theme .bg-blue-50\/50 {
          background-color: #eff6ff !important;
        }
        .portal-light-theme .bg-blue-50 {
          background-color: #eff6ff !important;
        }
        .portal-light-theme .text-blue-800 {
          color: #1e40af !important;
        }
        .portal-light-theme .text-blue-900 {
          color: #1e3a8a !important;
        }
        .portal-light-theme .border-blue-100 {
          border-color: #dbeafe !important;
        }
        .portal-light-theme .border-blue-50 {
          border-color: #eff6ff !important;
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
          .bg-kop {
            position: fixed;
            top: 0;
            left: 0;
            width: 210mm;
            height: 297mm;
            z-index: -1;
          }
          .print-header-space {
            height: 10mm;
          }
          .print-footer-space {
            height: 10mm;
          }
          .print-container {
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background-color: transparent !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
      
      {/* Fixed Background for Print */}
      {settings.letterheadUrl && (
        <div className="bg-kop fixed top-0 left-0 w-[210mm] h-[297mm] pointer-events-none hidden print:block" style={{ zIndex: -1 }}>
          <img
            src={settings.letterheadUrl.startsWith('http') ? settings.letterheadUrl : settings.letterheadUrl}
            alt=""
            className="w-full h-full object-fill"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between print:hidden w-full max-w-[210mm] mb-4 px-4 md:px-0">
        <Link href={`/invoices/${invoice.id}`} className="text-sm underline">
          Back to Invoice
        </Link>
        <PrintControls />
      </div>

      <div className="print-container relative w-full md:w-[210mm] min-h-[297mm] bg-white print:bg-transparent shadow-2xl print:shadow-none print:m-0 overflow-hidden print:overflow-visible">
        {/* Screen-only Background Layer */}
        {settings.letterheadUrl && (
          <div className="absolute inset-0 pointer-events-none print:hidden">
            <img
              src={settings.letterheadUrl}
              alt=""
              className="w-full h-full object-fill"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content Table for Print Spacing */}
        <table className="relative z-10 w-full border-collapse bg-transparent print:bg-transparent">
          <thead>
            <tr><td><div className="print-header-space h-[10mm] print:h-[10mm]" /></td></tr>
          </thead>
          <tbody className="bg-transparent print:bg-transparent">
            <tr className="bg-transparent print:bg-transparent">
              <td className="bg-transparent print:bg-transparent">
                <div className="px-[15mm] text-[12px] leading-normal bg-transparent print:bg-transparent">
                  
                  {/* Header: Logo & Company Info */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      {settings.logoUrl && (
                        <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-4" />
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-slate-900 uppercase tracking-tight">{settings.companyName}</div>
                      <div className="text-[11px] text-slate-500 max-w-[300px] leading-tight mt-1">{settings.address}</div>
                      <div className="text-[11px] font-semibold mt-1">NPWP: {settings.npwp || "-"}</div>
                    </div>
                  </div>

                  {/* Invoice Title & Meta */}
                  <div className="flex justify-between items-end mb-10 border-b-2 border-slate-900 pb-4">
                    <div>
                      <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Invoice</h1>
                      <div className="font-mono text-sm mt-2 text-slate-600 font-bold">{invoice.invoiceNumber}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex justify-end gap-4 text-[11px]">
                        <span className="text-slate-400 font-bold uppercase tracking-widest">Issue Date</span>
                        <span className="font-bold text-slate-900">{formatDateID(invoice.createdAt)}</span>
                      </div>
                      <div className="flex justify-end gap-4 text-[11px]">
                        <span className="text-slate-400 font-bold uppercase tracking-widest">Due Date</span>
                        <span className="font-bold text-red-600">{formatDateID(invoice.dueDate)}</span>
                      </div>
                      {invoice.taxInvoiceNumber && (
                        <div className="flex justify-end gap-4 text-[11px]">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">Faktur Pajak</span>
                          <span className="font-bold text-blue-700">{invoice.taxInvoiceNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billing Info */}
                  <div className="grid grid-cols-2 gap-12 mb-10">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Bill To:</div>
                      <div className="font-bold text-base text-slate-900">{invoice.client.companyName ?? invoice.client.name}</div>
                      <div className="text-[11px] text-slate-500 whitespace-pre-wrap leading-relaxed mt-1">{invoice.client.address}</div>
                      <div className="text-[11px] font-semibold mt-1">NPWP: {invoice.client.npwp || "-"}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Project / Reference:</div>
                      <div className="font-bold text-slate-900">{invoice.project?.name ?? "Layanan Jasa"}</div>
                      {invoice.poReference && (
                        <div className="text-[11px] mt-1 text-slate-600 font-medium">PO Ref: {invoice.poReference}</div>
                      )}
                      <div className="text-[11px] mt-1 text-slate-600 font-medium">Type: {invoice.type}</div>
                    </div>
                  </div>

                  {/* Table Items */}
                  <div className="mb-8">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-2 border-slate-900">
                          <TableHead className="h-10 text-[11px] font-black uppercase text-slate-900 p-2">Description</TableHead>
                          <TableHead className="h-10 text-center text-[11px] font-black uppercase text-slate-900 p-2 w-20">Qty</TableHead>
                          <TableHead className="h-10 text-right text-[11px] font-black uppercase text-slate-900 p-2 w-32">Price</TableHead>
                          <TableHead className="h-10 text-right text-[11px] font-black uppercase text-slate-900 p-2 w-32">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.items && invoice.items.length > 0 ? (
                          invoice.items.map((item, idx) => (
                            <TableRow key={idx} className="hover:bg-transparent border-b border-slate-100">
                              <TableCell className="p-3 align-top">
                                <div className="font-bold text-slate-900">{item.description}</div>
                              </TableCell>
                              <TableCell className="p-3 text-center align-top font-medium">{item.quantity.toString()}</TableCell>
                              <TableCell className="p-3 text-right align-top font-medium">{formatIDR(item.price.toString())}</TableCell>
                              <TableCell className="p-3 text-right align-top font-bold text-slate-900">{formatIDR(item.amount.toString())}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow className="hover:bg-transparent border-b border-slate-100">
                            <TableCell className="p-3 align-top font-bold text-slate-900">{invoice.type}</TableCell>
                            <TableCell className="p-3 text-center align-top font-medium">1</TableCell>
                            <TableCell className="p-3 text-right align-top font-medium">{formatIDR(amountBruto.toString())}</TableCell>
                            <TableCell className="p-3 text-right align-top font-bold text-slate-900">{formatIDR(amountBruto.toString())}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Totals Section */}
                  <div className="flex justify-between items-start mb-12">
                    <div className="w-1/2">
                      {termsText && (
                        <div className="text-[10px] text-slate-500 pr-8">
                          <div className="font-black uppercase tracking-widest mb-1 text-slate-400">Terms & Conditions:</div>
                          <div className="whitespace-pre-wrap leading-tight">{termsText}</div>
                        </div>
                      )}
                    </div>
                    <div className="w-[280px] space-y-2">
                      <div className="flex justify-between text-[11px] px-2">
                        <span className="text-slate-400 font-bold uppercase tracking-widest">Subtotal</span>
                        <span className="font-bold text-slate-900">{formatIDR(dpp.toString())}</span>
                      </div>
                      {ppnRate > 0 && (
                        <div className="flex justify-between text-[11px] px-2">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">PPN ({ppnRate}%)</span>
                          <span className="font-bold text-slate-900">{formatIDR(ppnAmount.toString())}</span>
                        </div>
                      )}
                      {otherRate > 0 && (
                        <div className="flex justify-between text-[11px] px-2">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">{invoice.taxOtherLabel || "Lain-lain"} ({otherRate}%)</span>
                          <span className="font-bold text-slate-900">{formatIDR(otherAmount.toString())}</span>
                        </div>
                      )}
                      {pphRate > 0 && (
                        <div className="flex justify-between text-[11px] px-2">
                          <span className="text-slate-400 font-bold uppercase tracking-widest">{invoice.taxPphType || "PPh"} ({pphRate}%)</span>
                          <span className="font-bold text-red-600">({formatIDR(pphAmount.toString())})</span>
                        </div>
                      )}
                      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg shadow-slate-200 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Payable</span>
                          <span className="text-xl font-black">{formatIDR(totalTagihan.toString())}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer: Payment Info & Signature */}
                  <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-100">
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Payment Information:</div>
                      <div className="space-y-3">
                        {displayBanks.map((bank, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="font-bold text-slate-900 text-[11px]">{bank.label}</div>
                            <div className="font-mono text-[12px] font-bold text-blue-700">{bank.accountNumber}</div>
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">{bank.accountName}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-center flex flex-col items-center justify-end">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-12">Authorized Signature</div>
                      <div className="h-24 flex items-center justify-center relative mb-2">
                        {settings.signatureUrl && (
                          <img src={settings.signatureUrl} alt="Signature" className="max-h-full w-auto object-contain" />
                        )}
                      </div>
                      <div className="font-black text-slate-900 border-b-2 border-slate-900 px-6 pb-1 text-sm">{settings.signatureName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">{settings.signatureTitle || "Manager"}</div>
                    </div>
                  </div>

                  {footerText && (
                    <div className="mt-12 pt-6 border-t border-slate-50 text-center text-[10px] text-slate-400 italic">
                      {footerText}
                    </div>
                  )}

                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td><div className="print-footer-space h-[10mm] print:h-[20mm]" /></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
