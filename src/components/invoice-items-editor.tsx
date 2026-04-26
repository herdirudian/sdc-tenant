"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { formatIDR } from "@/lib/format";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
}

export function InvoiceItemsEditor() {
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, price: 0 },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), description: "", quantity: 1, price: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const totalBruto = items.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Invoice Items</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium w-24">Qty</th>
              <th className="px-4 py-2 text-right font-medium w-40">Price</th>
              <th className="px-4 py-2 text-right font-medium w-40">Total</th>
              <th className="px-4 py-2 text-center font-medium w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                  No items added. Please click "Add Item" to start.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="p-2">
                    <Input
                      name="itemDescription[]"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, { description: e.target.value })
                      }
                      placeholder="e.g. Website Development"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      name="itemQuantity[]"
                      type="number"
                      step="any"
                      className="text-right"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, {
                          quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      name="itemPrice[]"
                      type="number"
                      step="any"
                      className="text-right"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(item.id, {
                          price: parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                    />
                  </td>
                  <td className="p-2 text-right font-medium">
                    {formatIDR(item.quantity * item.price)}
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-muted/50 border-t border-border">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                Subtotal (Bruto)
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg">
                {formatIDR(totalBruto)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
