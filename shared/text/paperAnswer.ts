import { cleanAssistantResponse, normalizeSinhalaUnicode } from "./assistantText";

export type PaperSolvedAnswer = {
  optionNo?: string | number | null;
  optionText?: string | null;
  explanationSinhala?: string | null;
  whyOthersWrong?: string[] | null;
};

function stripLeadingOptionMarker(value: unknown, optionNo?: string | null): string {
  let text = cleanAssistantResponse(value).trim();
  if (!text) return "";
  if (optionNo) {
    const escaped = optionNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*(?:\\(\\s*${escaped}\\s*\\)|${escaped}[.)])\\s*`), "");
  }
  return text.trim();
}

function collapseRepeatedAnswerMarker(value: string): string {
  return value.replace(/^\s*\(\s*([1-5])\s*\)\s*\(\s*\1\s*\)\s*/, "($1) ").trim();
}

export function formatPaperQuestionAnswer(params: {
  questionText?: unknown;
  options?: unknown[] | null;
  officialAnswer?: unknown;
  solvedAnswer?: PaperSolvedAnswer | null;
  explanationSinhala?: unknown;
  includeWhyOthersWrong?: boolean;
}): string {
  const questionText = normalizeSinhalaUnicode(params.questionText).trim();
  const options = Array.isArray(params.options)
    ? params.options.map((value) => normalizeSinhalaUnicode(value).trim()).filter(Boolean)
    : [];
  const solved = params.solvedAnswer || null;
  const optionNo = String(solved?.optionNo || "").replace(/\D/g, "");
  const officialAnswer = cleanAssistantResponse(params.officialAnswer).trim();
  const optionText = stripLeadingOptionMarker(solved?.optionText, optionNo || null);
  const explanation = cleanAssistantResponse(solved?.explanationSinhala || params.explanationSinhala).trim();
  const whyOthersWrong = Array.isArray(solved?.whyOthersWrong)
    ? solved!.whyOthersWrong!.map((value) => cleanAssistantResponse(value)).filter(Boolean)
    : [];

  const blocks: string[] = [];
  if (questionText) {
    blocks.push(questionText);
    if (options.length > 0) blocks.push(options.join("\n"));
  }

  const answerText = collapseRepeatedAnswerMarker(officialAnswer || [optionNo ? `(${optionNo})` : "", optionText].filter(Boolean).join(" ").trim());
  if (answerText) blocks.push(`**පිළිතුර:** ${answerText}`);
  if (explanation) blocks.push(explanation);

  if (params.includeWhyOthersWrong !== false && whyOthersWrong.length > 0) {
    blocks.push(`**අනෙක් විකල්ප නොගැළපෙන්නේ ඇයි?**\n${whyOthersWrong.map((reason) => `- ${reason}`).join("\n")}`);
  }

  return cleanAssistantResponse(blocks.join("\n\n"));
}


export function formatPaperQuizQuestion(params: {
  year: string;
  subject: string;
  questionNo: number;
  startQuestionNo: number;
  endQuestionNo: number;
  questionText?: unknown;
  options?: unknown[] | null;
  feedbackPrefix?: unknown;
}): string {
  const questionText = normalizeSinhalaUnicode(params.questionText).trim();
  const options = Array.isArray(params.options)
    ? params.options.map((value) => normalizeSinhalaUnicode(value).trim()).filter(Boolean)
    : [];
  const optionLines = options.map((option, index) => {
    const clean = option.replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/, "");
    return `(${index + 1}) ${clean}`;
  });
  const progress = params.startQuestionNo === 1 && params.endQuestionNo === 50
    ? `${params.questionNo}/50`
    : `${params.questionNo} (${params.startQuestionNo}–${params.endQuestionNo})`;
  const feedback = cleanAssistantResponse(params.feedbackPrefix).trim();

  return cleanAssistantResponse([
    feedback,
    `### ${params.year} ${params.subject} MCQ ${progress}`,
    questionText,
    optionLines.join("\n"),
    "**ඔබේ පිළිතුර ලෙස 1–5 අතර අංකය පමණක් යවන්න.**",
  ].filter(Boolean).join("\n\n"));
}
