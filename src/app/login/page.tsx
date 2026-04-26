import { bootstrapAdmin } from "@/actions/auth";
import { LoginForm } from "@/components/auth/login-form";

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
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Login</h1>
        <p className="text-sm text-muted-foreground">
          Masuk ke Sistem Internal PT Solusi Digital Creative.
        </p>
      </div>

      <LoginForm initialMessage={initialMessage} />
    </div>
  );
}
