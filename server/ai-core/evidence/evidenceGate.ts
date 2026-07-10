import { QuestionEvidence } from "./evidenceTypes";

export function validateQuestionEvidence(evidence: QuestionEvidence, request: { year?: string | null, subject?: string | null, questionNo?: string | null, questionType?: string | null }) {
  if (!evidence) return { ok: false, reason: "NO_EVIDENCE" };

  if (request.year && evidence.year !== request.year) return { ok: false, reason: "YEAR_MISMATCH" };
  if (request.subject && evidence.subject !== request.subject) return { ok: false, reason: "SUBJECT_MISMATCH" };
  if (request.questionNo && String(evidence.questionNo) !== String(request.questionNo)) return { ok: false, reason: "QUESTION_NUMBER_MISMATCH" };
  if (request.questionType && evidence.questionType !== request.questionType) return { ok: false, reason: "QUESTION_TYPE_MISMATCH" };

  if (request.questionType === "MCQ" && (!evidence.options || evidence.options.length < 4)) {
    // A/L MCQs usually have 5 options, but at least 4 is a safe bet for "readable"
    return { ok: false, reason: "MCQ_MISSING_OPTIONS" };
  }

  if (!evidence.questionText || evidence.questionText.length < 20) return { ok: false, reason: "INSUFFICIENT_QUESTION_TEXT" };
  if (evidence.confidence < 0.7) return { ok: false, reason: "LOW_CONFIDENCE" };
  if (evidence.validationStatus === "rejected") return { ok: false, reason: "EVIDENCE_REJECTED" };

  // [FIX 10] Reject estimated or model-generated patterns for official papers
  const combined = (evidence.questionText + " " + (evidence.officialAnswer || "") + " " + (evidence.estimatedAnswer || "")).toLowerCase();
  if (combined.includes("estimated") || combined.includes("likely") || combined.includes("probably") || combined.includes("ආදර්ශ") || combined.includes("model question")) {
    return { ok: false, reason: "ESTIMATED_OR_MODEL_ANSWER_REJECTED" };
  }

  return { ok: true, evidence };
}
