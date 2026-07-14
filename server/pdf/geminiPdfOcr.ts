import { Type } from "@google/genai";
import { getAIClient } from "../ai/client";

export type GeminiOcrPage = {
  pageNumber: number;
  text: string;
};

export function isGeminiPdfOcrConfigured(): boolean {
  const mode = String(process.env.GEMINI_USE_VERTEX || "").trim().toLowerCase();
  if (mode === "false") return Boolean(process.env.GEMINI_API_KEY);
  if (mode === "true") return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID,
  );
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

export async function extractPdfPagesWithGemini(buffer: Buffer): Promise<GeminiOcrPage[]> {
  if (!buffer?.length) throw new Error("Cannot OCR an empty PDF buffer.");

  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_OCR_MODEL || process.env.GEMINI_PDF_QA_MODEL || "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: buffer.toString("base64"),
        },
      },
      {
        text: [
          "OCR this Sri Lankan A/L PDF page by page.",
          "Extract only text visible in the document; never invent missing questions or answers.",
          "Preserve Sinhala and English Unicode, question/option numbers, formulas, and concise diagram labels.",
          "Return JSON in the requested schema.",
        ].join(" "),
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                text: { type: Type.STRING },
              },
              required: ["pageNumber", "text"],
            },
          },
        },
        required: ["pages"],
      },
    },
  });

  const parsed = JSON.parse(response.text || "{}");
  const pages = (Array.isArray(parsed?.pages) ? parsed.pages : [])
    .map((page: any, index: number) => ({
      pageNumber: Number(page?.pageNumber) || index + 1,
      text: String(page?.text || "").trim(),
    }))
    .filter((page: GeminiOcrPage) => page.text.length > 0);

  if (pages.length === 0) throw new Error("Gemini OCR returned no readable pages.");
  return pages;
}
