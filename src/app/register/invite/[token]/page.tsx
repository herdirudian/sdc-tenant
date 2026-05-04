import { Metadata } from "next";
import { getInvitationByToken } from "@/actions/invitation";
import { notFound } from "next/navigation";
import { InviteAcceptForm } from "./invite-form";

export const metadata: Metadata = {
  title: "Terima Undangan - Solusi Invoice",
  description: "Selesaikan pendaftaran Anda untuk bergabung dengan tim.",
};

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation || invitation.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50/30 p-4 dark:bg-blue-950/10">
        <div className="w-full max-w-md rounded-3xl border-2 border-destructive/20 bg-card p-10 shadow-xl text-center">
          <h1 className="text-2xl font-bold text-destructive">Undangan Kadaluarsa</h1>
          <p className="mt-4 text-muted-foreground">Mohon maaf, link undangan ini sudah tidak valid atau sudah kadaluarsa. Silakan hubungi admin Anda untuk mendapatkan undangan baru.</p>
          <a href="/login" className="mt-6 inline-block text-primary hover:underline font-semibold">Kembali ke Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50/30 p-4 dark:bg-blue-950/10">
      <div className="w-full max-w-md rounded-3xl border-2 border-primary/20 bg-card p-10 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img src="/icon.png" alt="Invoice SDC" className="h-20 w-auto" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-primary">Bergabung dengan Tim</h1>
            <p className="text-muted-foreground mt-2">Anda diundang untuk bergabung di <b>{invitation.tenant.name}</b></p>
          </div>
        </div>
        <InviteAcceptForm token={token} email={invitation.email} />
      </div>
    </div>
  );
}
