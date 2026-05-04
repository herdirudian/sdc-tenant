"use client";

import { useState, useTransition } from "react";
import { register } from "@/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await register(formData);
      if (result?.error) {
        setError(result.error);
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
      <form action={handleRegister} className="grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input id="name" name="name" type="text" placeholder="Masukkan nama lengkap" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="Masukkan alamat email" required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">Nomor HP / WhatsApp</Label>
            <Input id="phone" name="phone" type="tel" placeholder="Masukkan nomor HP aktif" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="companyName">Nama Perusahaan / Bisnis</Label>
            <Input id="companyName" name="companyName" type="text" placeholder="Masukkan nama perusahaan Anda" required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Daftar Sekarang
        </Button>
      </form>
      <div className="text-center text-sm">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Login di sini
        </Link>
      </div>
    </div>
  );
}
