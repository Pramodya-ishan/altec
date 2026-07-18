import { callGeminiWithFallback } from "../../ai/modelRouter";
import { retrieveRelevantKnowledge } from "../../knowledge/retrieve";
import { getSubjectSyllabusGroundingPdf } from "../../pdf/syllabusGrounding";
import { getSftReferenceGroundingParts } from "../../pdf/sftReferenceGrounding";
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
  scopeStatus?: "in_syllabus" | "out_of_syllabus" | "unverified";
  syllabusBasis?: string | null;
  visualAid?: {
    type: "comparison_bars" | "process_flow" | "none";
    title?: string;
    items?: { label: string; value: number; displayValue?: string }[];
    steps?: string[];
    caption?: string;
  } | null;
}

function normalizeSolvedResult(value: any, normalizedOptions: string[]): SolvedMcqResult | null {
  const scopeStatus = value?.inSyllabus === true
    ? "in_syllabus"
    : value?.inSyllabus === false
      ? "out_of_syllabus"
      : "unverified";
  const syllabusBasis = normalizeSinhalaUnicode(value?.syllabusBasis || "").trim() || null;
  const explanationSinhala = normalizeSinhalaUnicode(value?.explanationSinhala || "").trim();

  if (scopeStatus !== "in_syllabus") {
    const safeMessage = explanationSinhala.length >= 20
      ? explanationSinhala
      : "මෙම ප්‍රශ්නය නිල SFT විෂය නිර්දේශයට අයත් බව සනාථ කරගත නොහැකි නිසා පිළිතුරක් අනුමාන කරන්නේ නැහැ.";
    return {
      optionNo: null,
      optionText: null,
      formulaOrRule: null,
      explanationSinhala: safeMessage,
      whyOthersWrong: null,
      confidence: Math.max(0, Math.min(1, Number(value?.confidence) || 0.5)),
      answerStatus: "unknown",
      scopeStatus,
      syllabusBasis,
      visualAid: null,
    };
  }

  const optionNo = String(value?.optionNo || "").replace(/\D/g, "");
  if (!/^[1-5]$/.test(optionNo)) return null;

  const optionText = normalizedOptions[Number(optionNo) - 1]?.replace(/^\([1-5]\)\s*/, "") || null;
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
    scopeStatus,
    syllabusBasis,
    visualAid: value?.visualAid || null,
  };
}

type SyllabusContext = {
  text: string;
  pdfPart: any | null;
  referenceParts: any[];
  referenceSources: Array<Record<string, unknown>>;
};

