import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function extractExpenseFromImage(imageBuffer: Buffer, mimeType: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analyze this receipt/invoice image and extract the following information in JSON format:
      - amount: the total amount as a number (use decimal point, no thousands separator)
      - occurredAt: the date in YYYY-MM-DD format
      - category: one of the following categories: [Sewa Kantor, Software Subscription, Payroll, Gaji Staff, Transportasi, Konsumsi, Internet & Listrik, Marketing, Other]
      - description: a short description of what was purchased
      - vendor: the name of the store or provider
      
      Return ONLY the JSON object.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response (sometimes Gemini wraps it in ```json ... ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse JSON from AI response");
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("OCR Extraction failed:", error);
    throw error;
  }
}
