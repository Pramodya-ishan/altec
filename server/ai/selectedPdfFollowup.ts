export type SelectedPdfQuestionFollowup = {
  questionNo: string;
  questionType: "MCQ" | "ESSAY";
};

/**
 * Parse deliberately short follow-ups after a user has selected a PDF.
 * Keeping this deterministic prevents the generic chat model from inventing
 * a question when the user writes only "1", "q1", or "1st mcq".
 */
export function parseSelectedPdfQuestionFollowup(prompt: unknown): SelectedPdfQuestionFollowup | null {
  const text = String(prompt || "").trim().toLowerCase();
  if (!text || text.length > 80) return null;

  const explicit = text.match(/\b(?:mcq|q|question|prashna|prasna)\s*[-:#]?\s*0*(\d{1,3})\b/i);
  const ordinal = text.match(/\b0*(\d{1,3})(?:st|nd|rd|th)\b/i);
  const numericOnly = text.match(/^0*(\d{1,3})$/);
  const sinhalaOrdinal = text.match(/(?:^|\s)0*(\d{1,3})\s*(?:වෙනි|වැනි)(?:\s|$)/);
  const firstWord = text.match(/(?:^|\s)(?:first|පළමු)(?:\s+(?:mcq|q|question|ප්‍රශ්නය))?(?:\s|$)/i);
  const match = explicit || ordinal || numericOnly || sinhalaOrdinal;
  if (firstWord && !match) {
    return {
      questionNo: "1",
      questionType: /essay|structured|රචනා/i.test(text) ? "ESSAY" : "MCQ",
    };
  }
  if (!match) return null;

  const questionNo = String(Number(match[1]));
  if (!questionNo || questionNo === "0") return null;

  return {
    questionNo,
    questionType: /essay|structured|රචනා/i.test(text) ? "ESSAY" : "MCQ",
  };
}