async function collectSyllabusContext(params: SolveMcqParams): Promise<SyllabusContext> {
  if (!params.uid) return { text: "", pdfPart: null, referenceParts: [], referenceSources: [] };

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

  const reference = String(params.subject || "").toUpperCase() === "SFT"
    ? await getSftReferenceGroundingParts(`${params.questionText}\n${params.options.join("\n")}`)
      .catch(() => ({ parts: [], sources: [], domains: [] }))
    : { parts: [], sources: [], domains: [] };

  return { text: syllabusChunks, pdfPart, referenceParts: reference.parts, referenceSources: reference.sources };
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
Use the supplied syllabus PDF and approved subject evidence as the authoritative scope boundary.

RULES:
- Do not change the question text.
- Do not create a new question.
- First verify that the tested concept is inside the supplied subject syllabus.
- If it is outside or cannot be verified, return inSyllabus:false, optionNo:null, and do not solve it from general memory.
- Only when inSyllabus:true, choose exactly one option (1, 2, 3, 4, or 5).
- Explain the logic in ordinary Sri Lankan classroom Sinhala with correctly normalized Unicode. Avoid stiff literal translations and unnatural technical wording.
- Answer the question even when an official marking scheme is unavailable.
- Never call an AI-solved answer an official answer.
- Use the syllabus only to solve the verified question. Never rewrite the question.
- For SFT, do not import material from the separate A/L Biology/Chemistry/Physics/Mathematics syllabuses unless the supplied SFT syllabus or SFT resource evidence contains it.
- When generic knowledge conflicts with the supplied syllabus, follow the supplied syllabus.
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
  "inSyllabus": true|false,
  "syllabusBasis": "short syllabus unit or reason it is outside scope",
  "optionNo": "1|2|3|4|5|null",
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
  if (Array.isArray(syllabusContext.referenceParts)) parts.push(...syllabusContext.referenceParts);
  parts.push({
    text: `${userPrompt}\n\nSUPPORTING SYLLABUS TEXT:\n${syllabusContext.text || "No indexed excerpt was available. Use the attached authoritative syllabus PDF. Do not expand beyond its scope."}`,
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


export interface SolveEssayParams {
  uid?: string;
  sourceId?: string;
  questionText: string;
  subject: string;
  year: string;
  questionNo: string;
  questionType: string;
}

export interface SolvedEssayResult {
  answerMarkdownSinhala: string;
  keyPoints: string[];
  confidence: number;
  answerStatus: "ai_solved_from_verified_question_and_syllabus" | "unknown";
  scopeStatus: "in_syllabus" | "out_of_syllabus" | "unverified";
  syllabusBasis?: string | null;
}

function normalizeEssayResult(value: any): SolvedEssayResult | null {
  const scopeStatus = value?.inSyllabus === true
    ? "in_syllabus"
    : value?.inSyllabus === false
      ? "out_of_syllabus"
      : "unverified";
  const syllabusBasis = normalizeSinhalaUnicode(value?.syllabusBasis || "").trim() || null;
  const answerMarkdownSinhala = normalizeSinhalaUnicode(value?.answerMarkdownSinhala || "")
    .replace(/(?:→\s*){2,}/g, "→ ")
    .trim();
  if (scopeStatus !== "in_syllabus") {
    const safeMessage = answerMarkdownSinhala.length >= 20
      ? answerMarkdownSinhala
      : "මෙම ප්‍රශ්නය නිල SFT විෂය නිර්දේශයට අයත් බව සනාථ කරගත නොහැකි නිසා පිළිතුරක් අනුමාන කරන්නේ නැහැ.";
    return {
      answerMarkdownSinhala: safeMessage,
      keyPoints: [],
      confidence: Math.max(0, Math.min(1, Number(value?.confidence) || 0.5)),
      answerStatus: "unknown",
      scopeStatus,
      syllabusBasis,
    };
  }
  if (answerMarkdownSinhala.length < 40) return null;
  const keyPoints = Array.isArray(value?.keyPoints)
    ? value.keyPoints.map((item: unknown) => normalizeSinhalaUnicode(item).trim()).filter(Boolean).slice(0, 12)
    : [];
  return {
    answerMarkdownSinhala,
    keyPoints,
    confidence: Math.max(0, Math.min(1, Number(value?.confidence) || 0.7)),
    answerStatus: "ai_solved_from_verified_question_and_syllabus",
    scopeStatus,
    syllabusBasis,
  };
}

export async function solveExtractedEssayQuestion(params: SolveEssayParams): Promise<SolvedEssayResult | null> {
  if (!params.questionText || params.questionText.trim().length < 20) return null;
  const syllabusContext = await collectSyllabusContext({ ...params, options: [] });
  const parts: any[] = [];
  if (syllabusContext.pdfPart) parts.push(syllabusContext.pdfPart);
  if (Array.isArray(syllabusContext.referenceParts)) parts.push(...syllabusContext.referenceParts);
  parts.push({
    text: `VERIFIED QUESTION FROM THE SELECTED PDF:
${params.questionText}

` +
      `INDEXED APPROVED SFT EVIDENCE:
${syllabusContext.text || "No indexed excerpt was available; use only the attached official syllabus and SFT reference PDF."}`,
  });

  const systemInstruction = `
You answer one exact, already extracted Sri Lankan G.C.E. A/L ${params.subject} ${params.questionType} question.
The selected question PDF is authoritative for what was asked. The official subject syllabus is the scope boundary. Approved SFT reference books may explain only content already inside that SFT syllabus.

NON-NEGOTIABLE RULES:
- First verify the tested concept against the attached official subject syllabus.
- If it is outside the syllabus or cannot be verified, return inSyllabus:false and a short Sinhala scope message; do not answer from general memory.
- Never invent, rename, extend, or replace the question or its subparts.
- Answer only subparts visibly present in VERIFIED QUESTION.
- If a subpart is incomplete or unreadable, state that exact subpart could not be read; do not fill it from memory.
- Never import standalone A/L Biology, Chemistry, Physics, or Mathematics syllabus content into SFT.
- Never call an AI-generated solution an official marking-scheme answer.
- Write natural Sri Lankan classroom Sinhala in correct Unicode. Use ප්‍ර, ශ්‍ර, ක්‍ර, ද්‍ර, ත්‍ර and other conjuncts correctly.
- Do not output duplicate arrows such as → →.
- Use concise exam-answer wording, with the original i), ii), a), b) labels where present.
- Return JSON only with: inSyllabus, syllabusBasis, answerMarkdownSinhala, keyPoints, confidence.
`;

  for (const task of ["direct_pdf_solve", "final_answer"] as const) {
    try {
      const { result } = await callGeminiWithFallback(task, {
        model: "ignored",
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 5_000,
        },
      } as any);
      if (!result.text) continue;
      const parsed = parseJsonResponse(result.text);
      const normalized = normalizeEssayResult(parsed);
      if (normalized) return normalized;
    } catch (error) {
      console.error(`[AI_CORE] Essay solver ${task} failed:`, error);
    }
  }
  return null;
}
