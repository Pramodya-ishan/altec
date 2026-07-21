import { extractRequestedSubparts } from "./answerCompleteness";

export type TurnRiskLevel = "low" | "medium" | "high" | "critical";

export interface TurnRiskAssessment {
  score: number;
  level: TurnRiskLevel;
  reasons: string[];
  useProWriter: boolean;
  useModelPlanner: boolean;
  useModelReviewer: boolean;
  maxContinuationPasses: number;
  contextCharBudget: number;
  historyCharBudget: number;
}

function has(pattern: RegExp, value: string) {
  return pattern.test(value);
}

export function assessTurnRisk(params: {
  prompt: unknown;
  mode?: unknown;
  evidenceRequired?: boolean;
  sourceCount?: number;
  hasImage?: boolean;
  attachmentCount?: number;
  needsOcr?: boolean;
  hasExactQuestionText?: boolean;
  contradictionCount?: number;
}): TurnRiskAssessment {
  const prompt = String(params.prompt || "").normalize("NFKC");
  const mode = String(params.mode || "auto").toLowerCase();
  const sourceCount = Math.max(0, Number(params.sourceCount || 0));
  const attachmentCount = Math.max(0, Number(params.attachmentCount || 0));
  const requestedSubparts = extractRequestedSubparts(prompt);
  let score = 0;
  const reasons: string[] = [];

  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (params.evidenceRequired) add(18, "evidence_required");
  if (/paper_question_qa|uploaded_pdf|marking_scheme|past_paper|rag_qa/u.test(mode)) add(22, "official_or_document_qa");
  if (/past_paper_analysis|forecast|prediction|guess/u.test(mode)) add(14, "forecast_analysis");
  if (/zscore|admission|rank/u.test(mode)) add(12, "high_stakes_prediction");
  if (params.needsOcr) add(14, "ocr_uncertainty");
  if (params.hasExactQuestionText === false && params.evidenceRequired) add(18, "exact_question_missing");
  if (params.hasImage || attachmentCount > 0) add(14, "multimodal_input");
  if (sourceCount >= 2) add(Math.min(12, sourceCount * 2), "multi_source_synthesis");
  if (Number(params.contradictionCount || 0) > 0) add(18, "evidence_contradiction");

  if (has(/(?:calculate|compute|derive|prove|ගණනය|සොයන්න|සාධනය|අගය|බලය|ධාරාව|වෝල්ටීයතාව|ප්‍රතිරෝධය|ඝර්ෂණ|වේගය|ත්වරණය|z\s*-?score)/iu, prompt)) {
    add(18, "calculation_or_derivation");
  }
  if (has(/(?:diagram|graph|table|figure|circuit|waveform|රූප|සටහන|ප්‍රස්තාර|වගුව|පරිපථ|මානය)/iu, prompt)) {
    add(10, "visual_dependency");
  }
  if (requestedSubparts.length >= 2) add(Math.min(18, requestedSubparts.length * 3), "multiple_explicit_subparts");
  if (prompt.length > 1_500) add(8, "long_prompt");
  if (prompt.length > 6_000) add(8, "very_long_prompt");
  if (has(/(?:official|නිල|marking\s*scheme|ලකුණු\s*(?:යෝජනා|පටිපාටි)|exact|නිවැරදිම)/iu, prompt)) add(10, "official_accuracy_requested");

  score = Math.max(0, Math.min(100, score));
  const level: TurnRiskLevel = score >= 78 ? "critical" : score >= 52 ? "high" : score >= 26 ? "medium" : "low";

  return {
    score,
    level,
    reasons: Array.from(new Set(reasons)),
    useProWriter: level === "high" || level === "critical",
    useModelPlanner: level === "critical" || (level === "high" && requestedSubparts.length >= 3),
    useModelReviewer: level === "high" || level === "critical" || Boolean(params.evidenceRequired),
    maxContinuationPasses: level === "critical" ? 10 : level === "high" ? 7 : level === "medium" ? 4 : 2,
    contextCharBudget: level === "critical" ? 150_000 : level === "high" ? 110_000 : level === "medium" ? 72_000 : 42_000,
    historyCharBudget: level === "critical" ? 24_000 : level === "high" ? 18_000 : level === "medium" ? 12_000 : 8_000,
  };
}
