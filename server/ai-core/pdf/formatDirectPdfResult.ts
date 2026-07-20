import { stripRawVisualBlocks } from "../answer/stripVisualBlocks";
import { normalizeSinhalaUnicode } from "../../ai/responseHygiene";

function clean(value: unknown) {
  return normalizeSinhalaUnicode(stripRawVisualBlocks(String(value || "")))
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeOption(value: unknown, index: number) {
  const text = clean(value).replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/u, "").trim();
  return `(${index + 1}) ${text}`;
}

export function formatDirectPdfResultMarkdown(result: any, questionType: string) {
  const questionText = clean(result?.sourceEvidence?.questionText);
  const options = Array.isArray(result?.sourceEvidence?.options)
    ? result.sourceEvidence.options.map(normalizeOption).filter(Boolean)
    : [];
  const answer = result?.answer || {};
  const solved = answer?.solvedAnswer || null;
  const officialAnswer = clean(answer?.officialAnswer);
  const estimatedAnswer = clean(answer?.estimatedAnswer);
  const essayAnswer = clean(solved?.answerMarkdownSinhala);
  const explanation = clean(solved?.explanationSinhala || answer?.explanationSinhala);
  const optionNo = String(solved?.optionNo || "").replace(/\D/gu, "");
  const optionText = clean(solved?.optionText);
  const formula = clean(solved?.formulaOrRule);
  const whyOthersWrong = Array.isArray(solved?.whyOthersWrong)
    ? solved.whyOthersWrong.map(clean).filter(Boolean)
    : [];

  const sections: string[] = [];
  if (questionText) sections.push(`### ප්‍රශ්නය\n\n${questionText}`);
  if (options.length > 0) {
    sections.push(options.map((option: string) => `**${option.slice(0, 3)}**${option.slice(3)}`).join("\n\n"));
  }

  const isEssay = /ESSAY|STRUCTURED/iu.test(String(questionType || ""));
  let finalAnswer = officialAnswer || essayAnswer || estimatedAnswer;
  if (!finalAnswer && optionNo) finalAnswer = `(${optionNo})${optionText ? ` ${optionText}` : ""}`;
  if (finalAnswer) sections.push(`### පිළිතුර\n\n${isEssay ? finalAnswer : `**${finalAnswer}**`}`);
  if (formula) sections.push(`### භාවිත කළ සූත්‍රය / නියමය\n\n${formula}`);
  if (explanation) sections.push(`### පැහැදිලි කිරීම\n\n${explanation}`);
  if (whyOthersWrong.length > 0) {
    sections.push(`### අනෙක් විකල්ප නොගැළපෙන හේතු\n\n${whyOthersWrong.map((item: string) => `- ${item}`).join("\n")}`);
  }
  if (solved?.complete === false) {
    const missing = Array.isArray(solved?.missingSubparts) ? solved.missingSubparts.map(clean).filter(Boolean) : [];
    sections.push(`> පිළිතුර සම්පූර්ණ නොවීය${missing.length ? `: ${missing.join(", ")}` : ""}. නොපෙනෙන කොටස් අනුමාන කර නැහැ.`);
  }

  return clean(sections.join("\n\n"));
}
