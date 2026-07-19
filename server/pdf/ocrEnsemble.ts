import { normalizeSinhalaExtractedText } from "./legacySinhala";

export type OcrCandidate = {
  pageNumber: number;
  text: string;
  provider: "pdf_text" | "legacy_converter" | "cloud_vision" | "gemini_pdf_vision" | string;
  confidence?: number;
};

export type OcrEnsemblePage = OcrCandidate & {
  qualityScore: number;
  candidateCount: number;
  warnings: string[];
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function scoreOcrText(value: unknown, providerConfidence = 0.5) {
  const raw = String(value || "").normalize("NFC").trim();
  if (!raw) return 0;
  const visible = Math.max(1, raw.replace(/\s/gu, "").length);
  const sinhala = (raw.match(/[\u0D80-\u0DFF]/gu) || []).length / visible;
  const latinWords = (raw.match(/\b[A-Za-z]{2,}\b/gu) || []).length;
  const words = Math.max(1, raw.split(/\s+/gu).filter(Boolean).length);
  const replacement = (raw.match(/\uFFFD/gu) || []).length / visible;
  const legacy = (raw.match(/(?:m%|Y%|fuu|j(?:3⁄4|¾)Okh|ñ|ú|õ|ÿ|§|¾)/gu) || []).length / visible;
  const mixedNoise = raw.split(/\s+/gu).filter((token) => /[A-Za-z%¾ñúõÿ§]/u.test(token) && /[\u0D80-\u0DFF]/u.test(token)).length / words;
  const structure = /(?:\([A-Ha-h]\)|\([ivxlcdmIVXLCDM]{1,7}\)|(?:^|\n)\s*\d+[.)])/u.test(raw) ? 0.06 : 0;
  const languageSignal = sinhala > 0.08 || latinWords / words > 0.35 ? 0.2 : 0;
  const lengthSignal = Math.min(0.18, Math.log10(Math.max(10, raw.length)) * 0.08);
  return clamp01(
    0.2 * clamp01(providerConfidence)
    + languageSignal
    + lengthSignal
    + Math.min(0.35, sinhala * 0.65)
    + structure
    - replacement * 3
    - legacy * 2.2
    - mixedNoise * 0.7,
  );
}

function normalizeCandidate(candidate: OcrCandidate): OcrCandidate {
  const normalized = normalizeSinhalaExtractedText(candidate.text);
  const safeText = normalized.normalizedText || (normalized.textEncoding === "native_english" ? normalized.rawText : "");
  return {
    ...candidate,
    text: safeText.normalize("NFC").replace(/[ \t]+/gu, " ").trim(),
    provider: normalized.conversionApplied && safeText ? "legacy_converter" : candidate.provider,
    confidence: Math.min(
      clamp01(Number(candidate.confidence ?? 0.5)),
      normalized.conversionApplied ? clamp01(normalized.conversionConfidence) : 1,
    ),
  };
}

/**
 * Selects the strongest page text independently. This prevents one bad OCR
 * provider/page from poisoning the complete paper index.
 */
export function selectOcrEnsemble(candidates: OcrCandidate[]): {
  pages: OcrEnsemblePage[];
  providers: string[];
  averageQuality: number;
  warnings: string[];
} {
  const byPage = new Map<number, OcrCandidate[]>();
  for (const candidate of candidates) {
    const pageNumber = Math.max(1, Math.floor(Number(candidate.pageNumber) || 1));
    const normalized = normalizeCandidate({ ...candidate, pageNumber });
    if (!normalized.text) continue;
    const list = byPage.get(pageNumber) || [];
    list.push(normalized);
    byPage.set(pageNumber, list);
  }

  const warnings: string[] = [];
  const pages: OcrEnsemblePage[] = Array.from(byPage.entries())
    .sort(([left], [right]) => left - right)
    .map(([pageNumber, pageCandidates]) => {
      const ranked = pageCandidates
        .map((candidate) => ({ candidate, score: scoreOcrText(candidate.text, candidate.confidence) }))
        .sort((left, right) => right.score - left.score || right.candidate.text.length - left.candidate.text.length);
      const winner = ranked[0];
      const pageWarnings: string[] = [];
      if (winner.score < 0.55) pageWarnings.push("LOW_OCR_CONFIDENCE");
      if (ranked.length > 1 && winner.score - ranked[1].score < 0.04 && winner.candidate.text !== ranked[1].candidate.text) {
        pageWarnings.push("OCR_PROVIDER_DISAGREEMENT");
      }
      if (pageWarnings.length > 0) warnings.push(`Page ${pageNumber}: ${pageWarnings.join(", ")}`);
      return {
        ...winner.candidate,
        pageNumber,
        qualityScore: winner.score,
        candidateCount: ranked.length,
        warnings: pageWarnings,
      };
    });

  const providers = Array.from(new Set(pages.map((page) => page.provider)));
  const averageQuality = pages.length > 0
    ? pages.reduce((total, page) => total + page.qualityScore, 0) / pages.length
    : 0;
  return { pages, providers, averageQuality, warnings };
}
