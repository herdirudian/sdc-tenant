import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, PaymentStatus } from "@prisma/client";

export async function POST(req: Request) {
  const body = await req.json();
  const xenditCallbackToken = req.headers.get("x-callback-token");

  // Debug log untuk pengecekan di VPS
  console.log("DEBUG: Xendit Callback Token received:", xenditCallbackToken);
  console.log("DEBUG: Expected Token from ENV:", process.env.XENDIT_CALLBACK_TOKEN);

  // Verify callback token if you have one set in Xendit dashboard
  if (process.env.XENDIT_CALLBACK_TOKEN) {
    if (xenditCallbackToken !== process.env.XENDIT_CALLBACK_TOKEN) {
      console.error("Xendit Webhook Unauthorized: Token mismatch");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("WARNING: XENDIT_CALLBACK_TOKEN is not set in .env. Webhook is unverified.");
  }

  const { external_id, status, amount, payment_method, paid_at } = body;

  if (external_id.startsWith("sub_")) {
    const parts = external_id.split("_");
    const tenantId = parts[1];

    if (tenantId) {
      // 1. Update Payment Record
      const paymentStatus = status === "PAID" ? PaymentStatus.PAID : 
                           status === "EXPIRED" ? PaymentStatus.EXPIRED : 
                           PaymentStatus.FAILED;

      await prisma.systemPayment.update({
        where: { externalId: external_id },
        data: {
          status: paymentStatus,
          method: payment_method,
          paidAt: paid_at ? new Date(paid_at) : null,
        }
      });

      // 2. Update Subscription if Paid
      if (status === "PAID") {
        const currentSub = await prisma.subscription.findUnique({
          where: { tenantId }
        });

        let expiresAt = new Date();
        
        // If subscription is still active, add to the current expiry date
        if (currentSub?.expiresAt && currentSub.expiresAt > new Date()) {
          expiresAt = new Date(currentSub.expiresAt);
        }

        // Add 1 month (30 days)
        expiresAt.setDate(expiresAt.getDate() + 30);

        await prisma.subscription.upsert({
          where: { tenantId },
          update: {
            status: SubscriptionStatus.ACTIVE,
            expiresAt,
            updatedAt: new Date(),
          },
          create: {
            tenantId,
            status: SubscriptionStatus.ACTIVE,
            expiresAt,
          },
        });
        console.log(`Subscription & Payment updated for tenant ${tenantId}. New expiry: ${expiresAt.toISOString()}`);
      }
    }
  }

  return Response.json({ success: true });
}
