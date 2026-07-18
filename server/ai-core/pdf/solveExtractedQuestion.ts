import { callGeminiWithFallback } from "../../ai/modelRouter";
import { retrieveRelevantKnowledge } from "../../knowledge/retrieve";
import { getSubjectSyllabusGroundingPdf } from "../../pdf/syllabusGrounding";
import { normalizeSinhalaUnicode } from "../../ai/responseHygiene";

export interface SolveMcqParams {
  uid?: string;
  sourceId?: string;
  questionText: string;
  options: string[];
  subject: string;
  year: string;
  questionNo: string;
}

export interface SolvedMcqResult {
  optionNo: string | null;
  optionText: string | null;
  formulaOrRule: string | null;
  explanationSinhala: string | null;
  whyOthersWrong: string[] | null;
  confidence: number;
  answerStatus: "official_marking_scheme" | "ai_solved_from_extracted_question" | "ai_solved_from_verified_question_and_syllabus" | "unknown";
  visualAid?: {
    type: "comparison_bars" | "process_flow" | "none";
    title?: string;
    items?: { label: string; value: number; displayValue?: string }[];
    steps?: string[];
    caption?: string;
  } | null;
}

function normalizeSolvedResult(value: any, normalizedOptions: string[]): SolvedMcqResult | null {
  const optionNo = String(value?.optionNo || "").replace(/\D/g, "");
  if (!/^[1-5]$/.test(optionNo)) return null;

  const optionText = normalizedOptions[Number(optionNo) - 1]?.replace(/^\([1-5]\)\s*/, "") || null;
  const explanationSinhala = normalizeSinhalaUnicode(value?.explanationSinhala || "").trim();
  if (!explanationSinhala || explanationSinhala.length < 30) return null;

  const whyOthersWrong = Array.isArray(value?.whyOthersWrong)
    ? value.whyOthersWrong.map((item: unknown) => normalizeSinhalaUnicode(item).trim()).filter(Boolean).slice(0, 5)
    : null;

  return {
    optionNo,
    optionText,
    formulaOrRule: value?.formulaOrRule ? normalizeSinhalaUnicode(value.formulaOrRule).trim() : null,
    explanationSinhala,
    whyOthersWrong,
    confidence: Math.max(0, Math.min(1, Number(value?.confidence) || 0.7)),
    answerStatus: "ai_solved_from_verified_question_and_syllabus",
    visualAid: value?.visualAid || null,
  };
}

async function collectSyllabusContext(params: SolveMcqParams) {
  if (!params.uid) return { text: "", pdfPart: null as any };

  const retrieval = await retrieveRelevantKnowledge({
    uid: params.uid,
    query: `${params.questionText}\n${params.options.join("\n")}`,
    subject: params.subject,
    limit: 12,
  }).catch(() => ({ chunks: [] } as any));

  const chunks = Array.isArray((retrieval as any)?.chunks) ? (retrieval as any).chunks : [];
  const syllabusChunks = chunks
    .filter((chunk: any) => {
      const identity = `${chunk?.sourceType || ""} ${chunk?.title || ""}`;
      const sameQuestionSource = params.sourceId && String(chunk?.sourceId || "") === String(params.sourceId);
      return !sameQuestionSource && !/past[ -]?paper|marking[ -]?scheme|question paper/i.test(identity);
    })
    .slice(0, 8)
    .map((chunk: any, index: number) => `[Syllabus evidence ${index + 1}]\n${String(chunk?.text || "").slice(0, 4_000)}`)
    .join("\n\n")
    .slice(0, 24_000);

  const syllabusPdf = await getSubjectSyllabusGroundingPdf(params.uid, params.subject).catch(() => null);
  let pdfPart: any = null;
  if (syllabusPdf?.gcsUri) {
    pdfPart = { fileData: { fileUri: syllabusPdf.gcsUri, mimeType: "application/pdf" } };
  } else if (syllabusPdf?.buffer?.length) {
    pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: syllabusPdf.buffer.toString("base64"),
      },
    };
  }

  return { text: syllabusChunks, pdfPart };
}


function parseJsonResponse(text: string) {
  const trimmed = String(text || "").trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const first = unfenced.indexOf("{");
    const last = unfenced.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(unfenced.slice(first, last + 1));
    throw new Error("Solver returned invalid JSON.");
  }
}

export async function solveExtractedMcqQuestion(params: SolveMcqParams): Promise<SolvedMcqResult | null> {
  const { questionText, options, subject, year, questionNo } = params;
  const normalizedOptions = options.map((option, index) => {
    const cleaned = String(option || "").replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/u, "").trim();
    return `(${index + 1}) ${cleaned}`;
  });
  
  const syllabusContext = await collectSyllabusContext(params);

  const systemInstruction = `
You are solving an already verified Sri Lankan G.C.E. A/L ${subject} MCQ.
The exact question and options were extracted from the ${year} paper PDF.
Use the supplied syllabus evidence as supporting subject knowledge.

RULES:
- Do not change the question text.
- Do not create a new question.
- Choose exactly one option (1, 2, 3, 4, or 5).
- Explain the logic in ordinary Sri Lankan classroom Sinhala with correctly normalized Unicode. Avoid stiff literal translations and unnatural technical wording.
- Answer the question even when an official marking scheme is unavailable.
- Never call an AI-solved answer an official answer.
- Use the syllabus only to solve the verified question. Never rewrite the question.
- Add a small visualAid only when a comparison or process diagram materially clarifies the answer.
- visualAid must contain factual values derived from the verified question and your calculation; otherwise use type:"none".
- Keep each distinct idea in a separate short paragraph inside explanationSinhala.
- Return JSON only.
`;

  const userPrompt = `
Question Number: ${questionNo}
Question Text: ${questionText}

Options:
${normalizedOptions.join("\n")}

Return JSON:
{
  "optionNo": "1|2|3|4|5",
  "optionText": "text of the selected option",
  "formulaOrRule": "any formula or rule used",
  "explanationSinhala": "clear explanation in Sinhala",
  "whyOthersWrong": ["reason 1", "reason 2"],
  "confidence": 0.0-1.0,
  "answerStatus": "ai_solved_from_verified_question_and_syllabus",
  "visualAid": {
    "type": "none|comparison_bars|process_flow",
    "title": "short title",
    "items": [{ "label": "label", "value": 1, "displayValue": "1×" }],
    "steps": ["step 1", "step 2"],
    "caption": "short factual caption"
  }
}
`;

  const parts: any[] = [];
  if (syllabusContext.pdfPart) parts.push(syllabusContext.pdfPart);
  parts.push({
    text: `${userPrompt}\n\nSUPPORTING SYLLABUS TEXT:\n${syllabusContext.text || "No indexed syllabus excerpt was available. Solve from the verified question and standard syllabus knowledge."}`,
  });

  for (const task of ["direct_pdf_solve", "final_answer"] as const) {
    try {
      const { result: response } = await callGeminiWithFallback(task, {
        model: "ignored",
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 2_500,
        },
      } as any);

      if (!response.text) continue;
      const parsed = parseJsonResponse(response.text);
      const normalized = normalizeSolvedResult(parsed, normalizedOptions);
      if (normalized) return normalized;
    } catch (err) {
      console.error(`[AI_CORE] MCQ solver ${task} failed:`, err);
    }
  }

  return null;
}
