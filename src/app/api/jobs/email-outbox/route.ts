import { enqueueDailyInvoiceReminders, processEmailOutbox } from "@/lib/email-outbox";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = req.headers.get("x-job-token") ?? url.searchParams.get("token");
  const expected = process.env.EMAIL_JOB_TOKEN;
  if (!expected || token !== expected) return new Response("Unauthorized", { status: 401 });

  const mode = url.searchParams.get("mode") ?? "all";
  const limit = Number(url.searchParams.get("limit") ?? "20");
  const workerId = url.searchParams.get("workerId") ?? undefined;

  const enqueueResult = mode === "process" ? null : await enqueueDailyInvoiceReminders({});
  const processResult = mode === "enqueue" ? null : await processEmailOutbox({ limit, workerId });

  return Response.json({
    ok: true,
    enqueue: enqueueResult,
    process: processResult,
  });
}

