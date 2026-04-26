import Link from "next/link";
import { 
  deleteExpenseAction, 
  getExpensesPaged, 
  getExpenseCategories,
  getExpenseById
} from "@/actions/expense";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { formatDateID, formatIDR } from "@/lib/format";
import { PaymentMethod, UserRole, Prisma } from "@/generated/prisma/client";
import { Plus, Filter, Trash2, ArrowLeft, Pencil, X, Paperclip } from "lucide-react";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { DeleteExpenseButton } from "@/components/expenses/DeleteExpenseButton";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    page?: string; 
    category?: string; 
    from?: string; 
    to?: string; 
    error?: string; 
    created?: string; 
    updated?: string;
    deleted?: string; 
    editId?: string;
  }>;
}) {
  const user = await requireUser();
  const canFinance = user.role === UserRole.ADMIN || user.role === UserRole.FINANCE;
  if (!canFinance) return null;

  const { page, category, from, to, error, created, updated, deleted, editId } = await searchParams;
  
  const [data, categories, editExpense] = await Promise.all([
    getExpensesPaged({ 
      page: page ? parseInt(page) : 1, 
      category, 
      from, 
      to 
    }),
    getExpenseCategories(),
    editId ? getExpenseById(editId) : Promise.resolve(null)
  ]);

  const message =
    error === "invalid"
      ? "Input tidak valid."
      : created === "1"
        ? "Pengeluaran berhasil dicatat."
        : updated === "1"
          ? "Pengeluaran berhasil diperbarui."
          : deleted === "1"
            ? "Pengeluaran berhasil dihapus."
            : null;

  // Predefined categories for suggestion
  const defaultCategories = Array.from(new Set([
    "Sewa Kantor", 
    "Software Subscription", 
    "Payroll",
    "Gaji Staff", 
    "Transportasi", 
    "Konsumsi", 
    "Internet & Listrik", 
    "Marketing",
    ...categories
  ])).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400">Pengeluaran (Expenses)</h1>
          <p className="text-sm text-muted-foreground">Kelola biaya operasional, gaji, dan pengeluaran lainnya.</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Filtered</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              {formatIDR(data.items.reduce((acc, e) => acc.add(e.amount), new Prisma.Decimal(0)).toString())}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total dari {data.items.length} transaksi di halaman ini.</p>
          </CardContent>
        </Card>
      </div>

      {message ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form Tambah/Edit Expense */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editExpense ? (
                    <Pencil className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Plus className="h-5 w-5 text-red-500" />
                  )}
                  {editExpense ? "Edit Pengeluaran" : "Catat Pengeluaran Baru"}
                </div>
                {editExpense && (
                  <Link href="/expenses">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </CardTitle>
              <CardDescription>
                {editExpense ? "Perbarui rincian biaya operasional." : "Masukkan rincian biaya operasional di sini."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseForm editExpense={editExpense} defaultCategories={defaultCategories} />
            </CardContent>
          </Card>
        </div>

        {/* Daftar Expense */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-5 w-5 text-muted-foreground" /> Riwayat Pengeluaran
                  </CardTitle>
                </div>
                <form method="get" className="flex flex-wrap gap-2">
                  <select
                    name="category"
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    defaultValue={category ?? ""}
                  >
                    <option value="">Semua Kategori</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input name="from" type="date" className="h-8 w-32 text-xs" defaultValue={from ?? ""} />
                  <Input name="to" type="date" className="h-8 w-32 text-xs" defaultValue={to ?? ""} />
                  <Button type="submit" size="sm" variant="secondary" className="h-8">Filter</Button>
                  {(category || from || to) && (
                    <Link href="/expenses">
                      <Button type="button" size="sm" variant="ghost" className="h-8">Reset</Button>
                    </Link>
                  )}
                </form>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead>Kategori & Vendor</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="w-[100px] text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((e) => (
                    <TableRow key={e.id} className={editId === e.id ? "bg-muted/50" : ""}>
                      <TableCell className="text-xs align-top">
                        {formatDateID(e.occurredAt)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="mb-1">{e.category}</Badge>
                        {e.vendor && <div className="text-xs font-medium">{e.vendor}</div>}
                        <div className="text-[10px] text-muted-foreground uppercase">{e.paymentMethod}</div>
                      </TableCell>
                      <TableCell className="max-w-[300px] align-top">
                        <div className="text-sm line-clamp-2">{e.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {e.reference && <span className="text-[10px] text-muted-foreground">Ref: {e.reference}</span>}
                          {e.attachmentUrl && (
                            <a 
                              href={e.attachmentUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                            >
                              <Paperclip className="h-3 w-3" /> Bukti
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600 align-top">
                        {formatIDR(e.amount.toString())}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1">
                          <Link href={`/expenses?editId=${e.id}${page ? `&page=${page}` : ""}${category ? `&category=${category}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-600">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <DeleteExpenseButton id={e.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Belum ada data pengeluaran.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {data.totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                  <Link href={`/expenses?page=${data.page - 1}${category ? `&category=${category}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}>
                    <Button variant="outline" size="sm" disabled={data.page <= 1}>Sebelumnya</Button>
                  </Link>
                  <div className="text-xs text-muted-foreground">Halaman {data.page} dari {data.totalPages}</div>
                  <Link href={`/expenses?page=${data.page + 1}${category ? `&category=${category}` : ""}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}>
                    <Button variant="outline" size="sm" disabled={data.page >= data.totalPages}>Selanjutnya</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
