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
  const attemptedPaths: string[] = [];

  try {
    // 1. Try public folder (often safest in Next.js)
    const publicPath = path.join(process.cwd(), "public", "fonts", fontFileName);
    attemptedPaths.push(publicPath);
    if (fs.existsSync(publicPath)) return fs.readFileSync(publicPath);

    // 2. Try src/lib/fonts folder
    const libPath = path.join(process.cwd(), "src", "lib", "fonts", fontFileName);
    attemptedPaths.push(libPath);
    if (fs.existsSync(libPath)) return fs.readFileSync(libPath);

    // 3. Try Windows system fonts
    if (process.platform === "win32") {
      const sysPath = path.join("C:", "Windows", "Fonts", fontFileName);
      attemptedPaths.push(sysPath);
      if (fs.existsSync(sysPath)) return fs.readFileSync(sysPath);
    }
  } catch (err) {
    // Fall through to error reporting
  }
  
  // If we reach here, we failed to load any TTF font.
  // Instead of returning Helvetica (which triggers the AFM error), 
  // we throw a descriptive error to help debug the environment.
  throw new Error(`Font ${fontFileName} not found. Attempted paths: ${attemptedPaths.join(", ")}. CWD: ${process.cwd()}`);
}

export async function generateInvoicePdf(invoice: InvoiceData, settings: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Pass the font directly in the constructor to prevent PDFKit 
    // from attempting to load the default Helvetica font (AFM).
    const doc = new PDFDocument({ 
      size: "A4", 
      margin: 40,
      font: getFont() as any
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Header - Invoice Title
    const brandColor = "#1e40af"; // Deep blue to match logo

    doc.fillColor("#000000");
    doc.fontSize(20).font(getFont(true)).text("INVOICE", 40, 60, { align: "right" });
    doc.fontSize(10).font(getFont()).text(invoice.invoiceNumber, { align: "right" });
    if (invoice.taxInvoiceNumber) {
      doc.fontSize(8).font(getFont(true)).fillColor(brandColor).text(`Faktur Pajak: ${invoice.taxInvoiceNumber}`, { align: "right" });
    }
    if (invoice.poReference) {
      doc.fontSize(8).font(getFont()).fillColor("#666666").text(`PO: ${invoice.poReference}`, { align: "right" });
    }
    
    doc.y = 130; // Set explicit Y for Bill From/To section

    // Bill From & Bill To
    const billTop = doc.y;
    const col2X = 320;

    // Bill From
    doc.fillColor(brandColor).fontSize(10).font(getFont(true)).text("BILL FROM", 40, billTop);
    doc.fillColor("#000000").fontSize(11).font(getFont(true)).text(settings.companyName, 40, billTop + 15, { width: 250 });
    doc.font(getFont()).fontSize(9).fillColor("#444444").text(settings.address || "", 40, doc.y, { width: 250 });
    doc.text(`NPWP: ${settings.npwp || "-"}`, 40, doc.y);

    // Bill To
    doc.fillColor(brandColor).fontSize(10).font(getFont(true)).text("BILL TO", col2X, billTop);
    doc.fillColor("#000000").fontSize(11).font(getFont(true)).text(invoice.client.companyName || invoice.client.name || "Client Name", col2X, billTop + 15, { width: 250 });
    doc.font(getFont()).fontSize(9).fillColor("#444444").text(invoice.client.address || "", col2X, doc.y, { width: 250 });
    doc.text(`NPWP: ${invoice.client.npwp || "-"}`, col2X, doc.y);
    
    doc.y = Math.max(doc.y, billTop + 100);
    doc.moveDown(2);

    // Info Grid
    const infoTop = doc.y;
    doc.rect(40, infoTop, 515, 40).fill("#f3f4f6");
    
    doc.fillColor(brandColor).fontSize(8).font(getFont(true)).text("ISSUE DATE", 60, infoTop + 10);
    doc.fillColor("#000000").fontSize(9).font(getFont()).text(formatDateID(invoice.createdAt), 60, infoTop + 22);

    doc.fillColor(brandColor).fontSize(8).font(getFont(true)).text("DUE DATE", 210, infoTop + 10);
    doc.fillColor("#ef4444").fontSize(9).font(getFont()).text(formatDateID(invoice.dueDate), 210, infoTop + 22);

    doc.fillColor(brandColor).fontSize(8).font(getFont(true)).text("TYPE", 360, infoTop + 10);
    doc.fillColor("#000000").fontSize(9).font(getFont()).text(invoice.type, 360, infoTop + 22);
    
    doc.y = infoTop + 70;

    // Items Table
    const tableTop = doc.y;
    doc.fillColor(brandColor).fontSize(9).font(getFont(true));
    doc.text("Description", 45, tableTop);
    doc.text("Qty", 350, tableTop, { width: 40, align: "right" });
    doc.text("Price", 400, tableTop, { width: 75, align: "right" });
    doc.text("Amount", 485, tableTop, { width: 70, align: "right" });
    
    doc.strokeColor(brandColor).lineWidth(1).moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).stroke();
    
    let currentY = tableTop + 25;
    doc.font(getFont()).fontSize(9).fillColor("#333333");

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item) => {
        const descHeight = doc.heightOfString(item.description, { width: 280 });
        doc.text(item.description, 45, currentY + 5, { width: 280 });
        doc.text(item.quantity.toString(), 350, currentY + 5, { width: 40, align: "right" });
        doc.text(formatIDR(item.price), 400, currentY + 5, { width: 75, align: "right" });
        doc.text(formatIDR(item.amount), 485, currentY + 5, { width: 70, align: "right" });
        currentY += Math.max(30, descHeight + 15);
        
        doc.strokeColor("#eeeeee").lineWidth(0.5).moveTo(40, currentY).lineTo(555, currentY).stroke();
        currentY += 5;

        // Check for page break
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }
      });
    } else {
      doc.text(invoice.type, 45, currentY + 5);
      doc.text("1", 350, currentY + 5, { width: 40, align: "right" });
      doc.text(formatIDR(invoice.amountBruto), 400, currentY + 5, { width: 75, align: "right" });
      doc.text(formatIDR(invoice.amountBruto), 485, currentY + 5, { width: 70, align: "right" });
      currentY += 30;
      doc.strokeColor("#eeeeee").lineWidth(0.5).moveTo(40, currentY).lineTo(555, currentY).stroke();
    }

    currentY += 10;

    // Totals
    const bruto = invoice.amountBruto;
    const ppnRate = invoice.taxPpnRate;
    const ppnAmount = invoice.taxPpnAmount;
    const pphRate = invoice.taxPphRate;
    const pphAmount = invoice.taxPphAmount;
    const otherRate = invoice.taxOtherRate;
    const otherAmount = invoice.taxOtherAmount;
    const isInclusive = invoice.taxMethod === "INCLUSIVE";

    let dpp = bruto;
    if (isInclusive) {
      dpp = bruto / (1 + ppnRate / 100);
    }

    const totalPayable = dpp + ppnAmount + otherAmount - pphAmount;

    doc.fontSize(9).font(getFont()).fillColor("#444444");
    doc.text("Subtotal", 350, currentY, { width: 120, align: "right" });
    doc.fillColor("#000000").text(formatIDR(dpp), 485, currentY, { width: 70, align: "right" });
    currentY += 18;

    if (ppnRate > 0) {
      doc.fillColor("#444444").text(`PPN (${ppnRate}%)`, 350, currentY, { width: 120, align: "right" });
      doc.fillColor("#000000").text(formatIDR(ppnAmount), 485, currentY, { width: 70, align: "right" });
      currentY += 18;
    }

    if (otherRate > 0) {
      doc.fillColor("#444444").text(`${invoice.taxOtherLabel || 'Lainnya'} (${otherRate}%)`, 350, currentY, { width: 120, align: "right" });
      doc.fillColor("#000000").text(formatIDR(otherAmount), 485, currentY, { width: 70, align: "right" });
      currentY += 18;
    }

    if (pphRate > 0) {
      doc.fillColor("#444444").text(`${invoice.taxPphType || 'Potongan PPh'} (${pphRate}%)`, 350, currentY, { width: 120, align: "right" });
      doc.fillColor("#ef4444").text(`(${formatIDR(pphAmount)})`, 485, currentY, { width: 70, align: "right" });
      currentY += 18;
    }

    currentY += 7;
    doc.strokeColor(brandColor).lineWidth(1).moveTo(350, currentY - 5).lineTo(555, currentY - 5).stroke();

    doc.fontSize(11).font(getFont(true)).fillColor(brandColor);
    doc.text("Total Bayar", 350, currentY, { width: 120, align: "right" });
    doc.text(formatIDR(totalPayable), 485, currentY, { width: 70, align: "right" });

    currentY += 60;
    
    // Payment Info & Signature area
    const bottomAreaY = currentY;

    // Payment Info (Left Side)
    doc.fontSize(10).font(getFont(true)).fillColor(brandColor).text("INFORMASI PEMBAYARAN", 40, bottomAreaY);
    let bankY = bottomAreaY + 20;
    
    if (invoice.bankAccounts && invoice.bankAccounts.length > 0) {
      invoice.bankAccounts.forEach((bank) => {
        doc.fontSize(9).font(getFont(true)).text(`${bank.label}`, 40, bankY);
        doc.fontSize(9).font(getFont()).fillColor("#444444").text(`No. Rekening: ${bank.accountNumber}`, 40, bankY + 14);
        doc.text(`A/N: ${bank.accountName}`, 40, bankY + 28);
        bankY += 50;
      });
    } else {
      doc.fontSize(9).font(getFont(true)).text("Bank Central Asia (BCA)", 40, bankY);
      doc.fontSize(9).font(getFont()).fillColor("#444444").text("No. Rekening: 1234567890", 40, bankY + 14);
      doc.text("A/N: PT SDC INDONESIA", 40, bankY + 28);
    }

    // Signature (Right Side)
    const sigX = 380;
    const sigWidth = 150;

    if (settings.signatureUrl) {
      try {
        const signaturePath = path.join(process.cwd(), "public", settings.signatureUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, sigX + (sigWidth - 100) / 2, bottomAreaY, { width: 100 });
        }
      } catch (err) {
        console.error("[PDF] Failed to load signature:", err);
      }
    }

    const sigNameY = bottomAreaY + 95;
    doc.fontSize(10).font(getFont(true)).fillColor("#000000").text(settings.signatureName || "", sigX, sigNameY, { width: sigWidth, align: "center" });
    doc.fontSize(9).font(getFont()).fillColor("#444444").text(settings.signatureTitle || "", sigX, sigNameY + 15, { width: sigWidth, align: "center" });

    doc.end();
  });
}
