import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeSinhalaExtractedText } from "./legacySinhala";

if (typeof globalThis !== "undefined") {
  if (!(globalThis as any).DOMMatrix) (globalThis as any).DOMMatrix = class DOMMatrix {};
  if (!(globalThis as any).Path2D) (globalThis as any).Path2D = class Path2D {};
  if (!(globalThis as any).ImageData) {
    (globalThis as any).ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height || Math.floor(dataOrWidth.length / Math.max(1, widthOrHeight * 4));
        }
      }
    };
  }
}

export type PdfExtractionStatus =
  | "PDF_PARSER_UNAVAILABLE"
  | "PDF_PARSER_RUNTIME_ERROR"
  | "PDF_TEXT_LAYER_EMPTY"
  | "PDF_SCANNED_OCR_REQUIRED"
  | "PDF_TEXT_READY";

type ExtractedPage = {
  pageNumber: number;
  text: string;
  rawText: string;
  textEncoding: string;
  conversionApplied: boolean;
  conversionConfidence: number;
  needsLegacyConversion: boolean;
  pageQuality: "native_unicode" | "native_english" | "legacy_convertible" | "ocr_required" | "empty_expected" | "extraction_failed";
};

export async function extractPdfText(pdfBuffer: Buffer): Promise<{
  text: string;
  pages: ExtractedPage[];
  needsOcr: boolean;
  needsLegacyConversion: boolean;
  textEncoding: string;
  status: PdfExtractionStatus;
  errorCode?: PdfExtractionStatus;
  message?: string;
}> {
  let pdfjsLib: any;
  try {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (pdfjsLib.GlobalWorkerOptions) {
      const bundledWorker = new URL("./pdf.worker.mjs", import.meta.url);
      const sourceWorker = resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
      pdfjsLib.GlobalWorkerOptions.workerSrc = existsSync(fileURLToPath(bundledWorker))
        ? bundledWorker.toString()
        : existsSync(sourceWorker)
          ? pathToFileURL(sourceWorker).toString()
          : bundledWorker.toString();
    }
  } catch (error: any) {
    console.error("Failed to load pdfjs-dist:", error?.message || error);
    return {
      text: "",
      pages: [],
      needsOcr: false,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      status: "PDF_PARSER_UNAVAILABLE",
      errorCode: "PDF_PARSER_UNAVAILABLE",
      message: "The PDF parser is unavailable.",
    };
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      disableFontFace: true,
      verbosity: 0,
      useSystemFonts: false,
    });
    const pdf = await loadingTask.promise;
    let fullText = "";
    const pages: ExtractedPage[] = [];
    let overallNeedsLegacy = false;
    let dominantEncoding = "unknown";
    let legacyEncodingsCount = 0;
    let unicodeEncodingsCount = 0;
    let nativeEnglishCount = 0;
    let ocrRequiredCount = 0;
    let meaningfulPageCount = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageTextRaw = textContent.items.map((item: any) => item.str).join(" ").replace(/\s+/g, " ").trim();
      const normalized = normalizeSinhalaExtractedText(pageTextRaw);
      if (normalized.needsLegacyConversion) overallNeedsLegacy = true;

      let pageQuality: ExtractedPage["pageQuality"] = "extraction_failed";
      if (pageTextRaw.length < 40) {
        pageQuality = "empty_expected";
      } else if (normalized.textEncoding === "unicode_sinhala") {
        unicodeEncodingsCount += 1;
        meaningfulPageCount += 1;
        pageQuality = "native_unicode";
      } else if (normalized.textEncoding === "native_english") {
        nativeEnglishCount += 1;
        meaningfulPageCount += 1;
        pageQuality = "native_english";
      } else if (normalized.textEncoding.startsWith("legacy_")) {
        legacyEncodingsCount += 1;
        if (normalized.conversionConfidence > 0.6) {
          meaningfulPageCount += 1;
          pageQuality = "legacy_convertible";
        } else {
          ocrRequiredCount += 1;
          pageQuality = "ocr_required";
        }
      } else {
        ocrRequiredCount += 1;
        pageQuality = "ocr_required";
      }

      pages.push({
        pageNumber,
        text: normalized.normalizedText,
        rawText: normalized.rawText,
        textEncoding: normalized.textEncoding,
        conversionApplied: normalized.conversionApplied,
        conversionConfidence: normalized.conversionConfidence,
        needsLegacyConversion: normalized.needsLegacyConversion,
        pageQuality,
      });
      if (normalized.normalizedText.trim()) fullText += `${fullText ? "\n\n" : ""}${normalized.normalizedText.trim()}`;
    }

    if (legacyEncodingsCount > unicodeEncodingsCount && legacyEncodingsCount > nativeEnglishCount) {
      dominantEncoding = "legacy_fm_abhaya";
    } else if (unicodeEncodingsCount > 0 || nativeEnglishCount > 0) {
      dominantEncoding = unicodeEncodingsCount >= nativeEnglishCount ? "unicode_sinhala" : "native_english";
    }

    const trimmed = fullText.trim();
    if (trimmed.length < 40 || meaningfulPageCount === 0) {
      return {
        text: trimmed,
        pages,
        needsOcr: true,
        needsLegacyConversion: false,
        textEncoding: dominantEncoding,
        status: trimmed.length === 0 ? "PDF_TEXT_LAYER_EMPTY" : "PDF_SCANNED_OCR_REQUIRED",
        message: "The document has no searchable text layer.",
      };
    }

    const needsOcr = ocrRequiredCount > 0;
    return {
      text: trimmed,
      pages,
      needsOcr,
      needsLegacyConversion: overallNeedsLegacy,
      textEncoding: dominantEncoding,
      status: needsOcr ? "PDF_SCANNED_OCR_REQUIRED" : "PDF_TEXT_READY",
    };
  } catch (error: any) {
    console.error("PDF parser runtime error:", error?.message || error);
    return {
      text: "",
      pages: [],
      needsOcr: false,
      needsLegacyConversion: false,
      textEncoding: "unknown",
      status: "PDF_PARSER_RUNTIME_ERROR",
      errorCode: "PDF_PARSER_RUNTIME_ERROR",
      message: "The PDF could not be parsed due to an internal server error.",
    };
  }
}
