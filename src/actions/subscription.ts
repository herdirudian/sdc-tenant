"use server";

import { requireTenant } from "@/lib/auth";
import { createXenditInvoice } from "@/lib/xendit";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SubscriptionStatus } from "@prisma/client";
import { getGlobalSettings } from "./saas-admin";

export async function createSubscriptionInvoice() {
  const { tenantId, user, tenant, subscription } = await requireTenant();
  const globalSettings = await getGlobalSettings();

  const externalId = `sub_${tenantId}_${Date.now()}`;
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const xenditInvoice = await createXenditInvoice({
      externalId,
      amount: Number(globalSettings.subscriptionPrice),
      payerEmail: user.email,
      description: `Perpanjangan Langganan Solusi Invoice - ${user.email}`,
      successRedirectUrl: `${baseUrl}/settings?payment=success`,
      failureRedirectUrl: `${baseUrl}/checkout?sub=failed`,
    });

    // Track the payment attempt in our database
    await prisma.systemPayment.create({
      data: {
        subscriptionId: subscription?.id || "",
        externalId: externalId,
        amount: globalSettings.subscriptionPrice,
        status: "PENDING",
        xenditInvoiceUrl: xenditInvoice.invoice_url,
      }
    });
    
    redirect(xenditInvoice.invoice_url);
  } catch (error) {
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("Xendit subscription error:", error);
    redirect("/checkout?sub=error");
  }
}

export async function startFreeTrial() {
  const { tenantId, subscription } = await requireTenant();
  const globalSettings = await getGlobalSettings();

  if (subscription && subscription.status !== SubscriptionStatus.INACTIVE) {
    redirect("/checkout?sub=already_active");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + globalSettings.trialDays);

  await prisma.subscription.update({
    where: { tenantId },
    data: {
      status: SubscriptionStatus.TRIAL,
      expiresAt,
    },
  });

  redirect("/");
}

export async function getSubscriptionInfo() {
  const { tenantId } = await requireTenant();
  return prisma.subscription.findUnique({
    where: { tenantId }
  });
}
