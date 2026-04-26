"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentMethod } from "@/generated/prisma/enums";
import { addInvoicePayment } from "@/actions/invoice";
import { useState } from "react";

export function AddPaymentForm({ 
  invoiceId, 
  remaining 
}: { 
  invoiceId: string; 
  remaining: number;
}) {
  const [amount, setAmount] = useState(remaining.toString());

  return (
    <form action={addInvoicePayment} className="grid gap-4 rounded-xl border border-border p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px]"
          onClick={() => setAmount((remaining * 0.5).toString())}
        >
          DP 50%
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px]"
          onClick={() => setAmount((remaining * 0.3).toString())}
        >
          DP 30%
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px]"
          onClick={() => setAmount(remaining.toString())}
        >
          Pelunasan (100%)
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount</Label>
          <Input 
            id="amount" 
            name="amount" 
            inputMode="decimal" 
            placeholder="1000000" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required 
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="method">Method</Label>
          <select
            id="method"
            name="method"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={PaymentMethod.TRANSFER}
          >
            <option value={PaymentMethod.TRANSFER}>TRANSFER</option>
            <option value={PaymentMethod.CASH}>CASH</option>
            <option value={PaymentMethod.OTHER}>OTHER</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paidAt">Paid At</Label>
          <Input id="paidAt" name="paidAt" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="note">Note (Optional)</Label>
        <Input id="note" name="note" placeholder="DP Termin 1, Pelunasan, dll" />
      </div>
      <div className="flex justify-end">
        <Button type="submit">Add Payment</Button>
      </div>
    </form>
  );
}
