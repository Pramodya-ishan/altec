export type DocumentVisualRegionType = "table" | "graph" | "diagram" | "technical_drawing" | "equation_block";

export interface DocumentVisualRegion {
  pageNumber: number;
  type: DocumentVisualRegionType;
  label: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  textStart: number;
  textEnd: number;
  needsVisualReview: boolean;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function finiteBox(block: any): DocumentVisualRegion["boundingBox"] {
  const value = block?.boundingBox || block?.bbox || block?.box;
  if (!value) return null;
  const x = Number(value.x ?? value.left);
  const y = Number(value.y ?? value.top);
  const width = Number(value.width ?? (Number(value.right) - x));
  const height = Number(value.height ?? (Number(value.bottom) - y));
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0
    ? { x, y, width, height }
    : null;
}

function classify(text: string): { type: DocumentVisualRegionType; label: string; confidence: number } | null {
  const normalized = text.normalize("NFKC");
  if (/(?:front\s+view|side\s+view|plan\s+view|first[- ]angle|projection|dimensions?|පෙනුම|ප්‍රක්ෂේපණ|මානය)/iu.test(normalized)) {
    return { type: "technical_drawing", label: "Technical drawing / dimensions", confidence: 0.86 };
  }
  if (/(?:figure|diagram|free[ -]?body|circuit|රූපය|රූපසටහන|පරිපථ|සටහන)/iu.test(normalized)) {
    return { type: "diagram", label: "Diagram", confidence: 0.8 };
  }
  if (/(?:graph|plot|axis|gradient|ප්‍රස්තාර|අක්ෂය|වක්‍රය)/iu.test(normalized)) {
    return { type: "graph", label: "Graph / plot", confidence: 0.82 };
  }
  const tableLikeLines = normalized.split(/\r?\n/u).filter((line) => (line.match(/\s{2,}|\||\t/gu) || []).length >= 2).length;
  if (/(?:table|වගුව)/iu.test(normalized) || tableLikeLines >= 3) {
    return { type: "table", label: "Data table", confidence: tableLikeLines >= 3 ? 0.84 : 0.72 };
  }
  if ((normalized.match(/[=±×÷∑√^]/gu) || []).length >= 4) {
    return { type: "equation_block", label: "Equation block", confidence: 0.68 };
  }
  return null;
}

/**
 * Detects regions that require visual evidence. OCR providers can supply block
 * boxes; text-only PDFs still receive a page/text-offset region so the answer
 * contract can refuse to invent a missing crop or dimension.
 */
export function extractDocumentVisualRegions(pages: any[]): DocumentVisualRegion[] {
  const regions: DocumentVisualRegion[] = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    const pageNumber = Math.max(1, Number(page?.pageNumber || 1));
    const pageText = String(page?.text || page?.rawText || "");
    const blocks = Array.isArray(page?.ocrBlocks) && page.ocrBlocks.length > 0
      ? page.ocrBlocks
      : pageText.split(/\n\s*\n/u).map((text, index) => ({ text, textStart: pageText.indexOf(text, index > 0 ? 1 : 0) }));
    for (const block of blocks) {
      const text = String(block?.text || block?.description || "").trim();
      if (!text) continue;
      const detected = classify(text);
      if (!detected) continue;
      const textStart = Math.max(0, Number(block?.textStart ?? pageText.indexOf(text)) || 0);
      const textEnd = Math.min(pageText.length, Math.max(textStart, Number(block?.textEnd) || textStart + text.length));
      const boundingBox = finiteBox(block);
      const confidence = clamp(Number(block?.confidence ?? detected.confidence));
      regions.push({
        pageNumber,
        type: detected.type,
        label: detected.label,
        confidence,
        boundingBox,
        textStart,
        textEnd,
        needsVisualReview: !boundingBox || confidence < 0.7,
      });
      if (regions.length >= 250) return regions;
    }
  }
  return regions;
}

export function regionsForChunk(regions: DocumentVisualRegion[], pageNumber: number, textStart: number, textEnd: number) {
  return regions.filter((region) => region.pageNumber === pageNumber && region.textEnd >= textStart && region.textStart <= textEnd);
}
