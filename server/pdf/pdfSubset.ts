import { PDFDocument } from "pdf-lib";

const MAX_TARGET_PAGES = 3;

/**
 * Builds a small PDF containing only the requested original pages.  Direct QA
 * uses this for legacy Sinhala-font documents so Gemini never has to scan the
 * complete paper inside a serverless request.
 */
export async function createPdfPageSubset(
  input: Buffer,
  requestedPages: number[],
): Promise<{ buffer: Buffer; originalPageNumbers: number[] }> {
  const source = await PDFDocument.load(input, {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  const pageCount = source.getPageCount();
  const originalPageNumbers = [...new Set(requestedPages)]
    .map((page) => Math.trunc(Number(page)))
    .filter((page) => Number.isFinite(page) && page >= 1 && page <= pageCount)
    .slice(0, MAX_TARGET_PAGES);

  if (originalPageNumbers.length === 0) {
    throw Object.assign(new Error("No valid target page was found in the PDF index."), {
      code: "DIRECT_QA_TARGET_PAGE_MISSING",
    });
  }

  const output = await PDFDocument.create();
  const copied = await output.copyPages(
    source,
    originalPageNumbers.map((page) => page - 1),
  );
  copied.forEach((page) => output.addPage(page));
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
  return { buffer: Buffer.from(bytes), originalPageNumbers };
}
