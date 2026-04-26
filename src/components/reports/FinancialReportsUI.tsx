"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIDR, formatDateID } from "@/lib/format";
import { Download, FileText, Search, Loader2 } from "lucide-react";
import { getPnLReport, getTaxRecapReport, PnLData, TaxRecapData } from "@/actions/report";

export function FinancialReportsUI() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<"pnl" | "tax">("pnl");
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [taxData, setTaxData] = useState<TaxRecapData | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (reportType === "pnl") {
        const data = await getPnLReport(dateRange);
        setPnlData(data);
        setTaxData(null);
      } else {
        const data = await getTaxRecapReport(dateRange);
        setTaxData(data);
        setPnlData(null);
      }
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const endpoint = reportType === "pnl" ? "/api/export/pnl" : "/api/export/tax-recap";
    window.location.href = `${endpoint}?from=${dateRange.from}&to=${dateRange.to}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
          <CardDescription>Pilih jenis laporan dan periode waktu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label>Jenis Laporan</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as "pnl" | "tax")}
              >
                <option value="pnl">Laba Rugi (P&L)</option>
                <option value="tax">Rekapitulasi Pajak (PPh)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Dari Tanggal</Label>
              <Input 
                type="date" 
                value={dateRange.from} 
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai Tanggal</Label>
              <Input 
                type="date" 
                value={dateRange.to} 
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={fetchReport} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Tampilkan
              </Button>
              {(pnlData || taxData) && (
                <Button variant="outline" onClick={handleExportCSV} className="flex-1">
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {pnlData && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Ringkasan Laba Rugi</CardTitle>
              <CardDescription>Periode: {dateRange.from} s/d {dateRange.to}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="font-medium">Total Pendapatan (Income)</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatIDR(pnlData.income)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="font-medium">Total Pengeluaran (Expenses)</span>
                  <span className="text-xl font-bold text-red-600 dark:text-red-400">({formatIDR(pnlData.expenses)})</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <span className="font-medium">Total Gaji (Payroll)</span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">({formatIDR(pnlData.payroll)})</span>
                </div>
                <div className="flex justify-between items-center p-4 border-t-2 border-dashed pt-6">
                  <span className="text-lg font-bold">Laba Bersih (Net Profit)</span>
                  <span className={`text-2xl font-black ${Number(pnlData.netProfit) >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatIDR(pnlData.netProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Breakdown Pengeluaran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pnlData.expenseBreakdown.map((item) => (
                  <div key={item.category} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.category}</span>
                    <span className="font-medium">{formatIDR(item.amount)}</span>
                  </div>
                ))}
                {pnlData.expenseBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada data pengeluaran.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {taxData && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Rekapitulasi Pajak PPh Final</CardTitle>
                <CardDescription>Daftar PPh dari invoice yang sudah dibayar pada periode ini.</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total PPh Terhutang</div>
                <div className="text-xl font-bold text-red-600">{formatIDR(taxData.totalTax)}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-800">
                <div className="text-xs text-green-700 dark:text-green-300">Sudah Setor</div>
                <div className="text-lg font-bold text-green-600">{formatIDR(taxData.paidTax)}</div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-100 dark:border-amber-800">
                <div className="text-xs text-amber-700 dark:text-amber-300">Belum Setor</div>
                <div className="text-lg font-bold text-amber-600">{formatIDR(taxData.unpaidTax)}</div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Tgl Bayar</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">PPh (0.5%)</TableHead>
                  <TableHead>Status Setor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxData.items.map((item) => (
                  <TableRow key={item.invoiceNumber}>
                    <TableCell className="font-medium">{item.invoiceNumber}</TableCell>
                    <TableCell>{item.clientName}</TableCell>
                    <TableCell>{item.paidAt ? formatDateID(item.paidAt) : "-"}</TableCell>
                    <TableCell className="text-right">{formatIDR(item.amountBruto)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">{formatIDR(item.taxPphFinal)}</TableCell>
                    <TableCell>
                      {item.pphPaidAt ? (
                        <div className="text-xs">
                          <span className="text-green-600 font-bold">LUNAS</span>
                          <div className="text-muted-foreground">NTPN: {item.pphNtpn}</div>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-bold text-xs">PENDING</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {taxData.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Tidak ada data pajak pada periode ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
