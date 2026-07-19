import { getAIClient } from "./client";
import { callGeminiWithFallback } from "./modelRouter";
import { sanitizeAssistantText } from "./responseHygiene";
import { assessAnswerCompleteness, extractRequestedSubparts } from "./answerCompleteness";
import { verifyExamAnswer } from "./deterministicExamVerifier";

export type AnswerQualityReport = {
  passed: boolean;
  confidence: number;
  coveragePercent: number;
  requestedSubparts: string[];
  missingRequirements: string[];
  factualRisks: string[];
  numericalChecks: string[];
  citationRisks: string[];
  strengths: string[];
  reviewer: "deterministic" | "pro_model" | "pro_model_and_deterministic";
  repaired: boolean;
  reviewError?: string;
};

type ModelReview = Omit<AnswerQualityReport, "requestedSubparts" | "reviewer" | "repaired"> & {
  repairInstruction?: string;
};

function boundedList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((item) => String(item || "").replace(/\s+/gu, " ").trim())
    .filter(Boolean)))
    .slice(0, limit);
}

function parseJson(value: unknown): any {
  const clean = String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("The answer reviewer returned invalid JSON.");
  }
}

function clampPercent(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function clampConfidence(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

export function isSubstantiveAnswerMode(mode: unknown) {
  const value = String(mode || "").toLowerCase();
  return ![
    "simple_greeting",
    "greeting",
    "source_choice",
    "mistake_notebook",
    "image_generation",
    "web_import_confirmation",
  ].includes(value);
}

export function buildAnswerContractInstruction(params: {
  prompt: unknown;
  mode: unknown;
  evidenceRequired?: boolean;
}) {
  const requested = extractRequestedSubparts(params.prompt);
  const checklist = requested.length > 0 ? requested.join(", ") : "derive every explicit request from the question";
  return `\n\nANSWER CONTRACT (must be satisfied before finishing):
- Requested parts/checklist: ${checklist}.
- Answer every explicit part; preserve the original A/B/C, (i)/(ii), or question-number structure.
- For calculations: show the formula, substitution, units, direction/sign where relevant, and a checked final value.
- For exam answers: match depth to marks when marks are visible and state marking points without inventing an official scheme.
- For PDF/paper facts: use only supplied or retrieved evidence, identify unreadable/absent visual information, and never invent a diagram or hidden dimension.
- Label the result truthfully as Official, AI-solved, Predicted/model, or General; never promote one status to another.
- When the user asks for an image or visual explanation, never imitate one with ASCII art, monospace arrows, or a code block. Use the image-generation/visual-block result and keep supporting prose concise.
- Use natural Unicode Sinhala. Never repeat legacy-font mojibake.
- Finish all sentences, lists, tables, Markdown, and math delimiters.
- Silently self-check factual consistency, subpart coverage, numerical work, and source support before the final sentence.
${params.evidenceRequired ? "- Evidence is mandatory: unsupported claims must be omitted or explicitly marked as not verifiable from the selected source." : ""}`;
}

export function deterministicQualityReport(params: {
  prompt: unknown;
  answer: unknown;
  mode?: unknown;
  evidenceRequired?: boolean;
  sourceCount?: number;
  sources?: any[];
}): AnswerQualityReport {
  const prompt = String(params.prompt || "");
  const answer = String(params.answer || "").trim();
  const requestedSubparts = extractRequestedSubparts(prompt);
  const completeness = assessAnswerCompleteness({ prompt, answer, finishReason: "STOP", mode: params.mode });
  const missingRequirements = [...completeness.missingSubparts];
  const numericalChecks: string[] = [];
  const factualRisks: string[] = [];
  const citationRisks: string[] = [];
  const examVerification = verifyExamAnswer({
    prompt,
    answer,
    evidenceRequired: params.evidenceRequired,
    sources: params.sources,
  });
  missingRequirements.push(...examVerification.missingRequirements);
  numericalChecks.push(...examVerification.numericalIssues);
  factualRisks.push(...examVerification.factualRisks);

  const promptHasCalculation = /(?:calculate|compute|numerical(?:ly)?|ගණනය|අගය\s*සොයන්න|කොපමණද)/iu.test(prompt);
  const answerHasNumber = /(?:^|\s)[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:N|kg|m\/s|m\s*s|Pa|J|W|V|A|Ω|%|°C|m|s)?\b/iu.test(answer);
  const answerHasUnit = /\b(?:N|kg|m\s*s(?:\^?-?2|⁻²)|m\/s(?:\^?2|²)?|Pa|J|W|V|A|Ω|mol|°C)\b/u.test(answer);
  if (promptHasCalculation && !answerHasNumber) numericalChecks.push("No checked numerical result was detected.");
  const requiresPhysicalUnit = examVerification.expectedUnits.length === 0
    || examVerification.expectedUnits.some((unit) => unit !== "dimensionless");
  if (promptHasCalculation && requiresPhysicalUnit && answerHasNumber && !answerHasUnit) numericalChecks.push("A numerical result appears without a clear SI unit.");

  if (params.evidenceRequired && Number(params.sourceCount || 0) === 0) {
    citationRisks.push("The answer requires document evidence but no source was attached to the final response.");
  }
  if (/\b(?:probably|maybe|likely)\b|බොහෝ\s*විට|විය\s*හැකිය/iu.test(answer) && /(?:official|නිල|paper|පත්‍ර)/iu.test(prompt)) {
    factualRisks.push("The official-paper answer contains unresolved uncertainty language.");
  }
  if (completeness.reasons.includes("UNCLOSED_MARKDOWN_OR_MATH")) missingRequirements.push("Close all Markdown or math delimiters.");
  if (completeness.reasons.includes("TRUNCATED_ENDING")) missingRequirements.push("Complete the final sentence or list item.");

  const issueCount = missingRequirements.length + numericalChecks.length + factualRisks.length + citationRisks.length;
  const expectedCount = Math.max(1, requestedSubparts.length || 1);
  const covered = Math.max(0, expectedCount - completeness.missingSubparts.length);
  const coveragePercent = Math.max(0, Math.min(100, Math.round((covered / expectedCount) * 100) - Math.min(40, issueCount * 10)));
  return {
    passed: issueCount === 0 && completeness.complete,
    confidence: issueCount === 0 ? 0.82 : Math.max(0.15, 0.72 - issueCount * 0.12),
    coveragePercent,
    requestedSubparts,
    missingRequirements: boundedList(missingRequirements),
    factualRisks: boundedList(factualRisks),
    numericalChecks: boundedList(numericalChecks),
    citationRisks: boundedList(citationRisks),
    strengths: issueCount === 0
      ? ["Deterministic completeness and formatting checks passed.", ...examVerification.strengths]
      : examVerification.strengths,
    reviewer: "deterministic",
    repaired: false,
  };
}

function normalizeModelReview(value: any, fallback: AnswerQualityReport): ModelReview {
  const missingRequirements = boundedList(value?.missingRequirements);
  const factualRisks = boundedList(value?.factualRisks);
  const numericalChecks = boundedList(value?.numericalChecks);
  const citationRisks = boundedList(value?.citationRisks);
  const issueCount = missingRequirements.length + factualRisks.length + numericalChecks.length + citationRisks.length;
  const passed = value?.passed === true && issueCount === 0;
  return {
    passed,
    confidence: clampConfidence(value?.confidence, fallback.confidence),
    coveragePercent: clampPercent(value?.coveragePercent, fallback.coveragePercent),
    missingRequirements,
    factualRisks,
    numericalChecks,
    citationRisks,
    strengths: boundedList(value?.strengths, 8),
    repairInstruction: String(value?.repairInstruction || "").trim().slice(0, 6000),
  };
}

export async function reviewAnswerQuality(params: {
  prompt: unknown;
  answer: unknown;
  mode?: unknown;
  evidenceRequired?: boolean;
  sources?: any[];
}) {
  const prompt = String(params.prompt || "").slice(0, 30_000);
  const answer = String(params.answer || "").slice(0, 80_000);
  const sources = (Array.isArray(params.sources) ? params.sources : []).slice(0, 20);
  const deterministic = deterministicQualityReport({
    prompt,
    answer,
    mode: params.mode,
    evidenceRequired: params.evidenceRequired,
    sourceCount: sources.length,
    sources,
  });

  if (!isSubstantiveAnswerMode(params.mode) || process.env.AI_QUALITY_REVIEW_ENABLED === "false") {
    return { report: deterministic, repairInstruction: "" };
  }

  const sourceManifest = sources.map((source: any, index: number) => ({
    index: index + 1,
    id: source?.id || source?.sourceId || null,
    title: source?.title || source?.fileName || "Source",
    pageNumber: source?.pageNumber || source?.page || null,
    verified: source?.verified !== false,
    excerpt: String(source?.text || source?.snippet || source?.content || "").slice(0, 1200),
  }));

  const systemInstruction = `You are an independent exam-answer quality reviewer, not the answer writer.
Evaluate only whether the proposed answer satisfies the user's exact request and the supplied evidence contract.
Check every explicit subpart, marking-point depth, factual consistency, calculations, units, signs/directions, source support, and whether a required diagram/table was actually available.
Do not expose chain-of-thought. Return concise findings as JSON only.
Never penalize an answer for refusing to invent a missing diagram or unreadable PDF region.`;
  const reviewPrompt = `User request:\n${prompt}\n\nMode: ${String(params.mode || "auto")}
Evidence required: ${params.evidenceRequired === true}
Available source manifest:\n${JSON.stringify(sourceManifest)}
\nProposed answer:\n${answer}
\nDeterministic pre-check:\n${JSON.stringify(deterministic)}
\nReturn exactly this JSON shape:
{"passed":boolean,"confidence":number,"coveragePercent":number,"missingRequirements":string[],"factualRisks":string[],"numericalChecks":string[],"citationRisks":string[],"strengths":string[],"repairInstruction":"precise instructions for a full corrected replacement answer, or empty when passed"}`;

  try {
    const { result } = await callGeminiWithFallback("final_answer", {
      model: "ignored",
      contents: reviewPrompt,
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens: 4_096,
      },
    }, getAIClient());
    const model = normalizeModelReview(parseJson(result.text || ""), deterministic);
    const merged: AnswerQualityReport = {
      passed: deterministic.passed && model.passed,
      confidence: Math.min(deterministic.confidence, model.confidence),
      coveragePercent: Math.min(deterministic.coveragePercent, model.coveragePercent),
      requestedSubparts: deterministic.requestedSubparts,
      missingRequirements: boundedList([...deterministic.missingRequirements, ...model.missingRequirements]),
      factualRisks: boundedList([...deterministic.factualRisks, ...model.factualRisks]),
      numericalChecks: boundedList([...deterministic.numericalChecks, ...model.numericalChecks]),
      citationRisks: boundedList([...deterministic.citationRisks, ...model.citationRisks]),
      strengths: model.strengths,
      reviewer: "pro_model_and_deterministic",
      repaired: false,
    };
    return { report: merged, repairInstruction: model.repairInstruction || "" };
  } catch (error: any) {
    return {
      report: {
        ...deterministic,
        reviewError: String(error?.message || error).slice(0, 500),
      },
      repairInstruction: "",
    };
  }
}

export function buildQualityRepairInstruction(params: {
  originalPrompt: unknown;
  currentAnswer: unknown;
  report: AnswerQualityReport;
  modelInstruction?: unknown;
}) {
  return `Replace the draft with one complete, corrected final answer.

Quality findings:
${JSON.stringify({
    missingRequirements: params.report.missingRequirements,
    factualRisks: params.report.factualRisks,
    numericalChecks: params.report.numericalChecks,
    citationRisks: params.report.citationRisks,
    reviewerInstruction: String(params.modelInstruction || "").slice(0, 6000),
  })}

Rules:
- Return the entire corrected answer, not a patch, continuation, critique, apology, or review report.
- Preserve every already-correct part while fixing every listed issue.
- Recalculate numerical work independently and include units/sign/direction.
- Use only the supplied evidence. Do not invent missing figures, dimensions, citations, official answers, or marking schemes.
- Use natural Unicode Sinhala with English technical terms only where useful.
- End only after every explicit part is complete and all Markdown/math is closed.

Original request:
${String(params.originalPrompt || "").slice(0, 30_000)}

Draft to replace:
${String(params.currentAnswer || "").slice(0, 80_000)}`;
}

export async function createQualityRepairedAnswer(params: {
  originalPrompt: unknown;
  currentAnswer: unknown;
  report: AnswerQualityReport;
  modelInstruction?: unknown;
  systemInstruction: string;
  contentsParts?: any[];
  maxOutputTokens: number;
}) {
  const repair = buildQualityRepairInstruction(params);
  const contents = params.contentsParts?.length
    ? [
      { role: "user", parts: params.contentsParts },
      { role: "model", parts: [{ text: String(params.currentAnswer || "") }] },
      { role: "user", parts: [{ text: repair }] },
    ]
    : repair;
  const { result, modelUsed } = await callGeminiWithFallback("final_answer", {
    model: "ignored",
    contents,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0.05,
      maxOutputTokens: Math.max(12_288, params.maxOutputTokens),
    },
  }, getAIClient());
  return {
    answer: sanitizeAssistantText(result.text || ""),
    modelUsed,
  };
}
