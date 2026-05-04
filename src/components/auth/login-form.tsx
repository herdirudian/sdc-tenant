"use client";

import { useState, useTransition } from "react";
import { requestPasswordReset, signIn, verifyAndResetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type AuthMode = "login" | "forgot" | "reset";

export function LoginForm({ initialMessage }: { initialMessage?: string | null }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialMessage || null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = async (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      // signIn will redirect on success, so we only handle errors
      const result = await signIn(formData);
      // If we reach here, there was an error (though signIn usually redirects)
      // The current signIn implementation in auth.ts uses redirect() which throws.
      // But if it returns an object, we can show it.
    });
  };

  const handleRequestReset = async (formData: FormData) => {
    setError(null);
    setSuccess(null);
    const emailValue = formData.get("email") as string;
    setEmail(emailValue);

    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Kode verifikasi telah dikirim ke email Anda.");
        setMode("reset");
      }
    });
  };

  const handleVerifyReset = async (formData: FormData) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await verifyAndResetPassword(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Password berhasil diubah. Silakan login kembali.");
        setMode("login");
      }
    });
  };

  if (mode === "login") {
    return (
      <div className="grid gap-6">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-600">
            {success}
          </div>
        )}
        <form action={handleLogin} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="email@example.com" required />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs text-primary hover:underline"
              >
                Lupa password?
              </button>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Login
        </Button>
      </form>

      <div className="text-center text-sm">
        Belum punya akun?{" "}
        <a href="/register" className="text-primary hover:underline font-medium">
          Daftar sekarang
        </a>
      </div>
    </div>
  );
}

  if (mode === "forgot") {
    return (
      <div className="grid gap-6">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">Lupa Password</h2>
          <p className="text-sm text-muted-foreground">
            Masukkan email Anda untuk menerima kode verifikasi.
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <form action={handleRequestReset} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="email@example.com" required />
          </div>
          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Kode Verifikasi
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              disabled={isPending}
            >
              Kembali ke Login
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Verifikasi Reset Password</h2>
        <p className="text-sm text-muted-foreground">
          Masukkan kode yang dikirim ke <b>{email}</b> dan password baru Anda.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-600">
          {success}
        </div>
      )}
      <form action={handleVerifyReset} className="grid gap-4">
        <input type="hidden" name="email" value={email} />
        <div className="grid gap-2">
          <Label htmlFor="code">Kode Verifikasi</Label>
          <Input id="code" name="code" type="text" placeholder="123456" maxLength={6} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password Baru</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setSuccess(null);
            }}
            disabled={isPending}
          >
            Ganti Email
          </Button>
        </div>
      </form>
    </div>
  );
}
