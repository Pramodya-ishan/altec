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
    const pdfjsModulePath = "pdfjs-dist/legacy/build/pdf.mjs";
    pdfjsLib = await import(pdfjsModulePath);
  } catch (err: any) {
    console.error("Failed to load pdfjs-dist:", err.message);
    return {
      text: "",
      pages: [],
      needsOcr: false,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      message: "PDF_PARSER_UNAVAILABLE"
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
      pageQuality: "native_unicode" | "native_english" | "legacy_convertible" | "ocr_required" | "empty_expected" | "extraction_failed";
    }[] = [];

    let overallNeedsLegacy = false;
    let dominantEncoding = "unknown";
    let legacyEncodingsCount = 0;
    let unicodeEncodingsCount = 0;
    let nativeEnglishCount = 0;
    let ocrRequiredCount = 0;

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

      let pageQuality: "native_unicode" | "native_english" | "legacy_convertible" | "ocr_required" | "empty_expected" | "extraction_failed" = "extraction_failed";

      if (pageTextRaw.length < 40) {
        pageQuality = "empty_expected";
      } else if (normResult.textEncoding === "unicode_sinhala") {
        unicodeEncodingsCount++;
        pageQuality = "native_unicode";
      } else if (normResult.textEncoding === "native_english") {
        nativeEnglishCount++;
        pageQuality = "native_english";
      } else if (normResult.textEncoding.startsWith("legacy_")) {
        legacyEncodingsCount++;
        // Check if legacy conversion confidence is good
        if (normResult.conversionConfidence > 0.6) {
          pageQuality = "legacy_convertible";
        } else {
          pageQuality = "ocr_required";
          ocrRequiredCount++;
        }
      } else {
        // Unknown or gibberish
        pageQuality = "ocr_required";
        ocrRequiredCount++;
      }

      pages.push({
        pageNumber: i,
        text: normResult.normalizedText,
        rawText: normResult.rawText,
        textEncoding: normResult.textEncoding,
        conversionApplied: normResult.conversionApplied,
        conversionConfidence: normResult.conversionConfidence,
        needsLegacyConversion: normResult.needsLegacyConversion,
        pageQuality
      });

      fullText += (fullText ? "\n\n" : "") + normResult.normalizedText;
    }

    if (legacyEncodingsCount > unicodeEncodingsCount && legacyEncodingsCount > nativeEnglishCount) {
      dominantEncoding = "legacy_fm_abhaya";
    } else if (unicodeEncodingsCount > 0 || nativeEnglishCount > 0) {
      dominantEncoding = unicodeEncodingsCount >= nativeEnglishCount ? "unicode_sinhala" : "native_english";
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
      needsOcr: ocrRequiredCount > 0, // If any page needs OCR, we might trigger it for those pages
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

