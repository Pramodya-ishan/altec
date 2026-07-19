export type AnswerCompletenessAssessment = {
  complete: boolean;
  shouldContinue: boolean;
  reasons: string[];
  missingSubparts: string[];
  finishReason: string | null;
};

const CONTINUABLE_FINISH_REASONS = new Set([
  "MAX_TOKENS",
  "MODEL_LENGTH",
  "STREAM_INTERRUPTED",
  "STREAM_CLOSED_BEFORE_DONE",
  "FINISH_REASON_UNSPECIFIED",
  "OTHER",
  "UNEXPECTED_TOOL_CALL",
]);

const NON_CONTINUABLE_FINISH_REASONS = new Set([
  "SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
  "MALFORMED_FUNCTION_CALL",
  "LANGUAGE",
  "IMAGE_PROHIBITED_CONTENT",
  "IMAGE_RECITATION",
]);

function normalizeLabel(value: string) {
  return value.replace(/[()\s]/g, "").replace(/\.$/, "").toUpperCase();
}

/** Extract explicit exam/task labels without treating measurements or equations as labels. */
export function extractRequestedSubparts(value: unknown): string[] {
  const text = String(value || "").normalize("NFKC");
  const labels: string[] = [];
  let activeSection = "";

  const parenthesized = /\(([A-Ha-h]|[ivxlcdmIVXLCDM]{1,7})\)/g;
  for (const match of text.matchAll(parenthesized)) {
    const raw = match[1];
    if (/^[A-H]$/i.test(raw)) {
      activeSection = raw.toUpperCase();
      labels.push(activeSection);
    } else {
      const roman = raw.toLowerCase();
      labels.push(activeSection ? `${activeSection}.${roman}` : roman);
    }
  }

  const lineLabels = /(?:^|\n)\s*(?:ප්‍රශ්නය\s*|question\s*|q\s*)?(\d{1,2})\s*[.)\-:]/giu;
  for (const match of text.matchAll(lineLabels)) labels.push(`Q${match[1]}`);

  return Array.from(new Set(labels.map(normalizeLabel))).slice(0, 40);
}

function extractAnsweredSubparts(value: unknown): Set<string> {
  return new Set(extractRequestedSubparts(value));
}

