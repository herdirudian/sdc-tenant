import React from "react";
import { formatIDR } from "@/lib/format";

interface MonthlyTrend {
  label: string;
  income: number;
  expense: number;
}

export function SimpleBarChart({ data }: { data: MonthlyTrend[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1000000);

  return (
    <div className="flex h-[200px] items-end justify-between gap-2 pt-4">
      {data.map((d, i) => {
        const incomeHeight = (d.income / maxVal) * 100;
        const expenseHeight = (d.expense / maxVal) * 100;

        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-1 px-1">
              {/* Income Bar */}
              <div
                className="w-full rounded-t bg-green-500/80 transition-all hover:bg-green-500"
                style={{ height: `${Math.max(incomeHeight, 2)}%` }}
                title={`Income: ${formatIDR(d.income)}`}
              />
              {/* Expense Bar */}
              <div
                className="w-full rounded-t bg-red-500/80 transition-all hover:bg-red-500"
                style={{ height: `${Math.max(expenseHeight, 2)}%` }}
                title={`Expense: ${formatIDR(d.expense)}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{d.label}</span>
            
            {/* Tooltip on hover */}
            <div className="pointer-events-none absolute bottom-full mb-2 hidden w-32 flex-col rounded bg-popover p-2 text-[10px] shadow-md group-hover:flex border border-border z-10">
              <div className="flex justify-between">
                <span>Income:</span>
                <span className="font-medium text-green-600">{formatIDR(d.income)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expense:</span>
                <span className="font-medium text-red-600">{formatIDR(d.expense)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
