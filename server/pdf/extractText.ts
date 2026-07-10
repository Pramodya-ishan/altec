import { normalizeSinhalaExtractedText } from "./legacySinhala";

// Suppress legacy pdfjs-dist warnings about missing canvas/DOMMatrix/Path2D polyfills in Node environment
if (typeof globalThis !== "undefined") {
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {};
  }
  if (!(globalThis as any).Path2D) {
    (globalThis as any).Path2D = class Path2D {};
  }
}

export async function extractPdfText(pdfBuffer: Buffer): Promise<{
  text: string;
  pages: {
    pageNumber: number;
    text: string;
    rawText: string;
    textEncoding: string;
    conversionApplied: boolean;
    conversionConfidence: number;
    needsLegacyConversion: boolean;
  }[];
  needsOcr: boolean;
  needsLegacyConversion: boolean;
  textEncoding: string;
  message?: string;
}> {
  let pdfjsLib: any = null;
  try {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
  } catch (err: any) {
    console.error("Failed to load pdfjs-dist:", err.message);
    return {
      text: "",
      pages: [],
      needsOcr: true,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      message: "PDF library load failure. OCR අවශ්‍යයි."
    };
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      disableFontFace: true,
      verbosity: 0
    });
    
    const pdf = await loadingTask.promise;
    let fullText = "";
    const pages: {
      pageNumber: number;
      text: string;
      rawText: string;
      textEncoding: string;
      conversionApplied: boolean;
      conversionConfidence: number;
      needsLegacyConversion: boolean;
    }[] = [];

    let overallNeedsLegacy = false;
    let dominantEncoding = "unknown";
    let legacyEncodingsCount = 0;
    let unicodeEncodingsCount = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageTextRaw = textContent.items
        .map((item: any) => item.str)
        .join(" ")
        .trim();
      
      const normResult = normalizeSinhalaExtractedText(pageTextRaw);
      
      if (normResult.needsLegacyConversion) {
        overallNeedsLegacy = true;
      }
      if (normResult.textEncoding.startsWith("legacy_")) {
        legacyEncodingsCount++;
      } else if (normResult.textEncoding === "unicode_sinhala") {
        unicodeEncodingsCount++;
      }

      pages.push({
        pageNumber: i,
        text: normResult.normalizedText,
        rawText: normResult.rawText,
        textEncoding: normResult.textEncoding,
        conversionApplied: normResult.conversionApplied,
        conversionConfidence: normResult.conversionConfidence,
        needsLegacyConversion: normResult.needsLegacyConversion
      });
      fullText += (fullText ? "\n\n" : "") + normResult.normalizedText;
    }

    if (legacyEncodingsCount > unicodeEncodingsCount) {
      dominantEncoding = "legacy_fm_abhaya";
    } else if (unicodeEncodingsCount > 0) {
      dominantEncoding = "unicode_sinhala";
    }

    const trimmed = fullText.trim();
    if (trimmed.length === 0) {
      return {
        text: "",
        pages: [],
        needsOcr: true,
        needsLegacyConversion: false,
        textEncoding: "unknown",
        message: "PDF එකෙන් text extract කරන්න බැහැ. OCR අවශ්‍යයි."
      };
    }

    return {
      text: trimmed,
      pages,
      needsOcr: false,
      needsLegacyConversion: overallNeedsLegacy,
      textEncoding: dominantEncoding
    };
  } catch (e: any) {
    console.warn("PDF extraction error:", e.message);
    return {
      text: "",
      pages: [],
      needsOcr: true,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      message: "PDF එකෙන් text extract කරන්න බැහැ. OCR අවශ්‍යයි."
    };
  }
}

