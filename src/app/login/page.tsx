import { bootstrapAdmin } from "@/actions/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Masuk | Solusi Invoice",
  description: "Masuk ke akun Solusi Invoice Anda",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  await bootstrapAdmin();
  const { error, reset } = await searchParams;

  const initialMessage =
    reset === "1"
      ? "Admin berhasil di-reset. Silakan login dengan email/password dari .env."
      : error === "credentials"
        ? "Email atau password salah."
        : error === "inactive"
          ? "Akun dinonaktifkan. Hubungi admin."
          : error === "invalid"
            ? "Input tidak valid."
            : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <div className="flex justify-center">
          <img src="/icon.png" alt="Solusi Invoice" className="h-20 w-auto" />
        </div>
        <div className="mt-4">
          <h1 className="text-xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm text-muted-foreground">
            Masuk ke Solusi Invoice.
          </p>
        </div>
      </div>

      <LoginForm initialMessage={initialMessage} />
    </div>
  );
}
