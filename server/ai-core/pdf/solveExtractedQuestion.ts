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

async function collectSyllabusContext(
  params: SolveMcqParams,
  options: { includeHeavyPdfGrounding?: boolean } = {},
): Promise<SyllabusContext> {
  if (!params.uid) return { text: "", pdfPart: null, referenceParts: [], referenceSources: [] };

  const query = `${params.questionText}\n${params.options.join("\n")}`;
  const fastMode = String(process.env.PDF_FAST_ANSWER_MODE || "true").toLowerCase() !== "false";
  const lessonLimit = fastMode ? 8 : 16;
  const generalLimit = fastMode ? 6 : 12;
  const [lessonRetrieval, generalRetrieval] = await Promise.all([
    retrieveRelevantKnowledge({
      uid: params.uid,
      query,
      subject: params.subject,
      limit: lessonLimit,
      strictLesson: true,
    }).catch(() => ({ chunks: [], sources: [] } as any)),
    retrieveRelevantKnowledge({
      uid: params.uid,
      query,
      subject: params.subject,
      limit: generalLimit,
    }).catch(() => ({ chunks: [], sources: [] } as any)),
  ]);

  const lessonChunks = Array.isArray((lessonRetrieval as any)?.chunks) ? (lessonRetrieval as any).chunks : [];
  const generalChunks = Array.isArray((generalRetrieval as any)?.chunks) ? (generalRetrieval as any).chunks : [];
  const approvedIdentity = /lesson|syllabus|resource|reference|textbook|book|owner_syllabus|syllabus_resources/i;
  const rejectedIdentity = /past[ -]?paper|model[ -]?paper|guess(?:ing)?|marking[ -]?scheme|question[ -]?paper/i;
  const seen = new Set<string>();
  const approvedChunks = [...lessonChunks, ...generalChunks]
    .filter((chunk: any) => {
      const identity = `${chunk?.sourceType || ""} ${chunk?.title || ""} ${chunk?.sourceScope || ""}`;
      const sameQuestionSource = params.sourceId && String(chunk?.sourceId || "") === String(params.sourceId);
      if (sameQuestionSource || rejectedIdentity.test(identity)) return false;
      return lessonChunks.includes(chunk) || approvedIdentity.test(identity);
    })
    .filter((chunk: any) => {
      const key = `${chunk?.sourceId || ""}:${chunk?.id || ""}:${String(chunk?.text || "").slice(0, 120)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(String(chunk?.text || "").trim());
    })
    .slice(0, fastMode ? 8 : 12);

  const syllabusChunks = approvedChunks
    .map((chunk: any, index: number) => {
      const priority = lessonChunks.includes(chunk) ? "Lesson resource" : "Approved syllabus resource";
      const label = [chunk?.title, chunk?.lesson].filter(Boolean).join(" · ");
      return `[${priority} ${index + 1}${label ? `: ${label}` : ""}]\n${String(chunk?.text || "").slice(0, fastMode ? 2_500 : 4_000)}`;
    })
    .join("\n\n")
    .slice(0, fastMode ? 18_000 : 32_000);

  let pdfPart: any = null;
  let reference: any = { parts: [], sources: [], domains: [] };
  if (options.includeHeavyPdfGrounding) {
    const [syllabusPdf, loadedReference] = await Promise.all([
      getSubjectSyllabusGroundingPdf(params.uid, params.subject).catch(() => null),
      String(params.subject || "").toUpperCase() === "SFT"
        ? getSftReferenceGroundingParts(query).catch(() => ({ parts: [], sources: [], domains: [] }))
        : Promise.resolve({ parts: [], sources: [], domains: [] }),
    ]);
    if (syllabusPdf?.gcsUri) {
      pdfPart = { fileData: { fileUri: syllabusPdf.gcsUri, mimeType: "application/pdf" } };
    } else if (syllabusPdf?.buffer?.length) {
      pdfPart = { inlineData: { mimeType: "application/pdf", data: syllabusPdf.buffer.toString("base64") } };
    }
    reference = loadedReference;
  }

  return {
    text: syllabusChunks,
    pdfPart,
    referenceParts: reference.parts,
    referenceSources: [
      ...((lessonRetrieval as any)?.sources || []),
      ...((generalRetrieval as any)?.sources || []),
      ...(reference.sources || []),
    ],
  };
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
  
  const syllabusContext = await collectSyllabusContext(params, { includeHeavyPdfGrounding: false });

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
- Evidence priority is: matching Lesson Resources first, official subject syllabus second, approved subject reference books third.
- The selected paper is authoritative only for the exact question wording, not for adding answer theory.
- Do not introduce කෝක් කැම්බියම, කෝක් සෛල, පරිචර්මය, phellogen, phellem, phelloderm, or periderm unless that exact term appears in the verified question or supplied approved SFT evidence.
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

  const buildParts = (context: SyllabusContext) => {
    const parts: any[] = [];
    if (context.pdfPart) parts.push(context.pdfPart);
    if (Array.isArray(context.referenceParts)) parts.push(...context.referenceParts);
    parts.push({
      text: `${userPrompt}\n\nSUPPORTING SYLLABUS TEXT:\n${context.text || "No indexed excerpt was available. Use the attached authoritative syllabus PDF. Do not expand beyond its scope."}`,
    });
    return parts;
  };

  // First pass: small text-only context on the fast PDF solver model.
  // Skip it when retrieval found no syllabus evidence; otherwise the app would
  // spend one model call only to discover that the authoritative PDF fallback
  // is required.
  if (syllabusContext.text) try {
    const { result: response } = await callGeminiWithFallback("direct_pdf_solve", {
      model: "ignored",
      contents: [{ role: "user", parts: buildParts(syllabusContext) }],
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
      },
    } as any);

    if (response.text) {
      const parsed = parseJsonResponse(response.text);
      const normalized = normalizeSolvedResult(parsed, normalizedOptions);
      if (normalized) return normalized;
    }
  } catch (err) {
    console.error("[AI_CORE] MCQ fast solver failed:", err);
  }

  // Slow fallback: attach authoritative PDFs only after the small fast pass
  // failed. This removes repeated multi-megabyte PDF grounding from the common
  // path while preserving the strict syllabus fallback.
  const fullContext = await collectSyllabusContext(params, { includeHeavyPdfGrounding: true });
  for (const task of ["final_answer"] as const) {
    try {
      const { result: response } = await callGeminiWithFallback(task, {
        model: "ignored",
        contents: [{ role: "user", parts: buildParts(fullContext) }],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
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
  complete: boolean;
  answeredSubparts: string[];
  missingSubparts: string[];
}

export function extractQuestionSubparts(questionText: string): string[] {
  const labels: string[] = [];
  let section = "";
  for (const rawLine of String(questionText || "").split(/\r?\n/gu)) {
    const line = rawLine.trim();
    const sectionMatch = line.match(/(?:^|\s)\(([A-Z])\)/u);
    if (sectionMatch) section = sectionMatch[1];
    const matches = line.matchAll(/\((i{1,3}|iv|v|vi{0,3}|ix|x|[a-h])\)/gu);
    for (const match of matches) {
      const key = section ? `${section}.${match[1]}` : match[1];
      if (!labels.includes(key)) labels.push(key);
    }
  }
  return labels;
}

function normalizeSubpartLabel(value: unknown): string {
  return String(value || "").trim().replace(/[()\s]/gu, "").replace(/:/gu, ".");
}

function normalizeEssayResult(value: any, expectedSubparts: string[]): SolvedEssayResult | null {
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
      complete: true,
      answeredSubparts: [],
      missingSubparts: [],
    };
  }
  if (answerMarkdownSinhala.length < 40) return null;
  const keyPoints = Array.isArray(value?.keyPoints)
    ? value.keyPoints.map((item: unknown) => normalizeSinhalaUnicode(item).trim()).filter(Boolean).slice(0, 12)
    : [];
  const declared = Array.isArray(value?.answeredSubparts)
    ? value.answeredSubparts.map(normalizeSubpartLabel).filter(Boolean)
    : [];
  const inferred = extractQuestionSubparts(answerMarkdownSinhala).map(normalizeSubpartLabel);
  const answeredSubparts = Array.from(new Set([...declared, ...inferred]));
  const missingSubparts = expectedSubparts
    .map(normalizeSubpartLabel)
    .filter((label) => !answeredSubparts.includes(label));
  const complete = expectedSubparts.length === 0
    ? value?.complete !== false
    : missingSubparts.length === 0;
  return {
    answerMarkdownSinhala,
    keyPoints,
    confidence: Math.max(0, Math.min(1, Number(value?.confidence) || 0.7)),
    answerStatus: "ai_solved_from_verified_question_and_syllabus",
    scopeStatus,
    syllabusBasis,
    complete,
    answeredSubparts,
    missingSubparts,
  };
}

export async function solveExtractedEssayQuestion(params: SolveEssayParams): Promise<SolvedEssayResult | null> {
  if (!params.questionText || params.questionText.trim().length < 20) return null;
  const syllabusContext = await collectSyllabusContext({ ...params, options: [] }, { includeHeavyPdfGrounding: false });
  const expectedSubparts = extractQuestionSubparts(params.questionText);
  const buildEssayParts = (context: SyllabusContext) => {
    const parts: any[] = [];
    if (context.pdfPart) parts.push(context.pdfPart);
    if (Array.isArray(context.referenceParts)) parts.push(...context.referenceParts);
    parts.push({
      text: `VERIFIED QUESTION FROM THE SELECTED PDF:
${params.questionText}

EXPECTED SUBPARTS: ${expectedSubparts.length > 0 ? expectedSubparts.join(", ") : "No explicit subpart labels detected"}

` +
      `INDEXED APPROVED SFT EVIDENCE:
${context.text || "No indexed excerpt was available; use only the attached official syllabus and SFT reference PDF."}`,
    });
    return parts;
  };

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
- Return JSON only with: inSyllabus, syllabusBasis, answerMarkdownSinhala, keyPoints, answeredSubparts, missingSubparts, complete, confidence.
- answeredSubparts must use section-qualified labels exactly, for example A.i, A.ii, B.i.
- complete may be true only when every readable label in EXPECTED SUBPARTS is answered.
- For SFT, do not introduce කෝක් කැම්බියම, කෝක් සෛල, පරිචර්මය, phellogen, phellem, phelloderm, or periderm unless that exact term appears in the verified question or supplied approved SFT evidence.
`;

  let incompleteResult: SolvedEssayResult | null = null;
  if (syllabusContext.text) try {
    const { result } = await callGeminiWithFallback("direct_pdf_solve", {
      model: "ignored",
      contents: [{ role: "user", parts: buildEssayParts(syllabusContext) }],
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
      },
    } as any);
    if (result.text) {
      const parsed = parseJsonResponse(result.text);
      const normalized = normalizeEssayResult(parsed, expectedSubparts);
      if (normalized) {
        if (normalized.scopeStatus !== "in_syllabus" || normalized.complete) return normalized;
        incompleteResult = normalized;
      }
    }
  } catch (error) {
    console.error("[AI_CORE] Essay fast solver failed:", error);
  }

  const fullContext = await collectSyllabusContext({ ...params, options: [] }, { includeHeavyPdfGrounding: true });
  for (const task of ["final_answer"] as const) {
    try {
      const retryInstruction = incompleteResult
        ? `\n\nPREVIOUS ANSWER WAS INCOMPLETE. Missing labels: ${incompleteResult.missingSubparts.join(", ")}. Return one complete replacement answer, not a continuation fragment. Previous answer:\n${incompleteResult.answerMarkdownSinhala}`
        : "";
      const baseParts = buildEssayParts(fullContext);
      const requestParts = retryInstruction ? [...baseParts, { text: retryInstruction }] : baseParts;
      const { result } = await callGeminiWithFallback(task, {
        model: "ignored",
        contents: [{ role: "user", parts: requestParts }],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          },
      } as any);
      if (!result.text) continue;
      const parsed = parseJsonResponse(result.text);
      const normalized = normalizeEssayResult(parsed, expectedSubparts);
      if (!normalized) continue;
      if (normalized.scopeStatus !== "in_syllabus" || normalized.complete) return normalized;
      incompleteResult = normalized;
    } catch (error) {
      console.error(`[AI_CORE] Essay solver ${task} failed:`, error);
    }
  }
  if (incompleteResult) {
    return {
      ...incompleteResult,
      answerMarkdownSinhala: `${incompleteResult.answerMarkdownSinhala}\n\n> නොසම්පූර්ණව කියවුණු කොටස්: ${incompleteResult.missingSubparts.join(", ")}. මෙම කොටස් අනුමාන කර පුරවා නැහැ.`,
      complete: false,
    };
  }
  return null;
}
