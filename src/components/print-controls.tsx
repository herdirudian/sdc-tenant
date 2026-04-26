"use client";

import { Button } from "@/components/ui/button";

export function PrintControls() {
  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}

