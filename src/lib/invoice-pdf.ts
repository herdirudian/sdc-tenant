import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { formatIDR, formatDateID } from "./format";

interface InvoiceData {
  invoiceNumber: string;
  taxInvoiceNumber?: string | null;
  createdAt: Date;
  dueDate: Date | null;
  type: string;
  poReference?: string | null;
  taxMethod: string;
  amountBruto: number;
  taxPpnRate: number;
  taxPpnAmount: number;
  taxPphRate: number;
  taxPphAmount: number;
  taxPphType?: string | null;
  taxOtherRate: number;
  taxOtherAmount: number;
  taxOtherLabel?: string | null;
  taxPphFinal: number;
  isDeductedByClient: boolean;
  client: {
    name: string;
    companyName?: string | null;
    address?: string | null;
    npwp?: string | null;
  };
  items?: Array<{
    description: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
  bankAccounts?: Array<{
    accountName: string;
    accountNumber: string;
    label: string;
  }>;
}

interface CompanySettings {
  companyName: string;
  address?: string | null;
  npwp?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  letterheadUrl?: string | null;
  signatureName?: string | null;
  signatureTitle?: string | null;
}

function getFont(isBold = false): string | Buffer {
  const fontFileName = isBold ? "arialbd.ttf" : "arial.ttf";
  try {
    const publicPath = path.join(process.cwd(), "public", "fonts", fontFileName);
    if (fs.existsSync(publicPath)) return fs.readFileSync(publicPath);
    const libPath = path.join(process.cwd(), "src", "lib", "fonts", fontFileName);
    if (fs.existsSync(libPath)) return fs.readFileSync(libPath);
    if (process.platform === "win32") {
      const sysPath = path.join("C:", "Windows", "Fonts", fontFileName);
      if (fs.existsSync(sysPath)) return fs.readFileSync(sysPath);
    }
  } catch (err) {}
  throw new Error(`Font ${fontFileName} not found.`);
}

export async function generateInvoicePdf(invoice: InvoiceData, settings: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: "A4", 
      margin: 50,
      font: getFont() as any
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const brandColor = "#1e293b"; // Dark Slate for more professional look
    const secondaryColor = "#64748b";
    const accentColor = "#f8fafc";

    // --- 0. Background Letterhead ---
    if (settings.letterheadUrl) {
      try {
        const letterheadPath = path.join(process.cwd(), "public", settings.letterheadUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(letterheadPath)) {
          doc.image(letterheadPath, 0, 0, { width: 595.28 });
        }
      } catch (err) {}
    }

    // --- 1. Top Section: Logo & Company Info ---
    // Only show manual header if NOT using letterhead
    if (!settings.letterheadUrl) {
      if (settings.logoUrl) {
        try {
          const logoPath = path.join(process.cwd(), "public", settings.logoUrl.replace(/^\/+/g, ""));
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { height: 50 });
          }
        } catch (err) {}
      }

