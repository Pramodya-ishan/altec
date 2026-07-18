export type SourceQuestionType = "MCQ" | "ESSAY" | "STRUCTURED";

export interface PendingSourceChoice {
  sourceId: string;
  title: string;
  subject?: string | null;
  year?: string | null;
  resourceType?: string | null;
  storagePath?: string | null;
  questionTypeHint?: SourceQuestionType | null;
}

const GENERIC_SOURCE_TERMS = /^(?:pdf|paper|source|file|answer|answers|give|show|open|select|choose|karamu|krmu|eka|eke|ekak|මේක|එක|කරමු|වෙනත්|ප්‍රශ්නයක්|ප්රශ්නයක්)$/u;

function unicodeTokens(value: string) {
  return value.match(/[\p{L}\p{N}]+/gu) || [];
}

function trigramSet(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  const result = new Set<string>();
  for (let index = 0; index <= compact.length - 3; index += 1) {
    result.add(compact.slice(index, index + 3));
  }
  return result;
}

function diceSimilarity(left: string, right: string) {
  const a = trigramSet(left);
  const b = trigramSet(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const gram of a) if (b.has(gram)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}


export function normalizeSourceSearchText(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bguess(?:ing)?\b(?:\s+paper\b)?/g, "guess")
    .replace(/model\s*paper/g, "model")
    .replace(/structured\s*essay/g, "structured")
    .replace(/\b0+(\d+)\b/g, "$1")
    .replace(/[_–—:()[\]{}.,/\\|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferQuestionTypeFromText(value: unknown): SourceQuestionType | null {
  const text = normalizeSourceSearchText(value);
  if (/\bmcq\b|බහුවරණ/u.test(text)) return "MCQ";
  if (/\bstructured\b|ව්‍යුහගත|වුහගත/u.test(text)) return "STRUCTURED";
  if (/\bessay\b|රචනා/u.test(text)) return "ESSAY";
  return null;
}

export function extractQuestionNumberFromPrompt(value: unknown): string | null {
  const text = normalizeSourceSearchText(value);
  const direct = text.match(/(?:^|\s)(?:q|question|mcq|essay|structured)\s*(\d{1,3})(?:\s|$)/i)
    || text.match(/(?:ප්‍රශ්නය|ප්රශ්නය)\s*(\d{1,3})/u)
    || text.match(/\b(\d{1,3})\s*(?:වන|වෙනි|වැනි)\b/u);
  return direct?.[1] || null;
}

export function parseSourceChoiceIndex(value: unknown, choiceCount: number): number | null {
  const match = String(value || "").trim().match(/^(\d{1,3})[?.!]*$/);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 && index < choiceCount ? index : null;
}

function sourceDescriptorTokens(value: unknown): string[] {
  const normalized = normalizeSourceSearchText(value)
    .replace(/\b(?:q|question|mcq)\s*\d{1,3}\b/g, " ")
    .replace(/(?:ප්‍රශ්නය|ප්රශ්නය)\s*\d{1,3}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return unicodeTokens(normalized).filter((token) => {
    if (/^\d+$/.test(token)) return true;
    return token.length > 1 && !GENERIC_SOURCE_TERMS.test(token);
  });
}

export function scoreNamedSource(source: any, prompt: string): number {
  const title = normalizeSourceSearchText(`${source?.title || ""} ${source?.fileName || ""}`);
  const promptText = normalizeSourceSearchText(prompt);
  const titleTokens = new Set(sourceDescriptorTokens(title));
  const promptTokens = sourceDescriptorTokens(promptText);
  let score = 0;

  const sourceId = String(source?.sourceId || source?.id || "");
  if (!sourceId || !title) return -1000;

  if (promptText.includes(title) || title.includes(promptText)) score += 500;
  let tokenOverlap = 0;
  for (const token of promptTokens) {
    if (titleTokens.has(token)) {
      tokenOverlap += 1;
      score += /^\d+$/.test(token) ? 90 : 55;
    }
  }
  const tokenUnion = new Set([...promptTokens, ...titleTokens]).size;
  if (tokenUnion > 0) score += Math.round((tokenOverlap / tokenUnion) * 180);
  score += Math.round(diceSimilarity(title, promptText) * 140);

  const promptType = inferQuestionTypeFromText(promptText);
  const sourceType = inferQuestionTypeFromText(title);
  if (promptType && sourceType === promptType) score += 180;
  else if (promptType && sourceType && sourceType !== promptType) score -= 500;

  const asksGuess = /\bguess\b/.test(promptText);
  const isGuess = /\bguess\b/.test(title);
  if (asksGuess && isGuess) score += 220;
  else if (asksGuess && !isGuess) score -= 400;

  if (/\bsyllabus\b|විෂය\s*නිර්දේශ/u.test(promptText)) {
    score += /\bsyllabus\b|විෂය\s*නිර්දේශ/u.test(title) ? 250 : -300;
  }

  const requestedPaperNumber = promptText.match(/\b(?:guess|model)\s*(\d{1,3})\b/)?.[1];
  const sourcePaperNumber = title.match(/\b(?:guess|model)\s*(\d{1,3})\b/)?.[1];
  if (requestedPaperNumber) {
    if (sourcePaperNumber === requestedPaperNumber) score += 220;
    else if (sourcePaperNumber) score -= 350;
  }

  const subject = String(source?.subject || "").toUpperCase();
  if (/\bsft\b/.test(promptText)) score += subject === "SFT" ? 120 : -600;
  if (/\bet\b/.test(promptText)) score += subject === "ET" ? 120 : -600;
  if (/\bict\b/.test(promptText)) score += subject === "ICT" ? 120 : -600;

  if (source?.storagePath || source?.downloadUrl || source?.url) score += 20;
  if (source?.textIndexed === true || Number(source?.chunkCount || 0) > 0 || source?.indexStatus === "ready") score += 25;
  return score;
}

export function rankNamedSources(sources: any[], prompt: string, limit = 10) {
  return sources
    .map((source) => ({ source, score: scoreNamedSource(source, prompt) }))
    .filter(({ score }) => score > 80)
    .sort((a, b) => b.score - a.score || String(a.source?.title || "").localeCompare(String(b.source?.title || "")))
    .slice(0, limit);
}

export function selectNamedSource(sources: any[], prompt: string) {
  const ranked = rankNamedSources(sources, prompt, 5);
  const best = ranked[0];
  const second = ranked[1];
  const locked = !!best && best.score >= 300 && (!second || best.score - second.score >= 45 || best.score >= 650);
  return {
    source: locked ? best.source : null,
    sourceId: locked ? String(best.source?.sourceId || best.source?.id || "") : null,
    confidence: best ? Math.min(1, best.score / 750) : 0,
    locked,
    ranked,
  };
}

export function toPendingSourceChoice(source: any): PendingSourceChoice | null {
  const sourceId = String(source?.sourceId || source?.id || "").trim();
  if (!sourceId) return null;
  return {
    sourceId,
    title: String(source?.title || source?.fileName || "PDF source"),
    subject: source?.subject || null,
    year: source?.year ? String(source.year) : null,
    resourceType: source?.resourceType || null,
    storagePath: source?.storagePath || null,
    questionTypeHint: inferQuestionTypeFromText(`${source?.title || ""} ${source?.resourceType || ""}`),
  };
}
