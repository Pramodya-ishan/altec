import { cleanAssistantResponse, normalizeSinhalaUnicode } from "./assistantText";

export type PaperSolvedAnswer = {
  optionNo?: string | number | null;
  optionText?: string | null;
  explanationSinhala?: string | null;
  whyOthersWrong?: string[] | null;
};

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
  const optionText = cleanAssistantResponse(solved?.optionText).trim();
  const explanation = cleanAssistantResponse(solved?.explanationSinhala || params.explanationSinhala).trim();
  const whyOthersWrong = Array.isArray(solved?.whyOthersWrong)
    ? solved!.whyOthersWrong!.map((value) => cleanAssistantResponse(value)).filter(Boolean)
    : [];

  const blocks: string[] = [];
  if (questionText) {
    blocks.push(questionText);
    if (options.length > 0) blocks.push(options.join("\n"));
  }

  const answerText = officialAnswer || [optionNo ? `(${optionNo})` : "", optionText].filter(Boolean).join(" ").trim();
  if (answerText) blocks.push(`**පිළිතුර:** ${answerText}`);
  if (explanation) blocks.push(explanation);

  if (params.includeWhyOthersWrong !== false && whyOthersWrong.length > 0) {
    blocks.push(`**අනෙක් විකල්ප නොගැළපෙන්නේ ඇයි?**\n${whyOthersWrong.map((reason) => `- ${reason}`).join("\n")}`);
  }

  return cleanAssistantResponse(blocks.join("\n\n"));
}