      doc.fillColor("#0f172a").fontSize(14).font(getFont(true)).text(settings.companyName, 200, 50, { align: "right" });
      doc.fillColor(secondaryColor).fontSize(9).font(getFont()).text(settings.address || "", 200, 68, { align: "right", width: 345 });
      doc.text(`NPWP: ${settings.npwp || "-"}`, 200, doc.y + 2, { align: "right" });
    }

    // --- 2. Invoice Meta Section ---
    const metaY = settings.letterheadUrl ? 130 : 130;
    
    // Horizontal Line across the top of Invoice title
    doc.strokeColor("#000000").lineWidth(2).moveTo(50, metaY).lineTo(545, metaY).stroke();

    doc.fillColor("#0f172a").fontSize(28).font(getFont(true)).text("INVOICE", 50, metaY + 15);
    doc.fillColor(secondaryColor).fontSize(10).font(getFont()).text(invoice.invoiceNumber, 50, metaY + 45);
    
    // Right side meta data
    const metaX = 380;
    const drawMetaRow = (label: string, value: string, color = "#0f172a") => {
      doc.fillColor(secondaryColor).fontSize(9).font(getFont(true)).text(label.toUpperCase(), metaX, doc.y, { width: 80 });
      doc.fillColor(color).font(getFont()).text(value, metaX + 85, doc.y - 9, { align: "right", width: 80 });
      doc.moveDown(0.5);
    };

    doc.y = metaY + 20;
    drawMetaRow("Issue Date", formatDateID(invoice.createdAt));
    drawMetaRow("Due Date", formatDateID(invoice.dueDate), "#ef4444");
    if (invoice.taxInvoiceNumber) {
      drawMetaRow("Faktur Pajak", invoice.taxInvoiceNumber, "#1e40af");
    }

    // --- 3. Billing Info ---
    const billingY = metaY + 90;
    doc.fillColor(secondaryColor).fontSize(9).font(getFont(true)).text("BILL TO:", 50, billingY);
    doc.fillColor("#0f172a").fontSize(12).font(getFont(true)).text(invoice.client.companyName || invoice.client.name || "Client Name", 50, billingY + 15);
    doc.fillColor(secondaryColor).fontSize(10).font(getFont()).text(invoice.client.address || "", 50, doc.y + 2, { width: 250 });
    doc.text(`NPWP: ${invoice.client.npwp || "-"}`, 50, doc.y + 2);

    // Project Info Box on the right
    const projectX = 350;
    doc.rect(projectX, billingY, 195, 60).fill(accentColor).stroke("#e2e8f0");
    doc.fillColor(secondaryColor).fontSize(8).font(getFont(true)).text("PROJECT / REFERENCE:", projectX + 10, billingY + 10);
    doc.fillColor("#0f172a").fontSize(10).font(getFont(true)).text(invoice.project?.name || "Layanan Jasa", projectX + 10, billingY + 22, { width: 175 });
    if (invoice.poReference) {
      doc.fillColor(secondaryColor).fontSize(8).text(`PO: ${invoice.poReference}`, projectX + 10, doc.y + 2);
    }
    doc.fillColor(secondaryColor).fontSize(8).text(`Type: ${invoice.type}`, projectX + 10, doc.y + 2);

    // --- 4. Table Header ---
    const tableTop = billingY + 90;
    doc.rect(50, tableTop, 495, 25).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(9).font(getFont(true));
    doc.text("DESCRIPTION", 60, tableTop + 8);
    doc.text("QTY", 340, tableTop + 8, { width: 40, align: "center" });
    doc.text("PRICE", 390, tableTop + 8, { width: 75, align: "right" });
    doc.text("TOTAL", 470, tableTop + 8, { width: 70, align: "right" });

    // --- 5. Table Items ---
    let currentY = tableTop + 25;
    doc.fillColor("#0f172a").font(getFont()).fontSize(10);

    const items = (invoice.items && invoice.items.length > 0) 
      ? invoice.items 
      : [{ description: invoice.type, quantity: 1, price: invoice.amountBruto, amount: invoice.amountBruto }];

    items.forEach((item, index) => {
      const descHeight = doc.heightOfString(item.description, { width: 270 });
      const rowHeight = Math.max(35, descHeight + 20);

      // Zebra striping
      if (index % 2 === 1) {
        doc.rect(50, currentY, 495, rowHeight).fill(accentColor);
      }

      doc.fillColor("#0f172a").font(getFont(true)).text(item.description, 60, currentY + 12, { width: 270 });
      doc.font(getFont()).text(item.quantity.toString(), 340, currentY + 12, { width: 40, align: "center" });
      doc.text(formatIDR(item.price.toString()), 390, currentY + 12, { width: 75, align: "right" });
      doc.font(getFont(true)).text(formatIDR(item.amount.toString()), 470, currentY + 12, { width: 70, align: "right" });
      
      currentY += rowHeight;
      doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();

      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
    });

    // --- 6. Totals Section ---
    currentY += 20;
    const bruto = invoice.amountBruto;
    const ppnRate = invoice.taxPpnRate;
    const ppnAmount = invoice.taxPpnAmount;
    const pphRate = invoice.taxPphRate;
    const pphAmount = invoice.taxPphAmount;
    const otherRate = invoice.taxOtherRate;
    const otherAmount = invoice.taxOtherAmount;
    const isInclusive = invoice.taxMethod === "INCLUSIVE";

    let dpp = isInclusive ? bruto / (1 + ppnRate / 100) : bruto;
    const totalPayable = dpp + ppnAmount + otherAmount - pphAmount;

    const totalX = 350;
    const valX = 470;

    const drawTotalRow = (label: string, value: string, isBold = false, color = "#0f172a") => {
      doc.fillColor(secondaryColor).font(getFont(isBold)).fontSize(9).text(label, totalX, currentY, { width: 110, align: "right" });
      doc.fillColor(color).text(value, valX, currentY, { width: 75, align: "right" });
      currentY += 18;
    };

    drawTotalRow("Subtotal", formatIDR(dpp.toString()));
    if (ppnRate > 0) drawTotalRow(`PPN (${ppnRate}%)`, formatIDR(ppnAmount.toString()));
    if (otherRate > 0) drawTotalRow(`${invoice.taxOtherLabel || 'Other'} (${otherRate}%)`, formatIDR(otherAmount.toString()));
    if (pphRate > 0) drawTotalRow(`${invoice.taxPphType || 'PPh'} (${pphRate}%)`, `(${formatIDR(pphAmount.toString())})`, false, "#ef4444");

    currentY += 5;
    doc.rect(totalX + 20, currentY, 175, 30).fill("#0f172a");
    doc.fillColor("#ffffff").font(getFont(true)).fontSize(10).text("TOTAL PAYABLE", totalX + 30, currentY + 10);
    doc.fontSize(12).text(formatIDR(totalPayable.toString()), valX - 10, currentY + 9, { width: 85, align: "right" });

    // --- 7. Bottom Section: Payment Info & Signature ---
    currentY += 60;
    if (currentY > 650) {
      doc.addPage();
      currentY = 50;
    }

    const bottomY = currentY;
    
    // Payment Info
    doc.fillColor(secondaryColor).fontSize(9).font(getFont(true)).text("PAYMENT INFORMATION:", 50, bottomY);
    let bankY = bottomY + 20;
    const banks = (invoice.bankAccounts && invoice.bankAccounts.length > 0) ? invoice.bankAccounts : [];

    banks.forEach((bank) => {
      doc.rect(50, bankY, 200, 40).fill(accentColor).stroke("#e2e8f0");
      doc.fillColor("#0f172a").fontSize(9).font(getFont(true)).text(bank.label, 60, bankY + 8);
      doc.fillColor("#1e40af").font(getFont(true)).fontSize(10).text(bank.accountNumber, 60, bankY + 20);
      doc.fillColor(secondaryColor).font(getFont()).fontSize(8).text(bank.accountName.toUpperCase(), 60, bankY + 30);
      bankY += 45;
    });

    // Signature
    const sigX = 380;
    doc.fillColor(secondaryColor).fontSize(9).font(getFont(true)).text("AUTHORIZED SIGNATURE", sigX, bottomY, { width: 150, align: "center" });
    
    if (settings.signatureUrl) {
      try {
        const signaturePath = path.join(process.cwd(), "public", settings.signatureUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, sigX + 25, bottomY + 15, { width: 100 });
        }
      } catch (err) {}
    }

    const sigNameY = bottomY + 90;
    doc.fillColor("#0f172a").font(getFont(true)).fontSize(11).text(settings.signatureName || "", sigX, sigNameY, { width: 150, align: "center" });
    doc.rect(sigX + 25, sigNameY + 13, 100, 1).fill("#0f172a");
    doc.fillColor(secondaryColor).font(getFont()).fontSize(9).text(settings.signatureTitle || "Manager", sigX, sigNameY + 18, { width: 150, align: "center" });

    doc.end();
  });
}
  });
}
