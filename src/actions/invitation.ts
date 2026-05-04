"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createPasswordHash, createSession, setSessionCookie } from "@/lib/auth";
import { UserRole } from "@/generated/prisma/client";
import { redirect } from "next/navigation";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  confirmPassword: z.string().min(6, "Konfirmasi password minimal 6 karakter"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password dan konfirmasi password tidak cocok",
  path: ["confirmPassword"],
});

export async function acceptInvitation(formData: FormData) {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  const { token, name, password } = parsed.data;

  // 1. Verify invitation
  const invitation = await prisma.userInvitation.findUnique({
    where: { token },
    include: { tenant: true },
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    return { error: "Undangan tidak valid atau sudah kadaluarsa." };
  }

  // 2. Check if user email already exists (safety check)
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
  });
  if (existingUser) {
    // If user exists, just delete the invitation and tell them to login
    await prisma.userInvitation.delete({ where: { id: invitation.id } });
    return { error: "Email ini sudah terdaftar. Silakan login langsung." };
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          name: name,
          passwordHash: createPasswordHash(password),
          role: invitation.role,
          isActive: true,
        },
      });

      // Delete the invitation
      await tx.userInvitation.delete({
        where: { id: invitation.id },
      });

      return newUser;
    });

    // Create session and login
    const session = await createSession(user.id);
    await setSessionCookie(session);

    // Redirect directly from server action
    redirect("/");
  } catch (err) {
    if ((err as any)?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("Failed to accept invitation:", err);
    return { error: "Terjadi kesalahan saat memproses pendaftaran." };
  }
}

export async function getInvitationByToken(token: string) {
  return prisma.userInvitation.findUnique({
    where: { token },
    include: { tenant: true },
  });
}
