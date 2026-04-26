import { prisma } from "@/lib/prisma";
import { EmailMessageType, EmailOutboxStatus, InvoiceStatus, Prisma } from "@/generated/prisma/client";
import { generateInvoicePdf } from "./invoice-pdf";
import { generateReceiptPdf } from "./receipt-pdf";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

function baseUrl() {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function enqueueInvoiceEmail(input: {
  invoiceId: string;
  type: EmailMessageType;
  dedupeKey?: string | null;
  createdByUserId?: string | null;
  scheduledAt?: Date;
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { 
      client: true,
      items: true,
      bankAccounts: {
        include: {
          bankAccount: true
        }
      }
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (!invoice.client.email) {
    throw new Error(`Email client "${invoice.client.name}" belum diisi. Silakan edit data client dan tambahkan email.`);
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
    select: { 
      companyName: true,
      address: true,
      npwp: true,
      logoUrl: true,
      signatureUrl: true,
      letterheadUrl: true,
      signatureName: true,
      signatureTitle: true
    },
  });
  const companyName = settings?.companyName ?? "Company";

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateInvoicePdf(
      {
        invoiceNumber: invoice.invoiceNumber,
        createdAt: invoice.createdAt,
        dueDate: invoice.dueDate,
        type: invoice.type,
        poReference: invoice.poReference,
        amountBruto: Number(invoice.amountBruto),
        taxPphFinal: Number(invoice.taxPphFinal),
        isDeductedByClient: invoice.isDeductedByClient,
        client: {
          name: invoice.client.name,
          companyName: invoice.client.companyName,
          address: invoice.client.address,
          npwp: invoice.client.npwp,
        },
        items: invoice.items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          price: Number(item.price),
          amount: Number(item.amount),
        })),
        bankAccounts: invoice.bankAccounts.map(ba => ({
          accountName: ba.bankAccount.accountName,
          accountNumber: ba.bankAccount.accountNumber,
          label: ba.bankAccount.label,
        })),
      },
      {
        companyName,
        address: settings?.address,
        npwp: settings?.npwp,
        logoUrl: settings?.logoUrl,
        signatureUrl: settings?.signatureUrl,
        letterheadUrl: settings?.letterheadUrl,
        signatureName: settings?.signatureName,
        signatureTitle: settings?.signatureTitle,
      }
    );
    console.log(`[EmailOutbox] PDF generated. Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    throw new Error(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Save PDF to disk to avoid database packet size limits
  const attachmentDir = path.join(process.cwd(), "storage", "email-attachments");
  const fileName = `${randomUUID()}.pdf`;
  const filePath = path.join(attachmentDir, fileName);

  try {
    await fs.mkdir(attachmentDir, { recursive: true });
    await fs.writeFile(filePath, pdfBuffer);
    console.log(`[EmailOutbox] PDF saved to disk: ${filePath}`);
  } catch (err) {
    console.error("Failed to save PDF to disk:", err);
    // Fallback to base64 if disk save fails (though likely to hit DB limit)
  }

  const attachments = [
    {
      filename: `Invoice-${invoice.invoiceNumber}.pdf`,
      path: filePath,
    },
  ];

  const attachmentSize = JSON.stringify(attachments).length;
  console.log(`[EmailOutbox] Total attachment metadata size: ${(attachmentSize / 1024).toFixed(2)} KB`);

  const subject = (() => {
    if (input.type === EmailMessageType.INVOICE_SENT) return `Invoice ${invoice.invoiceNumber} - ${companyName}`;
    if (input.type === EmailMessageType.REMINDER_DUE_TOMORROW) return `Pengingat: Invoice ${invoice.invoiceNumber} jatuh tempo besok`;
    if (input.type === EmailMessageType.REMINDER_OVERDUE) return `PENTING: Invoice ${invoice.invoiceNumber} Melewati Jatuh Tempo`;
    return `Pengingat: Invoice ${invoice.invoiceNumber} jatuh tempo dalam 3 hari`;
  })();

  const html = (() => {
    const bruto = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(Number(invoice.amountBruto));
    const due = invoice.dueDate ? invoice.dueDate.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }) : "-";
    
    let title = "Pemberitahuan Invoice";
    let message = "Berikut adalah rincian invoice Anda.";

    if (input.type === EmailMessageType.INVOICE_SENT) {
      title = "Invoice Baru";
      message = "Terima kasih telah menggunakan layanan kami. Kami melampirkan file PDF invoice terbaru Anda dalam email ini.";
    } else if (input.type === EmailMessageType.REMINDER_OVERDUE) {
      title = "Peringatan Jatuh Tempo";
      message = "Invoice Anda telah melewati tanggal jatuh tempo. Mohon segera melakukan pembayaran. Kami lampirkan kembali PDF invoice Anda.";
    } else if (input.type === EmailMessageType.REMINDER_DUE_TOMORROW) {
      title = "Pengingat Pembayaran";
      message = "Invoice Anda akan jatuh tempo besok. Mohon pastikan pembayaran dilakukan tepat waktu. PDF invoice terlampir.";
    } else {
      title = "Pengingat Pembayaran";
      message = "Invoice Anda akan jatuh tempo dalam 3 hari. PDF invoice terlampir.";
    }

    return `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;border-radius:8px">
        <h2 style="margin:0 0 16px 0;color:#2563eb">${title}</h2>
        <p style="color:#374151;margin-bottom:20px">${message}</p>
        <div style="background-color:#f9fafb;padding:15px;border-radius:6px;margin-bottom:20px">
          <table style="width:100%;font-size:14px">
            <tr>
              <td style="color:#6b7280;padding:4px 0">Nomor Invoice</td>
              <td style="font-weight:bold;text-align:right">${invoice.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:4px 0">Total Tagihan</td>
              <td style="font-weight:bold;text-align:right;color:#111827">${bruto}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:4px 0">Jatuh Tempo</td>
              <td style="font-weight:bold;text-align:right;color:#dc2626">${due}</td>
            </tr>
          </table>
        </div>
        <div style="color:#4b5563;font-size:13px;margin:20px 0;padding:10px;border-left:4px solid #2563eb;background:#eff6ff">
          Silakan cek lampiran email ini untuk melihat file PDF Invoice.
        </div>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0" />
        <div style="color:#9ca3af;font-size:12px;text-align:center">
          Pesan ini dikirim secara otomatis oleh sistem <b>${companyName}</b>.
        </div>
      </div>
    `.trim();
  })();

  try {
    return await prisma.emailOutbox.create({
      data: {
        type: input.type,
        status: EmailOutboxStatus.PENDING,
        dedupeKey: input.dedupeKey ?? null,
        invoiceId: invoice.id,
        toEmail: invoice.client.email,
        subject,
        html,
        attachments: attachments as any,
        scheduledAt: input.scheduledAt ?? new Date(),
        createdByUserId: input.createdByUserId ?? null,
      },
    });
  } catch (err) {
    console.error("Prisma error in enqueueInvoiceEmail:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    if (errorMessage.includes("ECONNRESET") || errorMessage.includes("connection closed")) {
      throw new Error(`Database connection closed (ECONNRESET/Closed). Sistem telah mencoba menyimpan PDF ke disk untuk mengurangi beban database, namun sepertinya database tetap memutus koneksi. \n\nSOLUSI:\n1. Restart MySQL di XAMPP.\n2. Jika masih gagal, naikkan 'max_allowed_packet' di my.ini menjadi 64M.\n3. Kompres gambar logo/kop surat agar ukuran PDF tidak membengkak.`);
    }
    throw err;
  }
}

export async function enqueueReceiptEmail(input: {
  invoiceId: string;
  createdByUserId?: string | null;
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { 
      client: true,
      project: true,
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== InvoiceStatus.PAID) throw new Error("Kwitansi hanya tersedia untuk invoice yang sudah lunas (PAID)");
  if (!invoice.client.email) {
    throw new Error(`Email client "${invoice.client.name}" belum diisi. Silakan edit data client dan tambahkan email.`);
  }

  const settings = await prisma.companySettings.findUnique({
    where: { id: "default" },
    select: { 
      companyName: true,
      address: true,
      logoUrl: true,
      signatureUrl: true,
      signatureName: true,
    },
  });
  const companyName = settings?.companyName ?? "Company";

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateReceiptPdf(
      {
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
        projectName: invoice.project?.name,
        amountBruto: Number(invoice.amountBruto),
        taxPphFinal: Number(invoice.taxPphFinal),
        isDeductedByClient: invoice.isDeductedByClient,
        client: {
          name: invoice.client.name,
          companyName: invoice.client.companyName,
        },
      },
      {
        companyName,
        address: settings?.address,
        logoUrl: settings?.logoUrl,
        signatureUrl: settings?.signatureUrl,
        signatureName: settings?.signatureName,
      }
    );
    console.log(`[EmailOutbox] Receipt PDF generated. Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error("Failed to generate Receipt PDF:", err);
    throw new Error(`Receipt PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Save PDF to disk
  const attachmentDir = path.join(process.cwd(), "storage", "email-attachments");
  const fileName = `receipt-${randomUUID()}.pdf`;
  const filePath = path.join(attachmentDir, fileName);

  try {
    await fs.mkdir(attachmentDir, { recursive: true });
    await fs.writeFile(filePath, pdfBuffer);
  } catch (err) {
    console.error("Failed to save Receipt PDF to disk:", err);
  }

  const attachments = [
    {
      filename: `Kwitansi-${invoice.invoiceNumber.replace("INV", "KWT")}.pdf`,
      path: filePath,
    },
  ];

  const subject = `Kwitansi Pembayaran ${invoice.invoiceNumber} - ${companyName}`;
  
  const amountToDisplay = invoice.isDeductedByClient 
    ? Number(invoice.amountBruto) - Number(invoice.taxPphFinal) 
    : Number(invoice.amountBruto);
  const amountStr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(amountToDisplay);

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.5;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;border-radius:8px">
      <h2 style="margin:0 0 16px 0;color:#2563eb">Kwitansi Pembayaran</h2>
      <p style="color:#374151;margin-bottom:20px">Terima kasih atas pembayaran Anda. Kami telah menerima pembayaran untuk invoice <b>${invoice.invoiceNumber}</b>.</p>
      <div style="background-color:#f9fafb;padding:15px;border-radius:6px;margin-bottom:20px">
        <table style="width:100%;font-size:14px">
          <tr>
            <td style="color:#6b7280;padding:4px 0">Nomor Invoice</td>
            <td style="font-weight:bold;text-align:right">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:4px 0">Jumlah Diterima</td>
            <td style="font-weight:bold;text-align:right;color:#16a34a">${amountStr}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:4px 0">Status</td>
            <td style="font-weight:bold;text-align:right;color:#16a34a">LUNAS / PAID</td>
          </tr>
        </table>
      </div>
      <div style="color:#4b5563;font-size:13px;margin:20px 0;padding:10px;border-left:4px solid #2563eb;background:#eff6ff">
        Silakan cek lampiran email ini untuk melihat file PDF Kwitansi resmi.
      </div>
      <hr style="border:0;border-top:1px solid #eee;margin:20px 0" />
      <div style="color:#9ca3af;font-size:12px;text-align:center">
        Pesan ini dikirim secara otomatis oleh sistem <b>${companyName}</b>.
      </div>
    </div>
  `.trim();

  return await prisma.emailOutbox.create({
    data: {
      type: EmailMessageType.RECEIPT_SENT,
      status: EmailOutboxStatus.PENDING,
      invoiceId: invoice.id,
      toEmail: invoice.client.email,
      subject,
      html,
      attachments: attachments as any,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

export async function enqueueInternalNotification(input: {
  toEmails: string[];
  subject: string;
  html: string;
  type?: EmailMessageType;
  createdByUserId?: string | null;
}) {
  const jobs = input.toEmails.map(email => ({
    type: input.type ?? EmailMessageType.INVOICE_SENT, // Use a generic type if not specified
    status: EmailOutboxStatus.PENDING,
    toEmail: email,
    subject: input.subject,
    html: input.html,
    createdByUserId: input.createdByUserId ?? null,
  }));

  return await prisma.emailOutbox.createMany({
    data: jobs,
  });
}

export async function enqueueDailyInvoiceReminders(input: { today?: Date }) {
  const today = input.today ? new Date(input.today) : new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const invoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.UNPAID,
      approvalStatus: "SENT",
      dueDate: { not: null },
    },
    select: { id: true, dueDate: true },
    take: 1000,
  });

  const dateKey = today.toISOString().slice(0, 10);
  const jobs: Array<{ invoiceId: string; type: EmailMessageType; dedupeKey: string }> = [];

  for (const inv of invoices) {
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    if (!due) continue;
    due.setHours(0, 0, 0, 0);

    // Overdue: if due date is before today
    if (due.getTime() < today.getTime()) {
      jobs.push({
        invoiceId: inv.id,
        type: EmailMessageType.REMINDER_OVERDUE,
        dedupeKey: `REMINDER_OVERDUE:${inv.id}:${dateKey}`,
      });
      continue;
    }

    // Due Tomorrow: if due date is tomorrow
    if (due.getTime() === tomorrow.getTime()) {
      jobs.push({
        invoiceId: inv.id,
        type: EmailMessageType.REMINDER_DUE_TOMORROW,
        dedupeKey: `REMINDER_DUE_TOMORROW:${inv.id}:${dateKey}`,
      });
      continue;
    }

    // Due Soon (3 days before): if due date is exactly 3 days from now
    if (due.getTime() === threeDaysFromNow.getTime()) {
      jobs.push({
        invoiceId: inv.id,
        type: EmailMessageType.REMINDER_DUE_SOON,
        dedupeKey: `REMINDER_DUE_SOON:${inv.id}:${dateKey}`,
      });
    }
  }

  let created = 0;
  for (const job of jobs) {
    try {
      await enqueueInvoiceEmail({
        invoiceId: job.invoiceId,
        type: job.type,
        dedupeKey: job.dedupeKey,
      });
      created += 1;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
    }
  }
  return { created, considered: jobs.length };
}

export async function processEmailOutbox(input: { limit?: number; workerId?: string }) {
  const limit = input.limit ?? 20;
  const workerId = input.workerId ?? `worker-${Math.random().toString(16).slice(2)}`;
  const now = new Date();
  const stale = new Date(now);
  stale.setMinutes(stale.getMinutes() - 15);

  const candidates = await prisma.emailOutbox.findMany({
    where: {
      OR: [
        {
          status: EmailOutboxStatus.PENDING,
          scheduledAt: { lte: now },
          OR: [{ sendAfter: null }, { sendAfter: { lte: now } }],
        },
        {
          status: EmailOutboxStatus.FAILED,
          scheduledAt: { lte: now },
          attempts: { lt: 5 },
          OR: [{ sendAfter: null }, { sendAfter: { lte: now } }],
        },
        {
          status: EmailOutboxStatus.SENDING,
          lockedAt: { lt: stale },
        },
      ],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const { sendEmail } = await import("@/lib/email");

  for (const job of candidates) {
    const locked = await prisma.emailOutbox.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: EmailOutboxStatus.PENDING },
          { status: EmailOutboxStatus.FAILED },
          { status: EmailOutboxStatus.SENDING, lockedAt: { lt: stale } },
        ],
      },
      data: {
        status: EmailOutboxStatus.SENDING,
        lockedAt: now,
        lockedBy: workerId,
      },
    });
    if (locked.count === 0) {
      skipped += 1;
      continue;
    }

    try {
      const attachments = job.attachments ? (job.attachments as any) : undefined;
      const result = await sendEmail({ 
        to: job.toEmail, 
        subject: job.subject, 
        html: job.html,
        attachments 
      });

      // Cleanup: Delete attachment files from disk after successful send
      if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
          if (att.path) {
            try {
              await fs.unlink(att.path);
              console.log(`[EmailOutbox] Deleted attachment file: ${att.path}`);
            } catch (unlinkErr) {
              console.warn(`[EmailOutbox] Failed to delete attachment file: ${att.path}`, unlinkErr);
            }
          }
        }
      }

      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: EmailOutboxStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.messageId,
          lastError: null,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      sent += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const delayMinutes = Math.min(60, 5 * attempts);
      const sendAfter = new Date();
      sendAfter.setMinutes(sendAfter.getMinutes() + delayMinutes);

      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: {
          status: EmailOutboxStatus.FAILED,
          lastError: err instanceof Error ? err.message : String(err),
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
          sendAfter,
        },
      });
      failed += 1;
    }
  }

  return { sent, failed, skipped, picked: candidates.length };
}
