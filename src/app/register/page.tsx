import { RegisterForm } from "./register-form";
import { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Daftar - Solusi Invoice",
  description: "Daftar akun baru untuk Solusi Invoice",
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await getSession();
  
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50/30 p-4 dark:bg-blue-950/10">
      <div className="w-full max-w-2xl rounded-3xl border-2 border-primary/20 bg-card p-10 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <a href="/login">
            <img src="/icon.png" alt="Solusi Invoice" className="h-24 w-auto cursor-pointer" />
          </a>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">Daftar Akun Baru</h1>
            <p className="text-muted-foreground mt-2">Mulai Kelola Bisnis Anda dengan Solusi Invoice</p>
          </div>
        </div>
        <div className="relative z-20">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
