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

    const brandColor = "#1e40af"; 
    const secondaryColor = "#64748b";
    const accentColor = "#f8fafc";

    // --- 1. Top Section: Logo & Company Info ---
    if (settings.logoUrl) {
      try {
        const logoPath = path.join(process.cwd(), "public", settings.logoUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 45, { height: 50 });
        }
      } catch (err) {}
    }

    doc.fillColor("#000000").fontSize(14).font(getFont(true)).text(settings.companyName, 200, 50, { align: "right" });
    doc.fillColor(secondaryColor).fontSize(9).font(getFont()).text(settings.address || "", 200, 68, { align: "right", width: 345 });
    doc.text(`NPWP: ${settings.npwp || "-"}`, 200, doc.y + 2, { align: "right" });

    // Divider
    doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(50, 110).lineTo(545, 110).stroke();

    // --- 2. Invoice Meta Section ---
    doc.fillColor(brandColor).fontSize(24).font(getFont(true)).text("INVOICE", 50, 130);
    
    // Right side meta data
    const metaX = 380;
    doc.fillColor("#000000").fontSize(10).font(getFont(true)).text("Invoice Number", metaX, 135);
    doc.font(getFont()).text(invoice.invoiceNumber, metaX + 85, 135, { align: "right", width: 80 });
    
    doc.font(getFont(true)).text("Date", metaX, 150);
    doc.font(getFont()).text(formatDateID(invoice.createdAt), metaX + 85, 150, { align: "right", width: 80 });
    
    doc.font(getFont(true)).text("Due Date", metaX, 165);
    doc.fillColor("#ef4444").font(getFont()).text(formatDateID(invoice.dueDate), metaX + 85, 165, { align: "right", width: 80 });

    if (invoice.taxInvoiceNumber) {
      doc.fillColor("#000000").font(getFont(true)).text("Faktur Pajak", metaX - 20, 180);
      doc.font(getFont()).text(invoice.taxInvoiceNumber, metaX + 85, 180, { align: "right", width: 80 });
    }

    // --- 3. Billing Info ---
    doc.fillColor(brandColor).fontSize(10).font(getFont(true)).text("BILL TO", 50, 210);
    doc.fillColor("#000000").fontSize(12).text(invoice.client.companyName || invoice.client.name || "Client Name", 50, 225);
    doc.fillColor(secondaryColor).fontSize(9).font(getFont()).text(invoice.client.address || "", 50, 240, { width: 250 });
    doc.text(`NPWP: ${invoice.client.npwp || "-"}`, 50, doc.y + 2);

    // --- 4. Table Header ---
    const tableTop = 310;
    doc.rect(50, tableTop, 495, 25).fill(brandColor);
    doc.fillColor("#ffffff").fontSize(9).font(getFont(true));
    doc.text("DESCRIPTION", 60, tableTop + 8);
    doc.text("QTY", 340, tableTop + 8, { width: 40, align: "center" });
    doc.text("PRICE", 390, tableTop + 8, { width: 75, align: "right" });
    doc.text("AMOUNT", 470, tableTop + 8, { width: 70, align: "right" });

    // --- 5. Table Items ---
    let currentY = tableTop + 25;
    doc.fillColor("#000000").font(getFont()).fontSize(9);

    const items = (invoice.items && invoice.items.length > 0) 
      ? invoice.items 
      : [{ description: invoice.type, quantity: 1, price: invoice.amountBruto, amount: invoice.amountBruto }];

    items.forEach((item, index) => {
      const descHeight = doc.heightOfString(item.description, { width: 270 });
      const rowHeight = Math.max(30, descHeight + 15);

      // Zebra striping
      if (index % 2 === 1) {
        doc.rect(50, currentY, 495, rowHeight).fill(accentColor);
      }

      doc.fillColor("#000000").text(item.description, 60, currentY + 10, { width: 270 });
      doc.text(item.quantity.toString(), 340, currentY + 10, { width: 40, align: "center" });
      doc.text(formatIDR(item.price), 390, currentY + 10, { width: 75, align: "right" });
      doc.text(formatIDR(item.amount), 470, currentY + 10, { width: 70, align: "right" });
      
      currentY += rowHeight;
      doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();

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

    const drawTotalRow = (label: string, value: string, isBold = false, color = "#000000") => {
      doc.fillColor(secondaryColor).font(getFont(isBold)).text(label, totalX, currentY, { width: 110, align: "right" });
      doc.fillColor(color).text(value, valX, currentY, { width: 75, align: "right" });
      currentY += 18;
    };

    drawTotalRow("Subtotal", formatIDR(dpp));
    if (ppnRate > 0) drawTotalRow(`PPN (${ppnRate}%)`, formatIDR(ppnAmount));
    if (otherRate > 0) drawTotalRow(`${invoice.taxOtherLabel || 'Other'} (${otherRate}%)`, formatIDR(otherAmount));
    if (pphRate > 0) drawTotalRow(`${invoice.taxPphType || 'PPh'} (${pphRate}%)`, `(${formatIDR(pphAmount)})`, false, "#ef4444");

    currentY += 5;
    doc.rect(totalX + 20, currentY, 175, 25).fill(brandColor);
    doc.fillColor("#ffffff").font(getFont(true)).fontSize(11).text("TOTAL PAYABLE", totalX + 30, currentY + 7);
    doc.text(formatIDR(totalPayable), valX, currentY + 7, { width: 75, align: "right" });

    // --- 7. Bottom Section: Payment Info & Signature ---
    currentY += 60;
    if (currentY > 650) {
      doc.addPage();
      currentY = 50;
    }

    const bottomY = currentY;
    
    // Payment Info
    doc.fillColor(brandColor).fontSize(10).font(getFont(true)).text("PAYMENT INFORMATION", 50, bottomY);
    let bankY = bottomY + 20;
    const banks = (invoice.bankAccounts && invoice.bankAccounts.length > 0) ? invoice.bankAccounts : [{ label: "Bank Central Asia (BCA)", accountNumber: "1234567890", accountName: "PT SDC INDONESIA" }];

    banks.forEach((bank) => {
      doc.fillColor("#000000").fontSize(9).font(getFont(true)).text(bank.label, 50, bankY);
      doc.fillColor(secondaryColor).font(getFont()).text(`Acc No: ${bank.accountNumber}`, 50, bankY + 12);
      doc.text(`Name: ${bank.accountName}`, 50, bankY + 24);
      bankY += 45;
    });

    // Signature
    const sigX = 400;
    if (settings.signatureUrl) {
      try {
        const signaturePath = path.join(process.cwd(), "public", settings.signatureUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, sigX, bottomY + 10, { width: 100 });
        }
      } catch (err) {}
    }

    doc.fillColor("#000000").font(getFont(true)).text("Authorized Signature", sigX, bottomY, { width: 100, align: "center" });
    const sigNameY = bottomY + 85;
    doc.font(getFont(true)).text(settings.signatureName || "", sigX, sigNameY, { width: 100, align: "center" });
    doc.fillColor(secondaryColor).font(getFont()).fontSize(8).text(settings.signatureTitle || "", sigX, sigNameY + 12, { width: 100, align: "center" });

    doc.end();
  });
}
