import { normalizeSubject } from "./sourceNormalizer";

export function getSourceScore(src: any, params: { year?: string | null, subject?: string | null, activeSourceId?: string | null, prompt: string }) {
  const { year, subject, activeSourceId, prompt } = params;
  const promptLower = prompt.toLowerCase();
  let score = 0;

  const srcId = src.sourceId || src.id;
  const textToScan = ((src.title || "") + " " + (src.fileName || "")).toLowerCase();
  const srcNormSub = normalizeSubject(src.subject || src.title);
  const srcYearStr = src.year ? String(src.year) : (src.title.match(/\b(20\d{2})\b/)?.[1] || null);

  // +100 active source
  if (activeSourceId && srcId === activeSourceId) score += 100;

  // +50 storagePath exists
  if (src.storagePath) score += 50;

  // SUBJECT MATCHING
  if (subject) {
    if (srcNormSub === subject) {
      score += 100;
    } else if (srcNormSub) {
      score -= 1000; // AGGRESSIVE REJECT FOR WRONG SUBJECT
    }
  }

  // YEAR MATCHING
  if (year) {
    if (srcYearStr === year) {
      score += 100;
    } else if (srcYearStr) {
      score -= 1000; // AGGRESSIVE REJECT FOR WRONG YEAR
    }
  }

  // TYPE MATCHING
  const isPastPaper = src.resourceType === "past_paper" || textToScan.includes("past paper") || textToScan.includes("විභාග");
  if (isPastPaper) score += 80;

  const isMarking = src.resourceType === "marking_scheme" || textToScan.includes("marking") || textToScan.includes("පිළිතුරු");
  if (isMarking) score += 60;

  // PENALIZE TUTES FOR PAPER QUESTIONS
  const isPaperQuestion = promptLower.includes("paper") || promptLower.includes("mcq") || (year && !promptLower.includes("lesson"));
  if (isPaperQuestion) {
    const isTute = textToScan.includes("tute") || textToScan.includes("lesson") || textToScan.includes("revision") || textToScan.includes("පාඩම");
    if (isTute) score -= 500;
  }

  return score;
}

export function resolveStrictSource(sources: any[], params: { year?: string | null, subject?: string | null, activeSourceId?: string | null, prompt: string }) {
  const allScored = sources.map(s => ({
    source: s,
    score: getSourceScore(s, params)
  }));

  const scored = allScored.filter(s => s.score > 50);
  const rejected = allScored.filter(s => s.score <= 50).map(s => ({
    sourceId: s.source.sourceId || s.source.id,
    title: s.source.title,
    score: s.score,
    reason: s.score < -400 ? "Mismatch (Year/Subject/Type)" : "Low relevance score"
  }));

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  // A source is locked if it has high confidence (matched subject AND year, or is active source)
  const sourceLocked = !!(best && best.score >= 180);

  const selectedSourceId = best?.source ? (best.source.sourceId || best.source.id) : null;

  return {
    sourceFound: !!best,
    selectedSource: best?.source || null,
    selectedSourceId,
    confidence: best ? Math.min(best.score / 300, 1) : 0,
    sourceLocked,
    allowedSourceIds: sourceLocked ? [selectedSourceId] : scored.map(s => s.source.sourceId || s.source.id),
    rejectedSources: rejected
  };
}
