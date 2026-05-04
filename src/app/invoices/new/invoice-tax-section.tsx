"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Client {
  id: string;
  name: string;
  companyName?: string | null;
  defaultTaxMethod: string; // Use string instead of Enum to avoid Prisma import
  defaultPpnRate: string;
  defaultPphRate: string;
  defaultPphType?: string | null;
}

interface InvoiceTaxSectionProps {
  clients: Client[];
  initialClientId: string;
}

export function InvoiceTaxSection({ clients, initialClientId }: InvoiceTaxSectionProps) {
  const [selectedClientId, setSelectedClientId] = useState(initialClientId);
  const [taxMethod, setTaxMethod] = useState("EXCLUSIVE");
  const [ppnRate, setPpnRate] = useState("0");
  const [pphRate, setPphRate] = useState("0");
  const [pphType, setPphType] = useState("");

  // Update values when client changes
  useEffect(() => {
    const client = clients.find(c => c.id === selectedClientId);
    if (client) {
      setTaxMethod(client.defaultTaxMethod);
      setPpnRate(client.defaultPpnRate);
      setPphRate(client.defaultPphRate);
      setPphType(client.defaultPphType || "");
    }
  }, [selectedClientId, clients]);

  return (
    <>
      {/* Client Selection (moved here to control state) */}
      <div className="grid gap-2">
        <Label htmlFor="clientId">Client</Label>
        <select
          id="clientId"
          name="clientId"
          required
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          {clients.length === 0 ? (
            <option value="" disabled>
              Create a client first
            </option>
          ) : null}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName ? `${c.companyName} — ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Taxation Section */}
      <div className="rounded-xl border border-border p-4 bg-blue-50/30">
        <div className="text-sm font-semibold flex items-center gap-2 mb-3 text-blue-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold italic">%</span>
          Taxation & E-Faktur
        </div>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="taxMethod">Tax Method</Label>
              <select
                id="taxMethod"
                name="taxMethod"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={taxMethod}
                onChange={(e) => setTaxMethod(e.target.value)}
              >
                <option value="EXCLUSIVE">EXCLUSIVE (Tax added to total)</option>
                <option value="INCLUSIVE">INCLUSIVE (Tax included in price)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxInvoiceNumber">Nomor Faktur Pajak (E-Faktur)</Label>
              <Input id="taxInvoiceNumber" name="taxInvoiceNumber" placeholder="010.000-24.00000001" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="taxPpnRate">PPN (%)</Label>
              <Input 
                id="taxPpnRate" 
                name="taxPpnRate" 
                type="number" 
                step="0.1" 
                value={ppnRate}
                onChange={(e) => setPpnRate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxPphRate">PPh 23/4(2) (%)</Label>
              <Input 
                id="taxPphRate" 
                name="taxPphRate" 
                type="number" 
                step="0.1" 
                value={pphRate}
                onChange={(e) => setPphRate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxPphType">PPh Type (Label)</Label>
              <Input 
                id="taxPphType" 
                name="taxPphType" 
                value={pphType}
                onChange={(e) => setPphType(e.target.value)}
                placeholder="PPh 23 / PPh 4(2)" 
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="taxOtherRate">Lainnya / PB1 (%)</Label>
              <Input id="taxOtherRate" name="taxOtherRate" type="number" step="0.1" defaultValue="0" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxOtherLabel">Label Pajak Lainnya</Label>
              <Input id="taxOtherLabel" name="taxOtherLabel" placeholder="Pajak Restoran / PB1" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
