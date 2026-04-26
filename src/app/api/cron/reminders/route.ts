import { NextResponse } from "next/server";
import { runAutomationCycle } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Simple security check using secret token
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutomationCycle();
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("[Cron] Error running automation cycle:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
