import { ResolvedSource } from "./examResourceResolver";
import { cleanAssistantResponse, normalizeSinhalaUnicode } from "../../shared/text/assistantText";

export type MarkingSchemeResponseParams = {
  subject: string;
  year: string;
  questionNo: string;
  paperSource?: ResolvedSource;
  markingSchemeSource?: ResolvedSource;
  syllabusSource?: ResolvedSource;
  paperStructureSource?: ResolvedSource;
  questionText?: string;
  officialAnswer?: string;
  markSplit?: Array<{ part: string; marks: string }>;
  examTips?: string[];
  isEstimated: boolean;
};

/**
 * Legacy compatibility formatter.
 *
 * Chat replies contain only the extracted question and its validated answer.
 * Internal source metadata remains in source cards and logs.
 */
export function composeMarkingSchemeAnswer(params: MarkingSchemeResponseParams): string {
  const question = normalizeSinhalaUnicode(params.questionText || "").trim();
  const answer = cleanAssistantResponse(params.officialAnswer || "").trim();
  return cleanAssistantResponse([question, answer].filter(Boolean).join("\n\n"));
}
