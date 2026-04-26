import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { formatIDR, formatDateID, terbilang } from "./format";

interface ReceiptData {
  invoiceNumber: string;
  type: string;
  projectName?: string | null;
  amountBruto: number;
  taxPphFinal: number;
  isDeductedByClient: boolean;
  client: {
    name: string;
    companyName?: string | null;
  };
}

interface CompanySettings {
  companyName: string;
  address?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signatureName?: string | null;
}

function getFont(isBold = false): string | Buffer {
  const fontFileName = isBold ? "arialbd.ttf" : "arial.ttf";
  const attemptedPaths: string[] = [];

  try {
    const publicPath = path.join(process.cwd(), "public", "fonts", fontFileName);
    attemptedPaths.push(publicPath);
    if (fs.existsSync(publicPath)) return fs.readFileSync(publicPath);

    const libPath = path.join(process.cwd(), "src", "lib", "fonts", fontFileName);
    attemptedPaths.push(libPath);
    if (fs.existsSync(libPath)) return fs.readFileSync(libPath);

    if (process.platform === "win32") {
      const sysPath = path.join("C:", "Windows", "Fonts", fontFileName);
      attemptedPaths.push(sysPath);
      if (fs.existsSync(sysPath)) return fs.readFileSync(sysPath);
    }
  } catch (err) {}
  
  throw new Error(`Font ${fontFileName} not found. Attempted paths: ${attemptedPaths.join(", ")}`);
}

export async function generateReceiptPdf(data: ReceiptData, settings: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: "A4", 
      margin: 40,
      font: getFont()
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const brandColor = "#1e40af"; // Deep blue
    const amountToDisplay = data.isDeductedByClient ? data.amountBruto - data.taxPphFinal : data.amountBruto;

    // Header section
    if (settings.logoUrl) {
      try {
        const logoPath = path.join(process.cwd(), "public", settings.logoUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 40, { width: 80 });
        }
      } catch (err) {
        console.error("[Receipt PDF] Failed to load logo:", err);
      }
    }

    doc.fillColor(brandColor).fontSize(28).font(getFont(true)).text("KWITANSI", 130, 45);
    doc.fillColor("#666666").fontSize(10).font(getFont()).text(`No. ${data.invoiceNumber.replace("INV", "KWT")}`, 130, 75);

    doc.fillColor("#000000").fontSize(12).font(getFont(true)).text(settings.companyName, 350, 45, { align: "right" });
    doc.fontSize(8).font(getFont()).fillColor("#666666").text(settings.address || "", 350, 60, { align: "right", width: 200 });

    doc.moveTo(40, 110).lineTo(555, 110).strokeColor("#eeeeee").lineWidth(1).stroke();

    // Content section
    let currentY = 140;
    const labelX = 40;
    const contentX = 180;

    // Received From
    doc.fillColor("#999999").fontSize(8).font(getFont(true)).text("TELAH TERIMA DARI", labelX, currentY);
    doc.fillColor("#000000").fontSize(12).font(getFont(true)).text(data.client.companyName || data.client.name, contentX, currentY);
    
    currentY += 40;
    doc.moveTo(contentX, currentY - 10).lineTo(555, currentY - 10).dash(5, { space: 5 }).strokeColor("#cccccc").stroke().undash();

    // Amount in Words
    doc.fillColor("#999999").fontSize(8).font(getFont(true)).text("UANG SEJUMLAH", labelX, currentY);
    doc.rect(contentX, currentY - 5, 375, 30).fill("#f9fafb");
    doc.fillColor("#000000").fontSize(10).font(getFont(false)).text(`### ${terbilang(amountToDisplay)} Rupiah ###`, contentX + 10, currentY + 5);
    
    currentY += 40;
    doc.moveTo(contentX, currentY - 10).lineTo(555, currentY - 10).dash(5, { space: 5 }).strokeColor("#cccccc").stroke().undash();

    // For Payment
    doc.fillColor("#999999").fontSize(8).font(getFont(true)).text("UNTUK PEMBAYARAN", labelX, currentY);
    doc.fillColor("#000000").fontSize(10).font(getFont()).text(`Pembayaran ${data.type} - ${data.projectName || "Services"}`, contentX, currentY);
    doc.fillColor("#666666").fontSize(9).text(`(Invoice: ${data.invoiceNumber})`, contentX, currentY + 15);

    currentY += 40;
    doc.moveTo(contentX, currentY - 10).lineTo(555, currentY - 10).dash(5, { space: 5 }).strokeColor("#cccccc").stroke().undash();

    // Footer section
    currentY += 40;

    // Amount Box
    doc.rect(40, currentY, 200, 50).fill(brandColor);
    doc.fillColor("#ffffff").fontSize(8).font(getFont(true)).text("TERBILANG (IDR)", 55, currentY + 10);
    doc.fontSize(16).text(formatIDR(amountToDisplay), 55, currentY + 22);

    // Signature Area
    const sigX = 350;
    doc.fillColor("#000000").fontSize(10).font(getFont()).text(`Bandung, ${formatDateID(new Date())}`, sigX, currentY, { width: 200, align: "center" });
    
    if (settings.signatureUrl) {
      try {
        const signaturePath = path.join(process.cwd(), "public", settings.signatureUrl.replace(/^\/+/g, ""));
        if (fs.existsSync(signaturePath)) {
          doc.image(signaturePath, sigX + 50, currentY + 15, { height: 60 });
        }
      } catch (err) {
        console.error("[Receipt PDF] Failed to load signature:", err);
      }
    }

    doc.font(getFont(true)).text(settings.signatureName || "", sigX, currentY + 80, { width: 200, align: "center" });
    doc.moveTo(sigX + 30, currentY + 92).lineTo(sigX + 170, currentY + 92).strokeColor("#000000").lineWidth(0.5).stroke();
    doc.fontSize(8).font(getFont()).fillColor("#666666").text("AUTHORIZED SIGNATURE", sigX, currentY + 95, { width: 200, align: "center" });

    // Note
    doc.fontSize(7).fillColor("#999999").text(`Generated automatically by ${settings.companyName} System. Dokumen ini adalah bukti pembayaran sah.`, 40, 780);

    doc.end();
  });
}
