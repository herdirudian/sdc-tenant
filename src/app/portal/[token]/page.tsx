import { getClientByPortalToken } from "@/actions/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateID, formatIDR } from "@/lib/format";
import { InvoiceStatus } from "@/generated/prisma/client";
import { notFound } from "next/navigation";
import { FileText, Receipt, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getClientByPortalToken(token);

  if (!client) {
    notFound();
  }

  const unpaidInvoices = client.invoices.filter((inv) => inv.status === InvoiceStatus.UNPAID);
  const totalUnpaid = unpaidInvoices.reduce((acc, inv) => acc + Number(inv.amountBruto.toString()), 0);

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 md:p-8 text-slate-900 portal-light-theme">
      <style dangerouslySetInnerHTML={{ __html: `
        .portal-light-theme {
          --background: 0 0% 100%;
          --foreground: 222.2 84% 4.9%;
          --card: 0 0% 100%;
          --card-foreground: 222.2 84% 4.9%;
          --popover: 0 0% 100%;
          --popover-foreground: 222.2 84% 4.9%;
          --primary: 222.2 47.4% 11.2%;
          --primary-foreground: 210 40% 98%;
          --secondary: 210 40% 96.1%;
          --secondary-foreground: 222.2 47.4% 11.2%;
          --muted: 210 40% 96.1%;
          --muted-foreground: 215.4 16.3% 46.9%;
          --accent: 210 40% 96.1%;
          --accent-foreground: 222.2 47.4% 11.2%;
          --destructive: 0 84.2% 60.2%;
          --destructive-foreground: 210 40% 98%;
          --border: 214.3 31.8% 91.4%;
          --input: 214.3 31.8% 91.4%;
          --ring: 222.2 84% 4.9%;
        }
        .portal-light-theme table, 
        .portal-light-theme tr, 
        .portal-light-theme td, 
        .portal-light-theme th {
          background-color: white !important;
          color: #0f172a !important;
          border-color: #e2e8f0 !important;
        }
        .portal-light-theme .text-muted-foreground {
          color: #64748b !important;
        }
      `}} />
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <img src="/icon.png" alt="SDC" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{client.companyName || client.name}</h1>
              <p className="text-sm text-slate-500 font-medium">Client Portal - Invoice History</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Unpaid</div>
            <div className="text-3xl font-black text-rose-600">{formatIDR(totalUnpaid)}</div>
          </div>
        </header>

        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
          <CardHeader className="bg-white border-b border-slate-100 py-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">Invoices</CardTitle>
                <CardDescription className="text-slate-500">Daftar seluruh invoice Anda di PT Solusi Digital Creative.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                {client.invoices.length} Invoices
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100 border-b">
                  <TableHead className="py-4 px-6 font-semibold text-slate-700 h-auto">Invoice #</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700 h-auto">Project</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700 h-auto">Date</TableHead>
                  <TableHead className="py-4 font-semibold text-slate-700 text-right h-auto">Amount</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-slate-700 text-center h-auto">Status</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-slate-700 text-right h-auto">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {client.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic bg-white">
                      Belum ada invoice yang tercatat.
                    </TableCell>
                  </TableRow>
                ) : (
                  client.invoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50 transition-colors border-slate-100 bg-white">
                      <TableCell className="py-4 px-6 font-bold text-slate-900 bg-white">{inv.invoiceNumber}</TableCell>
                      <TableCell className="py-4 text-slate-600 font-medium bg-white">{inv.project?.name || "-"}</TableCell>
                      <TableCell className="py-4 text-slate-500 bg-white">{formatDateID(inv.createdAt)}</TableCell>
                      <TableCell className="py-4 text-right font-semibold text-slate-900 bg-white">{formatIDR(inv.amountBruto.toString())}</TableCell>
                      <TableCell className="py-4 px-6 text-center bg-white">
                        <Badge 
                          className={inv.status === InvoiceStatus.PAID 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" 
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50"
                          }
                          variant="outline"
                        >
                          {inv.status === InvoiceStatus.PAID ? "LUNAS" : "BELUM BAYAR"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right bg-white">
                        <div className="flex justify-end gap-2">
                          <Link href={`/invoices/${inv.id}/print?token=${token}`} target="_blank">
                            <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200 hover:bg-slate-50 text-slate-600">
                              <FileText className="mr-1 h-3 w-3" />
                              Invoice
                            </Button>
                          </Link>
                          {inv.status === InvoiceStatus.PAID && (
                            <Link href={`/invoices/${inv.id}/receipt?token=${token}`} target="_blank">
                              <Button variant="outline" size="sm" className="h-8 text-xs border-emerald-200 hover:bg-emerald-50 text-emerald-600">
                                <Receipt className="mr-1 h-3 w-3" />
                                Kwitansi
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <footer className="text-center py-8 space-y-2">
          <p className="text-sm font-semibold text-slate-400">&copy; {new Date().getFullYear()} PT Solusi Digital Creative</p>
          <p className="text-xs text-slate-300">Jika ada pertanyaan, silakan hubungi Finance kami.</p>
        </footer>
      </div>
    </div>
  );
}
