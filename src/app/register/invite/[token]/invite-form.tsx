"use client";

import { useState, useTransition } from "react";
import { acceptInvitation } from "@/actions/invitation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

interface InviteAcceptFormProps {
  token: string;
  email: string;
}

export function InviteAcceptForm({ token, email }: InviteAcceptFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const handleAccept = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvitation(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        router.push("/");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <form action={handleAccept} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} disabled className="bg-muted" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Nama Lengkap</Label>
          <Input id="name" name="name" type="text" placeholder="Masukkan nama lengkap Anda" required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input 
              id="password" 
              name="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="Buat password minimal 6 karakter" 
              required 
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
          <div className="relative">
            <Input 
              id="confirmPassword" 
              name="confirmPassword" 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Ulangi password Anda" 
              required 
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Selesaikan Pendaftaran
        </Button>
      </form>
    </div>
  );
}
