import { extractQuestionNumberFromPrompt, isPaperForecastPrompt } from "./sourceSelection";

export type PaperSubject = "SFT" | "ET" | "ICT";

function normalized(value: unknown) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectExplicitPaperSubject(value: unknown): PaperSubject | null {
  const text = normalized(value);
  if (/\bsft\b|science\s+for\s+technology|තාක්ෂණවේදය\s+සඳහා\s+විද්‍යාව/u.test(text)) return "SFT";
  if (/\bict\b|information\s+(?:and|&)\s+communication\s+technology|තොරතුරු\s+හා\s+සන්නිවේදන/u.test(text)) return "ICT";
  if (/\bet\b|engineering\s+technology|ඉංජිනේරු\s+තාක්ෂණවේදය/u.test(text)) return "ET";
  return null;
}

export function extractRequestedPaperYear(value: unknown): string | null {
  return normalized(value).match(/\b(20\d{2})\b/u)?.[1] || null;
}

export function extractRequestedPaperYears(value: unknown): string[] {
  return [...new Set(normalized(value).match(/\b20\d{2}\b/gu) || [])].sort((a, b) => Number(b) - Number(a));
}

export function isPaperCatalogListPrompt(value: unknown): boolean {
  const text = normalized(value);
  if (isPaperForecastPrompt(text)) return false;
  const years = extractRequestedPaperYears(text);
  const asksRange = years.length >= 2 || /\b(?:from|to|through|between)\b|සිට|දක්වා/u.test(text);
  const paperWords = /\b(?:paper|papers|past\s*paper|pdf)\b|ප්‍රශ්න\s*පත්‍ර|පේපර්/u.test(text);
  const listWords = /\b(?:what|which|list|show|available|thiyenne|thiyenawa|mond|monawada)\b|මොනවද|තියෙන්නේ|තිබෙන/u.test(text);
  return paperWords && (asksRange || listWords);
}

export function isPaperSelectionPrompt(value: unknown): boolean {
  const text = normalized(value);
  if (isPaperForecastPrompt(text) || extractQuestionNumberFromPrompt(text)) return false;
  if (!extractRequestedPaperYear(text)) return false;
  const discussion = /\b(?:krmu|karamu|discuss|start|open|select|choose|paper)\b|කරමු|සාකච්ඡා|පටන්\s*ගමු|තෝර/u.test(text);
  return discussion && !isPaperCatalogListPrompt(text);
}

function sourceYear(source: any) {
  return String(source?.year || `${source?.title || ""} ${source?.fileName || ""}`.match(/\b20\d{2}\b/)?.[0] || "");
}

function sourceSubject(source: any) {
  return String(source?.subject || "").toUpperCase();
}

export function rankPaperCatalogSources(sources: any[], params: { subject?: string | null; year?: string | null }) {
  const subject = String(params.subject || "").toUpperCase();
  const year = String(params.year || "");
  return [...(sources || [])]
    .filter((source) => !subject || sourceSubject(source) === subject)
    .filter((source) => !year || sourceYear(source) === year)
    .filter((source) => ["past_paper", "model_paper"].includes(String(source?.resourceType || source?.sourceType || "").toLowerCase()))
    .map((source) => {
      const title = `${source?.title || ""} ${source?.fileName || ""} ${source?.category || ""}`.toLowerCase();
      let score = 0;
      if (String(source?.resourceType || "").toLowerCase() === "past_paper") score += 180;
      if (/official|past\s*paper|a\/l\s*past/.test(title)) score += 100;
      if (/full\s*paper|paper\s*(?:i|1)\b/.test(title)) score += 45;
      if (/marking|scheme|answer/.test(title)) score -= 500;
      if (/model|guess/.test(title)) score -= 80;
      if (source?.storagePath || source?.downloadUrl || source?.url) score += 20;
      if (Number(source?.chunkCount || 0) > 0 || source?.indexStatus === "ready") score += 15;
      return { source, score };
    })
    .sort((a, b) => b.score - a.score || String(a.source?.title || "").localeCompare(String(b.source?.title || "")));
}

export function paperCatalogYears(sources: any[], subject?: string | null, requestedYears: string[] = []) {
  const available = new Set(
    (sources || [])
      .filter((source) => !subject || sourceSubject(source) === String(subject).toUpperCase())
      .filter((source) => ["past_paper", "model_paper"].includes(String(source?.resourceType || source?.sourceType || "").toLowerCase()))
      .map(sourceYear)
      .filter(Boolean),
  );
  const years = requestedYears.length > 0 ? requestedYears.filter((year) => available.has(year)) : [...available];
  return years.sort((a, b) => Number(b) - Number(a));
}
