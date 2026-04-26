import { prisma } from "@/lib/prisma";
import { EmailMessageType, InvoiceStatus } from "@/generated/prisma/client";
import { enqueueInvoiceEmail, processEmailOutbox } from "./email-outbox";

/**
 * Checks for invoices that are due soon and queues reminder emails.
 * H-3 (REMINDER_DUE_SOON) and H-1 (REMINDER_DUE_TOMORROW)
 */
export async function checkAndQueueInvoiceReminders() {
  const now = new Date();
  
  // H-3 Reminder
  const in3DaysStart = new Date(now);
  in3DaysStart.setDate(now.getDate() + 3);
  in3DaysStart.setHours(0, 0, 0, 0);
  
  const in3DaysEnd = new Date(now);
  in3DaysEnd.setDate(now.getDate() + 3);
  in3DaysEnd.setHours(23, 59, 59, 999);

  // H-1 Reminder
  const in1DayStart = new Date(now);
  in1DayStart.setDate(now.getDate() + 1);
  in1DayStart.setHours(0, 0, 0, 0);
  
  const in1DayEnd = new Date(now);
  in1DayEnd.setDate(now.getDate() + 1);
  in1DayEnd.setHours(23, 59, 59, 999);

  console.log(`[Reminders] Checking for invoices due between ${in3DaysStart.toISOString()} and ${in3DaysEnd.toISOString()} (H-3)`);
  console.log(`[Reminders] Checking for invoices due between ${in1DayStart.toISOString()} and ${in1DayEnd.toISOString()} (H-1)`);

  const [h3Invoices, h1Invoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.UNPAID,
        dueDate: { gte: in3DaysStart, lte: in3DaysEnd },
      },
      select: { id: true, invoiceNumber: true },
    }),
    prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.UNPAID,
        dueDate: { gte: in1DayStart, lte: in1DayEnd },
      },
      select: { id: true, invoiceNumber: true },
    }),
  ]);

  let queuedCount = 0;

  // Process H-3
  for (const inv of h3Invoices) {
    const dedupeKey = `reminder-h3-${inv.id}`;
    try {
      await enqueueInvoiceEmail({
        invoiceId: inv.id,
        type: EmailMessageType.REMINDER_DUE_SOON,
        dedupeKey,
      });
      queuedCount++;
      console.log(`[Reminders] Queued H-3 reminder for ${inv.invoiceNumber}`);
    } catch (err) {
      if ((err as any).code === 'P2002') {
        // Already queued
        continue;
      }
      console.error(`[Reminders] Failed to queue H-3 reminder for ${inv.invoiceNumber}:`, err);
    }
  }

  // Process H-1
  for (const inv of h1Invoices) {
    const dedupeKey = `reminder-h1-${inv.id}`;
    try {
      await enqueueInvoiceEmail({
        invoiceId: inv.id,
        type: EmailMessageType.REMINDER_DUE_TOMORROW,
        dedupeKey,
      });
      queuedCount++;
      console.log(`[Reminders] Queued H-1 reminder for ${inv.invoiceNumber}`);
    } catch (err) {
      if ((err as any).code === 'P2002') {
        // Already queued
        continue;
      }
      console.error(`[Reminders] Failed to queue H-1 reminder for ${inv.invoiceNumber}:`, err);
    }
  }

  return { queuedCount };
}

/**
 * Runs the full automation cycle:
 * 1. Check for reminders and queue them
 * 2. Process the email outbox
 */
export async function runAutomationCycle() {
  console.log("[Automation] Starting cycle...");
  const reminders = await checkAndQueueInvoiceReminders();
  const emailProcess = await processEmailOutbox({ limit: 50 });
  console.log("[Automation] Cycle complete.", { reminders, emailProcess });
  return { reminders, emailProcess };
}
