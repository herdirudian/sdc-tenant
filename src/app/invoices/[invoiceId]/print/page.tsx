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
import { InvoiceTemplate, UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
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

  const settings = await getCompanySettings();
  const banks = settings.bankAccounts.filter((b) => b.isActive);
  const selectedBanks =
    invoice.bankAccounts.length > 0
      ? invoice.bankAccounts.map((x) => x.bankAccount)
      : banks;
  const termsText = invoice.terms ?? settings.invoiceTerms ?? null;
  const footerText = invoice.footer ?? settings.invoiceFooter ?? null;

  const bruto = Number(invoice.amountBruto.toString());
  const tax = Number(invoice.taxPphFinal.toString());
  const net = bruto - tax;

  const isModern = invoice.template === InvoiceTemplate.MODERN;
  const primaryColor = isModern ? "text-blue-700" : "text-black";
  const borderColor = isModern ? "border-blue-200" : "border-black";
  const headerBg = isModern ? "bg-blue-50/50" : "bg-transparent";

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
          background-color: white !important;
          color: #0f172a !important;
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
            height: 42mm;
          }
          .print-footer-space {
            height: 40mm;
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
      <div className="bg-kop fixed top-0 left-0 w-[210mm] h-[297mm] pointer-events-none hidden print:block" style={{ zIndex: -1 }}>
        <img
          src={settings.letterheadUrl ?? "/img/KopSurat.png"}
          alt=""
          className="w-full h-full object-fill"
        />
      </div>

      <div className="flex items-center justify-between print:hidden w-full max-w-[210mm] mb-4 px-4 md:px-0">
        <Link href={`/invoices/${invoice.id}`} className="text-sm underline">
          Back to Invoice
        </Link>
        <PrintControls />
      </div>

      <div className="print-container relative w-full md:w-[210mm] min-h-[297mm] bg-white print:bg-transparent shadow-2xl print:shadow-none print:m-0 overflow-hidden print:overflow-visible">
        {/* Screen-only Background Layer */}
        <div className="absolute inset-0 pointer-events-none print:hidden">
          <img
            src={settings.letterheadUrl ?? "/img/KopSurat.png"}
            alt=""
            className="w-full h-full object-fill"
          />
        </div>

        {/* Content Table for Print Spacing */}
        <table className="relative z-10 w-full border-collapse bg-transparent print:bg-transparent">
          <thead>
            <tr><td><div className="print-header-space h-[42mm] print:h-[42mm]" /></td></tr>
          </thead>
          <tbody className="bg-transparent print:bg-transparent">
            <tr className="bg-transparent print:bg-transparent">
              <td className="bg-transparent print:bg-transparent">
                <div className="px-[12mm] text-[11px] leading-snug bg-transparent print:bg-transparent">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h1 className={`text-2xl font-bold uppercase tracking-tighter leading-none mb-1 ${primaryColor}`}>Invoice</h1>
                      <div className="font-mono text-[11px]">{invoice.invoiceNumber}</div>
                      {invoice.poReference && (
                        <div className="text-[10px] text-muted-foreground">PO: {invoice.poReference}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <div className={`font-bold text-[9px] uppercase text-muted-foreground border-b mb-1 ${isModern ? "border-blue-100" : ""}`}>Bill From</div>
                      <div className="font-bold text-[12px]">{settings.companyName}</div>
                      <div className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-tight">{settings.address}</div>
                      <div className="text-[11px]">NPWP: {settings.npwp}</div>
                    </div>
                    <div>
                      <div className={`font-bold text-[9px] uppercase text-muted-foreground border-b mb-1 ${isModern ? "border-blue-100" : ""}`}>Bill To</div>
                      <div className="font-bold text-[12px]">{invoice.client.companyName ?? invoice.client.name}</div>
                      <div className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-tight">{invoice.client.address}</div>
                      <div className="text-[11px]">NPWP: {invoice.client.npwp}</div>
                    </div>
                  </div>

                  <div className={`grid grid-cols-3 gap-3 mb-6 p-3 rounded text-[10px] ${isModern ? "bg-blue-50/50" : "bg-muted/20"}`}>
                    <div>
                      <div className="uppercase text-muted-foreground mb-0.5 font-bold">Issue Date</div>
                      <div className="font-semibold">{formatDateID(invoice.createdAt)}</div>
                    </div>
                    <div>
                      <div className="uppercase text-muted-foreground mb-0.5 font-bold">Due Date</div>
                      <div className="font-semibold text-destructive">{formatDateID(invoice.dueDate)}</div>
                    </div>
                    <div>
                      <div className="uppercase text-muted-foreground mb-0.5 font-bold">Type</div>
                      <div className="font-semibold">{invoice.type}</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Table>
                      <TableHeader>
                        <TableRow className={`hover:bg-transparent border-b-2 ${borderColor} ${headerBg}`}>
                          <TableHead className={`h-8 text-[10px] font-bold uppercase p-1 ${isModern ? "text-blue-800" : "text-black"}`}>Description</TableHead>
                          <TableHead className={`h-8 text-right text-[10px] font-bold uppercase p-1 w-16 ${isModern ? "text-blue-800" : "text-black"}`}>Qty</TableHead>
                          <TableHead className={`h-8 text-right text-[10px] font-bold uppercase p-1 w-24 ${isModern ? "text-blue-800" : "text-black"}`}>Price</TableHead>
                          <TableHead className={`h-8 text-right text-[10px] font-bold uppercase p-1 w-28 ${isModern ? "text-blue-800" : "text-black"}`}>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoice.items && invoice.items.length > 0 ? (
                          invoice.items.map((item) => (
                            <TableRow key={item.id} className={`hover:bg-transparent border-b ${isModern ? "border-blue-50" : ""}`}>
                              <TableCell className="p-1 py-3">
                                <div className="font-bold text-[12px] leading-tight">{item.description}</div>
                              </TableCell>
                              <TableCell className="text-right p-1 py-3 text-[11px]">
                                {item.quantity.toString()}
                              </TableCell>
                              <TableCell className="text-right p-1 py-3 text-[11px]">
                                {formatIDR(item.price.toString())}
                              </TableCell>
                              <TableCell className={`text-right p-1 py-3 font-semibold text-[12px] ${isModern ? "text-blue-900" : ""}`}>
                                {formatIDR(item.amount.toString())}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow className={`hover:bg-transparent border-b ${isModern ? "border-blue-50" : ""}`}>
                            <TableCell className="p-1 py-3">
                              <div className="font-bold text-[12px] leading-tight">{invoice.project?.name ?? "Project Services"}</div>
                              <div className="text-[9px] text-muted-foreground italic leading-none">{invoice.type}</div>
                            </TableCell>
                            <TableCell className="text-right p-1 py-3 text-[11px]">1</TableCell>
                            <TableCell className="text-right p-1 py-3 text-[11px]">{formatIDR(bruto)}</TableCell>
                            <TableCell className="text-right p-1 py-3 font-semibold text-[12px]">{formatIDR(bruto)}</TableCell>
                          </TableRow>
                        )}
                        
                        {invoice.isDeductedByClient ? (
                          <>
                            <TableRow className="hover:bg-transparent border-0">
                              <TableCell colSpan={3} className="p-1 pt-4 text-right text-[11px] text-muted-foreground">Subtotal</TableCell>
                              <TableCell className="text-right p-1 pt-4 text-[11px]">{formatIDR(bruto)}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-transparent border-0">
                              <TableCell colSpan={3} className="p-1 text-right text-[11px] text-muted-foreground">PPh Final (0.5%)</TableCell>
                              <TableCell className="text-right p-1 text-[11px]">- {formatIDR(tax)}</TableCell>
                            </TableRow>
                            <TableRow className={`hover:bg-transparent border-0 border-t-2 ${borderColor}`}>
                              <TableCell colSpan={3} className="p-1 py-3 text-right font-bold text-base">Net Payable</TableCell>
                              <TableCell className={`text-right p-1 py-3 font-bold text-base ${isModern ? "text-blue-800" : ""}`}>{formatIDR(net)}</TableCell>
                            </TableRow>
                          </>
                        ) : (
                          <TableRow className={`hover:bg-transparent border-0 border-t-2 ${borderColor}`}>
                            <TableCell colSpan={3} className="p-1 py-4 text-right font-bold text-base">Total Payable</TableCell>
                            <TableCell className={`text-right p-1 py-4 font-bold text-base ${isModern ? "text-blue-800" : ""}`}>{formatIDR(bruto)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 items-end">
                    <div className="space-y-3">
                      <div className="p-3 border rounded-sm bg-muted/5 border-black/10">
                        <div className="text-[10px] font-bold uppercase mb-1.5">Payment Information:</div>
                        {selectedBanks.map((b) => (
                          <div key={b.id} className="text-[11px] leading-tight mb-1.5 last:mb-0">
                            <span className="font-bold">{b.label}</span>: {b.accountName} - <span className="font-mono font-bold">{b.accountNumber}</span>
                          </div>
                        ))}
                      </div>
                      {termsText && (
                        <div className="text-[10px] leading-snug text-muted-foreground">
                          <span className="font-bold text-black uppercase inline mr-1">Terms & Conditions:</span>
                          {termsText}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <div className="text-[10px] font-bold uppercase mb-2 tracking-wider">Authorized Signature</div>
                      <div className="h-16 flex items-center justify-center mb-2">
                        {settings.signatureUrl ? (
                          <img src={settings.signatureUrl} alt="" className="max-h-full w-auto" />
                        ) : (
                          <div className="h-14" />
                        )}
                      </div>
                      <div className="font-bold text-[12px] border-b-2 border-black px-6 leading-none mb-1.5">{settings.signatureName}</div>
                      <div className="text-[10px] text-muted-foreground leading-none">{settings.signatureTitle}</div>
                    </div>
                  </div>

                  {footerText && (
                    <div className="mt-12 pt-4 text-[10px] text-center text-muted-foreground italic border-t border-dashed">
                      {footerText}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td><div className="print-footer-space h-[40mm] print:h-[40mm]" /></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
