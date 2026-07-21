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

  // Exam scans and OCR often lose one or both parentheses around roman
  // subparts. Accept line-leading forms such as "i)", "ii." and "(iii)"
  // without treating values inside normal sentences as requested parts.
  const looseRomanLabels = /(?:^|\n)\s*(?:\(([ivxlcdmIVXLCDM]{1,7})\)|([ivxlcdmIVXLCDM]{1,7})[.)\-:])\s+/gu;
  for (const match of text.matchAll(looseRomanLabels)) {
    const roman = String(match[1] || match[2] || "").toLowerCase();
    if (roman) labels.push(activeSection ? `${activeSection}.${roman}` : roman);
  }

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

/** Normalize prose for duplicate detection without changing the displayed text. */
function normalizeOverlapText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripRepeatedLeadingSegments(existing: string, continuation: string) {
  const tailSegments = existing
    .slice(-5000)
    .split(/(?<=[.!?。！？])\s+|\n{2,}/u)
    .map((segment) => normalizeOverlapText(segment))
    .filter((segment) => segment.length >= 12)
    .slice(-16);
  if (tailSegments.length === 0) return continuation;

  let value = continuation;
  for (let pass = 0; pass < 5; pass += 1) {
    const match = value.match(/^([\s\S]{12,1200}?)(?=(?:\n{2,}|(?<=[.!?。！？])\s+|$))/u);
    if (!match) break;
    const normalized = normalizeOverlapText(match[1]);
    if (!normalized || !tailSegments.includes(normalized)) break;
    value = value.slice(match[0].length).trimStart();
  }
  return value;
}

/** Return true only when a continuation adds non-trivial new information. */
export function continuationMadeMeaningfulProgress(existingValue: unknown, mergedValue: unknown) {
  const existing = String(existingValue || "");
  const merged = String(mergedValue || "");
  if (merged.length <= existing.length) return false;
  const added = merged.slice(existing.length).trim();
  if (added.length < 12) return false;
  const existingNorm = normalizeOverlapText(existing.slice(-8000));
  const addedNorm = normalizeOverlapText(added);
  if (addedNorm.length < 8) return false;
  if (existingNorm.includes(addedNorm)) return false;
  const tokens = addedNorm.split(" ").filter((token) => token.length >= 3);
  const unique = new Set(tokens);
  return added.length >= 18 || unique.size >= 2;
}

/** Append continuation text while removing exact and normalized repeated prefixes. */
export function mergeContinuationText(existingValue: unknown, continuationValue: unknown) {
  const existing = String(existingValue || "");
  let continuation = String(continuationValue || "")
    .replace(/^\s*(?:continuing(?: the answer)?|continued|ඉතිරි කොටස|පිළිතුරේ ඉතිරි කොටස)\s*[:\-–—]?\s*/iu, "")
    .trimStart();
  if (!existing) return continuation.trim();
  if (!continuation) return existing;

  const maxOverlap = Math.min(2400, existing.length, continuation.length);
  let overlap = 0;
  for (let size = maxOverlap; size >= 10; size -= 1) {
    if (existing.slice(-size) === continuation.slice(0, size)) {
      overlap = size;
      break;
    }
  }
  continuation = continuation.slice(overlap).trimStart();
  continuation = stripRepeatedLeadingSegments(existing, continuation);
  if (!continuation) return existing;

  // Token-level suffix/prefix overlap catches whitespace and punctuation changes.
  const existingTokens = normalizeOverlapText(existing.slice(-5000)).split(" ").filter(Boolean);
  const continuationTokens = normalizeOverlapText(continuation.slice(0, 5000)).split(" ").filter(Boolean);
  const maxTokenOverlap = Math.min(80, existingTokens.length, continuationTokens.length);
  let tokenOverlap = 0;
  for (let size = maxTokenOverlap; size >= 4; size -= 1) {
    if (existingTokens.slice(-size).join(" ") === continuationTokens.slice(0, size).join(" ")) {
      tokenOverlap = size;
      break;
    }
  }
  if (tokenOverlap > 0) {
    let consumed = 0;
    let seen = 0;
    const tokenRegex = /[\p{L}\p{N}]+/gu;
    for (const match of continuation.matchAll(tokenRegex)) {
      seen += 1;
      consumed = (match.index || 0) + match[0].length;
      if (seen >= tokenOverlap) break;
    }
    continuation = continuation.slice(consumed).replace(/^[\s,.;:()\-–—]+/u, "").trimStart();
  }
  if (!continuation) return existing;

  const joiner = /\s$/u.test(existing)
    ? ""
    : /[.!?。！？:\n]$/u.test(existing)
      ? "\n\n"
      : " ";
  return `${existing}${joiner}${continuation}`.trimEnd();
}
