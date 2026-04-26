"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaymentMethod } from "@/generated/prisma/enums";
import { Zap, Loader2, Paperclip, X } from "lucide-react";
import { scanReceiptAction, createExpenseAction, updateExpenseAction } from "@/actions/expense";

interface ExpenseFormProps {
  editExpense?: any;
  defaultCategories: string[];
}

export function ExpenseForm({ editExpense, defaultCategories }: ExpenseFormProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({
    occurredAt: editExpense ? new Date(editExpense.occurredAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amount: editExpense ? editExpense.amount.toString() : "",
    category: editExpense ? editExpense.category : "",
    paymentMethod: editExpense ? editExpense.paymentMethod : PaymentMethod.TRANSFER,
    vendor: editExpense ? editExpense.vendor ?? "" : "",
    reference: editExpense ? editExpense.reference ?? "" : "",
    description: editExpense ? editExpense.description : "",
    attachmentUrl: editExpense ? editExpense.attachmentUrl ?? "" : "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const scanFormData = new FormData();
    scanFormData.append("file", file);

    try {
      const result = await scanReceiptAction(scanFormData);
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          amount: result.data.amount?.toString() || prev.amount,
          occurredAt: result.data.occurredAt || prev.occurredAt,
          category: result.data.category || prev.category,
          description: result.data.description || prev.description,
          vendor: result.data.vendor || prev.vendor,
          attachmentUrl: result.data.attachmentUrl || prev.attachmentUrl,
        }));
      } else {
        alert(result.error || "Gagal memproses struk");
      }
    } catch (error) {
      console.error("Scanning failed:", error);
      alert("Terjadi kesalahan saat memproses struk.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitFormData = new FormData(e.currentTarget);
    
    // Add attachmentUrl to formData if it exists
    if (formData.attachmentUrl) {
      submitFormData.set("attachmentUrl", formData.attachmentUrl);
    }

    if (editExpense) {
      await updateExpenseAction(submitFormData);
    } else {
      await createExpenseAction(submitFormData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleScan}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed border-red-300 hover:border-red-500 hover:bg-red-50"
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Memindai Struk...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4 text-red-500" />
              Scan Struk (AI)
            </>
          )}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4">
        {editExpense && <input type="hidden" name="id" value={editExpense.id} />}
        <input type="hidden" name="attachmentUrl" value={formData.attachmentUrl} />
        
        <div className="grid gap-2">
          <Label htmlFor="occurredAt">Tanggal</Label>
          <Input 
            id="occurredAt" 
            name="occurredAt" 
            type="date" 
            required 
            value={formData.occurredAt}
            onChange={handleInputChange}
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="amount">Jumlah (Rp)</Label>
          <Input 
            id="amount" 
            name="amount" 
            type="number" 
            placeholder="Contoh: 500000" 
            required 
            value={formData.amount}
            onChange={handleInputChange}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="category">Kategori</Label>
          <Input 
            id="category" 
            name="category" 
            list="category-list" 
            placeholder="Gaji / Sewa / Software / Transport" 
            required 
            value={formData.category}
            onChange={handleInputChange}
          />
          <datalist id="category-list">
            {defaultCategories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={formData.paymentMethod}
            onChange={handleInputChange}
          >
            <option value={PaymentMethod.TRANSFER}>TRANSFER</option>
            <option value={PaymentMethod.CASH}>CASH</option>
            <option value={PaymentMethod.OTHER}>LAINNYA</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="vendor">Vendor / Penerima (Opsional)</Label>
          <Input 
            id="vendor" 
            name="vendor" 
            placeholder="Contoh: Tokopedia, PLN, Nama Staff" 
            value={formData.vendor}
            onChange={handleInputChange}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reference">Referensi / No. Bukti (Opsional)</Label>
          <Input 
            id="reference" 
            name="reference" 
            placeholder="Contoh: No. Invoice Vendor" 
            value={formData.reference}
            onChange={handleInputChange}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Keterangan</Label>
          <Textarea 
            id="description" 
            name="description" 
            placeholder="Contoh: Pembayaran langganan Adobe Creative Cloud" 
            required 
            value={formData.description}
            onChange={handleInputChange}
          />
        </div>

        {formData.attachmentUrl && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-xs">
            <Paperclip className="h-3 w-3" />
            <span className="truncate flex-1">Struk terlampir</span>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-4 w-4"
              onClick={() => setFormData(prev => ({ ...prev, attachmentUrl: "" }))}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <Button type="submit" className={`w-full ${editExpense ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
          {editExpense ? "Perbarui Pengeluaran" : "Simpan Pengeluaran"}
        </Button>
      </form>
    </div>
  );
}