function hasOpenMarkdown(value: string) {
  const fences = value.match(/```/g)?.length || 0;
  const displayMath = value.match(/\$\$/g)?.length || 0;
  const openLatex = value.match(/\\\[/g)?.length || 0;
  const closeLatex = value.match(/\\\]/g)?.length || 0;
  const withoutClosedBlocks = value.replace(/\$\$[\s\S]*?\$\$/g, "");
  const inlineMath = withoutClosedBlocks.match(/(?<!\\)(?<!\$)\$(?!\$)/g)?.length || 0;
  return fences % 2 !== 0 || displayMath % 2 !== 0 || inlineMath % 2 !== 0 || openLatex !== closeLatex;
}

function hasStrongTruncatedEnding(value: string) {
  const tail = value.trim().slice(-120);
  if (!tail) return true;
  if (/[,;:\-–—/]$/u.test(tail)) return true;
  if (/(?:\band|\bor|\bbecause|\btherefore|\bwhich|\bwith|\bto|සහ|හෝ|නිසා|මඟින්|මගින්|නම්|යනු|වන්නේ|අතර)\s*$/iu.test(tail)) return true;
  return /(?:^|\n)\s*(?:[-*+]\s*|\d+[.)]\s*)[^\n]{0,12}$/u.test(tail);
}

export function getModelFinishReason(response: any): string | null {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const reason = candidates.find((candidate: any) => candidate?.finishReason)?.finishReason
    || response?.finishReason
    || null;
  return reason ? String(reason).toUpperCase() : null;
}

export function assessAnswerCompleteness(params: {
  prompt: unknown;
  answer: unknown;
  finishReason?: unknown;
  mode?: unknown;
}): AnswerCompletenessAssessment {
  const prompt = String(params.prompt || "");
  const answer = String(params.answer || "").trim();
  const finishReason = params.finishReason ? String(params.finishReason).toUpperCase() : null;
  const reasons: string[] = [];

  if (!answer) reasons.push("EMPTY_ANSWER");
  if (finishReason && CONTINUABLE_FINISH_REASONS.has(finishReason)) reasons.push(finishReason);
  if (finishReason && NON_CONTINUABLE_FINISH_REASONS.has(finishReason)) reasons.push(`MODEL_STOP_${finishReason}`);
  if (answer && hasOpenMarkdown(answer)) reasons.push("UNCLOSED_MARKDOWN_OR_MATH");
  if (answer && hasStrongTruncatedEnding(answer)) reasons.push("TRUNCATED_ENDING");

  const expected = extractRequestedSubparts(prompt);
  const answered = extractAnsweredSubparts(answer);
  const enforceSubparts = expected.length >= 2 && expected.length <= 40;
  const missingSubparts = enforceSubparts
    ? expected.filter((label) => !answered.has(label))
    : [];
  if (missingSubparts.length > 0) reasons.push("MISSING_EXPLICIT_SUBPARTS");

  const complete = reasons.length === 0;
  const blocked = Boolean(finishReason && NON_CONTINUABLE_FINISH_REASONS.has(finishReason));
  return {
    complete,
    shouldContinue: !complete && !blocked,
    reasons,
    missingSubparts,
    finishReason,
  };
}

export function buildContinuationInstruction(params: {
  originalPrompt: unknown;
  currentAnswer: unknown;
  assessment: AnswerCompletenessAssessment;
}) {
  const answer = String(params.currentAnswer || "");
  const tail = answer.slice(-2400);
  const missing = params.assessment.missingSubparts.length > 0
    ? params.assessment.missingSubparts.join(", ")
    : "none detected";
  return `The answer above is incomplete. Continue and FINISH the same answer now.

Completion failures detected: ${params.assessment.reasons.join(", ") || "unknown"}
Explicit subparts still missing: ${missing}

Rules:
- Output only the missing continuation; do not restart, apologize, or repeat completed sections.
- Cover every missing explicit subpart from the original request.
- If the previous text stopped inside a sentence, complete that sentence naturally.
- Preserve Sinhala-first language, evidence constraints, formulas, and the existing structure.
- Close every Markdown fence, table, list, bracket, and math delimiter.
- End with a complete sentence. Do not end with a colon, conjunction, unfinished list item, or promise to continue.

Original request:
${String(params.originalPrompt || "").slice(0, 20_000)}

Tail of answer already delivered (do not repeat):
${tail}`;
}

/** Append continuation text while removing a repeated tail/prefix produced by the model. */
export function mergeContinuationText(existingValue: unknown, continuationValue: unknown) {
  const existing = String(existingValue || "");
  let continuation = String(continuationValue || "")
    .replace(/^\s*(?:continuing(?: the answer)?|continued|ඉතිරි කොටස|පිළිතුරේ ඉතිරි කොටස)\s*[:\-–—]?\s*/iu, "")
    .trimStart();
  if (!existing) return continuation.trim();
  if (!continuation) return existing;

  const maxOverlap = Math.min(1200, existing.length, continuation.length);
  let overlap = 0;
  for (let size = maxOverlap; size >= 10; size -= 1) {
    if (existing.slice(-size) === continuation.slice(0, size)) {
      overlap = size;
      break;
    }
  }
  continuation = continuation.slice(overlap).trimStart();
  if (!continuation) return existing;

  const joiner = /\s$/u.test(existing)
    ? ""
    : /[.!?。！？:\n]$/u.test(existing)
      ? "\n\n"
      : " ";
  return `${existing}${joiner}${continuation}`.trimEnd();
}
