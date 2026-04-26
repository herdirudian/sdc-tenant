import { runAutomationCycle } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Simple security check using secret token
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutomationCycle();
    return Response.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("[Cron] Error running automation cycle:", err);
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
