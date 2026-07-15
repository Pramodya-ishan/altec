import { callGeminiWithFallback } from "../../ai/modelRouter";
import { AI_MODELS } from "../../ai/client";

export interface SolveMcqParams {
  questionText: string;
  options: string[];
  subject: string;
  year: string;
  questionNo: string;
  referencePdfBuffer?: Buffer | null;
  referencePdfGcsUri?: string | null;
  referenceLabel?: string;
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
}

export async function solveExtractedMcqQuestion(params: SolveMcqParams): Promise<SolvedMcqResult | null> {
  const { questionText, options, subject, year, questionNo, referencePdfBuffer, referencePdfGcsUri, referenceLabel } = params;
  const hasReferencePdf = Boolean(referencePdfBuffer || referencePdfGcsUri);

  const systemInstruction = `
You are solving an already verified Sri Lankan A/L ${subject} MCQ.
The question and options below were extracted from the official ${year} PDF.
Choose the best answer.

RULES:
- Do not change the question text.
- Do not create a new question.
- Choose exactly one option (1, 2, 3, 4, or 5).
- Explain the logic clearly in Sinhala.
- ${hasReferencePdf ? `Use the attached ${referenceLabel || "official syllabus PDF"} as the primary theory reference. Never claim that it contains the question itself.` : "No syllabus PDF is attached. Do not claim that one was used."}
- If the reference does not support a confident conclusion, return optionNo:null instead of inventing evidence.
- Return JSON only.
`;

  const userPrompt = `
Question Number: ${questionNo}
Question Text: ${questionText}

Options:
${options.map((opt, i) => `(${i + 1}) ${opt}`).join("\n")}

Return JSON:
{
  "optionNo": "1|2|3|4|5",
  "optionText": "text of the selected option",
  "formulaOrRule": "any formula or rule used",
  "explanationSinhala": "clear explanation in Sinhala",
  "whyOthersWrong": ["reason 1", "reason 2"],
  "confidence": 0.0-1.0,
  "answerStatus": "ai_solved_from_extracted_question",
  "syllabusEvidence": "relevant syllabus topic/principle or null",
  "usedSyllabus": ${hasReferencePdf ? "true" : "false"}
}
`;

  try {
    const parts: any[] = [];
    if (referencePdfBuffer) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: referencePdfBuffer.toString("base64") } });
    } else if (referencePdfGcsUri) {
      parts.push({ fileData: { mimeType: "application/pdf", fileUri: referencePdfGcsUri } });
    }
    parts.push({ text: userPrompt });

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

    if (!response.text) return null;

    const result = JSON.parse(response.text.trim());
    return result;
  } catch (err) {
    console.error("[AI_CORE] MCQ Solver failed:", err);
    return null;
  }
}
