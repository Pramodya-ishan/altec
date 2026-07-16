import { callGeminiWithFallback } from "../../ai/modelRouter";
import { AI_MODELS } from "../../ai/client";
import { cleanAssistantResponse, normalizeSinhalaUnicode } from "../../../shared/text/assistantText";

export interface SolveMcqParams {
  questionText: string;
  options: string[];
  subject: string;
  year: string;
  questionNo: string;
  referencePdfBuffer?: Buffer | null;
  referencePdfGcsUri?: string | null;
  referenceLabel?: string;
  questionPdfBuffer?: Buffer | null;
  questionPdfGcsUri?: string | null;
  visualOnly?: boolean;
}

export interface SolvedMcqResult {
  optionNo: string | null;
  optionText: string | null;
  formulaOrRule: string | null;
  explanationSinhala: string | null;
  whyOthersWrong: string[] | null;
  confidence: number;
  answerStatus: "official_marking_scheme" | "ai_solved_from_extracted_question" | "unknown";
  syllabusEvidence?: string | null;
  usedSyllabus?: boolean;
  questionUnicode?: string | null;
  optionsUnicode?: string[] | null;
}

export async function solveExtractedMcqQuestion(params: SolveMcqParams): Promise<SolvedMcqResult | null> {
  const {
    questionText,
    options,
    subject,
    year,
    questionNo,
    referencePdfBuffer,
    referencePdfGcsUri,
    referenceLabel,
    questionPdfBuffer,
    questionPdfGcsUri,
    visualOnly = false,
  } = params;
  const hasReferencePdf = Boolean(referencePdfBuffer || referencePdfGcsUri);
  const hasQuestionPdf = Boolean(questionPdfBuffer || questionPdfGcsUri);

  const systemInstruction = `
You are solving an already verified Sri Lankan A/L ${subject} MCQ.
The question and options below were extracted from the official ${year} PDF.
Choose the best answer.

RULES:
- ${visualOnly ? "Locate the exact requested question in the attached QUESTION PDF. Ignore any corrupted embedded text layer and read the rendered glyphs and diagram." : "Do not change the supplied question meaning."}
- Do not create a new question.
- Choose exactly one option (1, 2, 3, 4, or 5).
- Explain the decisive rule or fact clearly in Sinhala.
- Keep optionText as the selected option text only; do not prefix it with “(1)”, “1.”, or another option number.
- Do not invent detailed classifications or facts about distractors. Populate whyOthersWrong only for alternatives that can be rejected directly from the supplied question or the attached syllabus; otherwise return an empty array.
- If a place name, species name, technical term, or OCR transcription is uncertain, do not assign it a speculative category. State only the verified distinction needed to select the answer.
- ${hasQuestionPdf ? "The attached QUESTION PDF is authoritative visual evidence. Inspect its diagram, labels, arrows and relative positions before solving." : "No question-page image/PDF is attached; only use the extracted evidence supplied below."}
- ${hasReferencePdf ? `Use the attached ${referenceLabel || "official syllabus PDF"} as the primary theory reference. Never claim that it contains the question itself.` : "No syllabus PDF is attached. Do not claim that one was used."}
- Never repeat legacy-font/mojibake text in the answer. Write Sinhala only as Unicode Sinhala.
- Return a clean Unicode transcription of the exact question and all five options as questionUnicode/optionsUnicode.
- If a diagram is required and is attached, read it. Return optionNo:null only when the required visual evidence is genuinely absent.
- Return JSON only.
`;

  const userPrompt = `
Question Number: ${questionNo}
Question Text: ${visualOnly ? "[Read the exact question directly from the attached PDF visual.]" : questionText}

Options:
${visualOnly ? "[Read every printed option directly from the attached PDF visual.]" : options.map((opt, i) => `(${i + 1}) ${opt}`).join("\n")}

Return JSON:
{
  "optionNo": "1|2|3|4|5",
  "optionText": "text of the selected option",
  "formulaOrRule": "any formula or rule used",
  "explanationSinhala": "clear explanation in Sinhala",
  "whyOthersWrong": [],
  "confidence": 0.0-1.0,
  "answerStatus": "ai_solved_from_extracted_question",
  "syllabusEvidence": "relevant syllabus topic/principle or null",
  "usedSyllabus": ${hasReferencePdf ? "true" : "false"},
  "questionUnicode": "clean Unicode transcription of the exact question",
  "optionsUnicode": ["option 1", "option 2", "option 3", "option 4", "option 5"]
}
`;

  const parseJsonResult = (text: string) => {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  };

  const attemptSolve = async (repairAttempt: boolean) => {
    const parts: any[] = [];
    if (questionPdfBuffer) {
      parts.push({ text: "QUESTION PDF (use its rendered page and diagram as evidence):" });
      parts.push({ inlineData: { mimeType: "application/pdf", data: questionPdfBuffer.toString("base64") } });
    } else if (questionPdfGcsUri) {
      parts.push({ text: "QUESTION PDF (use its rendered page and diagram as evidence):" });
      parts.push({ fileData: { mimeType: "application/pdf", fileUri: questionPdfGcsUri } });
    }
    if (referencePdfBuffer) {
      parts.push({ text: `THEORY REFERENCE (${referenceLabel || "official syllabus PDF"}):` });
      parts.push({ inlineData: { mimeType: "application/pdf", data: referencePdfBuffer.toString("base64") } });
    } else if (referencePdfGcsUri) {
      parts.push({ text: `THEORY REFERENCE (${referenceLabel || "official syllabus PDF"}):` });
      parts.push({ fileData: { mimeType: "application/pdf", fileUri: referencePdfGcsUri } });
    }
    parts.push({
      text: repairAttempt
        ? `${userPrompt}\nThis is a validation retry. Inspect the requested MCQ and its diagram again. You MUST select exactly one option 1-5 and return valid JSON; do not return null merely because the embedded Sinhala text layer is corrupted.`
        : userPrompt,
    });

    let responseText = "";
    try {
      const { result: response } = await callGeminiWithFallback("direct_pdf_solve", {
        model: AI_MODELS.pdf,
        contents: [
          {
            role: "user",
            parts,
          }
        ],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json"
        }
      });
      responseText = response.text || "";
    } catch (error) {
      console.warn(`[AI_CORE] MCQ solver ${repairAttempt ? "validation" : "primary"} attempt failed`, error);
      return null;
    }

    if (!responseText) return null;

    const result = parseJsonResult(responseText);
    if (!result) return null;
    const optionNo = String(result?.optionNo || "").trim();
    if (!/^[1-5]$/.test(optionNo)) return null;
    const questionUnicode = String(result?.questionUnicode || "").trim();
    const optionsUnicode = Array.isArray(result?.optionsUnicode)
      ? result.optionsUnicode.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];
    if (visualOnly && (questionUnicode.length < 12 || optionsUnicode.length < 4)) return null;
    return {
      ...result,
      optionNo,
      optionText: normalizeSinhalaUnicode(result?.optionText || optionsUnicode[Number(optionNo) - 1] || options[Number(optionNo) - 1] || "").trim(),
      formulaOrRule: result?.formulaOrRule ? normalizeSinhalaUnicode(result.formulaOrRule).trim() : null,
      explanationSinhala: result?.explanationSinhala ? cleanAssistantResponse(result.explanationSinhala) : null,
      whyOthersWrong: Array.isArray(result?.whyOthersWrong)
        ? result.whyOthersWrong.map((value: unknown) => cleanAssistantResponse(value)).filter(Boolean)
        : null,
      answerStatus: "ai_solved_from_extracted_question",
      confidence: Math.max(0, Math.min(1, Number(result?.confidence || 0))),
      questionUnicode: questionUnicode ? normalizeSinhalaUnicode(questionUnicode) : null,
      optionsUnicode: optionsUnicode.length >= 4 ? optionsUnicode.map(normalizeSinhalaUnicode) : null,
      syllabusEvidence: result?.syllabusEvidence ? cleanAssistantResponse(result.syllabusEvidence) : null,
    };
  };

  const first = await attemptSolve(false);
  if (first) return first;
  return await attemptSolve(true);
}
