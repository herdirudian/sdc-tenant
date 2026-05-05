import { prisma } from "@/lib/prisma";
import { EmailMessageType, InvoiceStatus, SubscriptionStatus } from "@prisma/client";
import { enqueueInvoiceEmail, enqueueSystemEmail, processEmailOutbox } from "./email-outbox";
import { formatIDR } from "./format";

/**
 * Sends weekly revenue reports to all tenant admins.
 * Covers revenue from the last 7 days.
 */
export async function sendWeeklyRevenueReports() {
  const now = new Date();
  
  // Calculate last week's range (last 7 days)
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(now.getDate() - 7);
  lastWeekStart.setHours(0, 0, 0, 0);
  
  const lastWeekEnd = new Date(now);
  lastWeekEnd.setHours(23, 59, 59, 999);

  const dateRangeStr = `${lastWeekStart.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })} - ${lastWeekEnd.toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}`;

  console.log(`[Reports] Generating weekly reports for range: ${dateRangeStr}`);

  const tenants = await prisma.tenant.findMany({
    include: {
      users: {
        where: { role: "ADMIN", isActive: true },
        take: 1,
      },
    },
  });

  let sentCount = 0;

  for (const tenant of tenants) {
    const admin = tenant.users[0];
    if (!admin) continue;

    // 1. Get Revenue (PAID Invoices)
    const revenueData = await prisma.invoicePayment.aggregate({
      where: {
        invoice: { tenantId: tenant.id },
        paidAt: { gte: lastWeekStart, lte: lastWeekEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    // 2. Get New Invoices Created
    const newInvoicesCount = await prisma.invoice.count({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: lastWeekStart, lte: lastWeekEnd },
      },
    });

    // 3. Get Top Recent Paid Invoices
    const topPaid = await prisma.invoice.findMany({
      where: {
        tenantId: tenant.id,
        status: InvoiceStatus.PAID,
        paidAt: { gte: lastWeekStart, lte: lastWeekEnd },
      },
      include: { client: true },
      orderBy: { amountBruto: "desc" },
      take: 3,
    });

    const totalRevenue = Number(revenueData._sum.amount ?? 0);
    const dedupeKey = `weekly-report-${tenant.id}-${lastWeekEnd.toISOString().slice(0, 10)}`;

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;border-radius:8px">
        <div style="text-align:center;margin-bottom:20px">
          <div style="display:inline-block;background:#2563eb;color:white;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold;margin-bottom:10px">LAPORAN MINGGUAN</div>
          <h2 style="margin:0;color:#111827">Rangkuman Bisnis Anda</h2>
          <p style="margin:5px 0 0 0;color:#6b7280;font-size:14px">${dateRangeStr}</p>
        </div>

        <p style="color:#374151">Halo <b>${admin.name}</b>,</p>
        <p style="color:#374151">Berikut adalah ringkasan performa <b>${tenant.name}</b> selama satu minggu terakhir:</p>

        <div style="display:grid;grid-template-cols:1fr 1fr;gap:15px;margin:25px 0">
          <div style="background:#f0f9ff;padding:15px;border-radius:10px;border:1px solid #bae6fd;text-align:center">
            <div style="font-size:12px;color:#0369a1;font-weight:bold;text-transform:uppercase">Pendapatan Cair</div>
            <div style="font-size:20px;font-weight:bold;color:#0c4a6e;margin-top:5px">${formatIDR(totalRevenue)}</div>
            <div style="font-size:11px;color:#0369a1;margin-top:2px">${revenueData._count._all} Pembayaran</div>
          </div>
          <div style="background:#f8fafc;padding:15px;border-radius:10px;border:1px solid #e2e8f0;text-align:center">
            <div style="font-size:12px;color:#475569;font-weight:bold;text-transform:uppercase">Invoice Baru</div>
            <div style="font-size:20px;font-weight:bold;color:#1e293b;margin-top:5px">${newInvoicesCount}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px">Diterbitkan</div>
          </div>
        </div>

        ${topPaid.length > 0 ? `
          <div style="margin-top:25px">
            <h3 style="font-size:14px;color:#374151;margin-bottom:10px">Pembayaran Terbesar Minggu Ini:</h3>
            <table style="width:100%;font-size:13px;border-collapse:collapse">
              ${topPaid.map(inv => `
                <tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:10px 0;color:#111827"><b>${inv.invoiceNumber}</b><br/><span style="color:#6b7280;font-size:11px">${inv.client.name}</span></td>
                  <td style="padding:10px 0;text-align:right;font-weight:bold;color:#111827">${formatIDR(Number(inv.amountBruto))}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        ` : ''}

        <div style="text-align:center;margin:35px 0">
          <a href="${process.env.APP_BASE_URL || 'http://localhost:3000'}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">Lihat Dashboard Lengkap</a>
        </div>

        <hr style="border:0;border-top:1px solid #eee;margin:20px 0" />
        <div style="color:#9ca3af;font-size:12px;text-align:center">
          Laporan ini dikirim secara otomatis oleh <b>Solusi Invoice</b>.
        </div>
      </div>
    `.trim();

    try {
      await enqueueSystemEmail({
        tenantId: tenant.id,
        toEmail: admin.email,
        subject: `Laporan Mingguan: ${formatIDR(totalRevenue)} Cair Minggu Ini`,
        html,
        type: EmailMessageType.WEEKLY_REVENUE_REPORT,
        dedupeKey,
      });
      sentCount++;
    } catch (err) {
      if ((err as any).code === 'P2002') continue;
      console.error(`[Reports] Failed to queue report for tenant ${tenant.name}:`, err);
    }
  }

  return { sentCount };
}

/**
 * Checks for subscriptions expiring in 3 days and queues reminder emails.
 */
export async function checkAndQueueSubscriptionReminders() {
  const now = new Date();
  
  // Expiry in exactly 3 days
  const targetDateStart = new Date(now);
  targetDateStart.setDate(now.getDate() + 3);
  targetDateStart.setHours(0, 0, 0, 0);
  
  const targetDateEnd = new Date(now);
  targetDateEnd.setDate(now.getDate() + 3);
  targetDateEnd.setHours(23, 59, 59, 999);

  console.log(`[Reminders] Checking for subscriptions expiring between ${targetDateStart.toISOString()} and ${targetDateEnd.toISOString()}`);

  const expiringSoon = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
      expiresAt: { gte: targetDateStart, lte: targetDateEnd },
    },
    include: {
      tenant: {
        include: {
          users: {
            where: { role: "ADMIN", isActive: true },
            take: 1,
          },
        },
      },
    },
  });

  let queuedCount = 0;

  for (const sub of expiringSoon) {
    const admin = sub.tenant.users[0];
    if (!admin) continue;

    const dedupeKey = `sub-expiry-3d-${sub.tenantId}-${targetDateStart.toISOString().slice(0, 10)}`;
    
    const isTrial = sub.status === SubscriptionStatus.TRIAL;
    const subject = isTrial 
      ? `Penting: Masa Trial Anda Akan Berakhir dalam 3 Hari` 
      : `Penting: Langganan Anda Akan Berakhir dalam 3 Hari`;

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;border-radius:8px">
        <h2 style="margin:0 0 16px 0;color:#2563eb">${isTrial ? 'Masa Trial Hampir Berakhir' : 'Langganan Hampir Berakhir'}</h2>
        <p style="color:#374151;margin-bottom:20px">Halo <b>${admin.name}</b>,</p>
        <p style="color:#374151;margin-bottom:20px">Kami ingin menginformasikan bahwa masa ${isTrial ? 'Trial' : 'Langganan'} untuk akun <b>${sub.tenant.name}</b> akan berakhir pada <b>${sub.expiresAt?.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</b>.</p>
        
        <div style="background-color:#eff6ff;padding:15px;border-radius:6px;margin-bottom:20px;border-left:4px solid #2563eb">
          <p style="margin:0;font-size:14px;color:#1e40af">
            Jangan biarkan operasional bisnis Anda terhenti. Segera lakukan pembayaran untuk memperpanjang akses ke semua fitur premium <b>Sistem Invoice SDC</b>.
          </p>
        </div>

        <div style="text-align:center;margin:30px 0">
          <a href="${process.env.APP_BASE_URL || 'http://localhost:3000'}/settings" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">Perpanjang Sekarang</a>
        </div>

        <p style="color:#4b5563;font-size:13px">Setelah melakukan pembayaran, status akun Anda akan otomatis diperbarui.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0" />
        <div style="color:#9ca3af;font-size:12px;text-align:center">
          Pesan ini dikirim secara otomatis oleh <b>Solusi Invoice</b>.
        </div>
      </div>
    `.trim();

    try {
      await enqueueSystemEmail({
        tenantId: sub.tenantId,
        toEmail: admin.email,
        subject,
        html,
        type: EmailMessageType.SUBSCRIPTION_EXPIRING_SOON,
        dedupeKey,
      });
      queuedCount++;
      console.log(`[Reminders] Queued expiry reminder for tenant ${sub.tenant.name}`);
    } catch (err) {
      if ((err as any).code === 'P2002') continue;
      console.error(`[Reminders] Failed to queue expiry reminder for tenant ${sub.tenant.name}:`, err);
    }
  }

  return { queuedCount };
}

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
  
  const now = new Date();
  const isMonday = now.getDay() === 1; // 0 = Sunday, 1 = Monday

  const reminders = await checkAndQueueInvoiceReminders();
  const subReminders = await checkAndQueueSubscriptionReminders();
  
  let reportResult = { sentCount: 0 };
  if (isMonday) {
    reportResult = await sendWeeklyRevenueReports();
  }

  const emailProcess = await processEmailOutbox({ limit: 50 });
  console.log("[Automation] Cycle complete.", { reminders, subReminders, reportResult, emailProcess });
  return { reminders, subReminders, reportResult, emailProcess };
}
