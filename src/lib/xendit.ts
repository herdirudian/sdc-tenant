const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || "";
const XENDIT_API_URL = "https://api.xendit.co";

export async function createXenditInvoice(input: {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}) {
  const auth = Buffer.from(`${XENDIT_SECRET_KEY}:`).toString("base64");
  
  const response = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      payer_email: input.payerEmail,
      description: input.description,
      success_redirect_url: input.successRedirectUrl,
      failure_redirect_url: input.failureRedirectUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Xendit error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

// For Recurring Payments (Subscriptions), Xendit has a different API.
// However, for simplicity in this first version, we can just use Invoices 
// and handle the "monthly" logic in our system (e.g., creating a new invoice every month).
// Or we can use Xendit Subscriptions.

export async function createXenditSubscriptionPlan(input: {
  name: string;
  amount: number;
  interval: "MONTH";
  interval_count: number;
}) {
  const auth = Buffer.from(`${XENDIT_SECRET_KEY}:`).toString("base64");
  
  const response = await fetch(`${XENDIT_API_URL}/recurring/plans`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference_id: `plan_${Date.now()}`,
      name: input.name,
      amount: input.amount,
      currency: "IDR",
      schedule: {
        reference_id: `sch_${Date.now()}`,
        interval: input.interval,
        interval_count: input.interval_count,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Xendit error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}
