"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteExpenseAction } from "@/actions/expense";

interface DeleteExpenseButtonProps {
  id: string;
}

export function DeleteExpenseButton({ id }: DeleteExpenseButtonProps) {
  const handleDelete = async (formData: FormData) => {
    if (confirm("Hapus pengeluaran ini?")) {
      await deleteExpenseAction(formData);
    }
  };

  return (
    <form action={handleDelete}>
      <input type="hidden" name="id" value={id} />
      <Button 
        type="submit"
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}
