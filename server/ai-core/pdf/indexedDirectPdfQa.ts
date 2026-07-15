import { getAdminDb } from "../../firebase/admin";
import { getAIClient, AI_MODELS } from "../../ai/client";
import { removeUndefinedDeep } from "../memory/chatSanitizer";
import { solveExtractedMcqQuestion } from "./solveExtractedQuestion";

type IndexedChunk = {
  id: string;
  text: string;
  pageNumber?: number;
  chunkIndex?: number;
  questionNo?: string | number;
};

function cleanJson(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function requestedNumber(value: unknown) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

function chunkContainsQuestion(chunk: IndexedChunk, questionNo: string) {
  const number = requestedNumber(questionNo);
  if (!number) return false;
  if (requestedNumber(chunk.questionNo) === number) return true;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const text = String(chunk.text || "");
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*(?:mcq\\s*)?(?:q(?:uestion)?\\s*)?0*${escaped}\\s*[.\\):\\-]`, "im"),
    new RegExp(`\\(\\s*0*${escaped}\\s*\\)`, "m"),
    new RegExp(`(?:ප්‍රශ්නය|ප්රශ්නය)\\s*0*${escaped}(?:\\s|$)`, "m"),
    new RegExp(`0*${escaped}\\s*(?:වන|වෙනි)(?:\\s|$)`, "m"),
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export function selectIndexedQuestionChunks(chunks: IndexedChunk[], questionNo: string) {
  const sorted = [...chunks].sort((a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0));
  const matches = sorted
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => chunkContainsQuestion(chunk, questionNo));

  const selectedIndexes = new Set<number>();
  for (const { index } of matches) {
    for (let offset = -1; offset <= 2; offset += 1) {
      if (sorted[index + offset]) selectedIndexes.add(index + offset);
    }
  }

  // Some scanned papers omit a visible "Q1" marker in their first text
  // block. The opening chunks are still the safest bounded context for Q1.
  if (selectedIndexes.size === 0 && requestedNumber(questionNo) === "1") {
    sorted.slice(0, 8).forEach((_chunk, index) => selectedIndexes.add(index));
  }

  return [...selectedIndexes]
    .sort((a, b) => a - b)
    .map((index) => sorted[index])
    .filter(Boolean)
    .slice(0, 12);
}

function resultFromCache(cache: any) {
  if (!cache?.questionText) return null;
  return {
    ok: true,
    found: true,
    cached: true,
    model: "indexed-cache",
    sourceEvidence: {
      sourceId: cache.sourceId,
      pageNumber: cache.pageNumber ?? null,
      questionNo: cache.questionNo,
      questionText: cache.questionText,
      options: Array.isArray(cache.options) ? cache.options : null,
    },
    answer: {
      officialAnswer: cache.officialAnswer || null,
      estimatedAnswer: cache.estimatedAnswer || null,
      solvedAnswer: cache.solvedAnswer || null,
      explanationSinhala: cache.explanationSinhala || cache.solvedAnswer?.explanationSinhala || null,
      lesson: cache.lesson || null,
    },
    confidence: Number(cache.confidence || 1),
    extractionMethod: cache.extractionMethod || "indexed-cache",
  };
}

export async function answerStructuredFromIndexedPdf(params: {
  uid: string;
  sourceId: string;
  year: string;
  subject: string;
  questionType: string;
  questionNo: string;
  allowOfficialAnswer?: boolean;
}) {
  const { sourceId, year, subject, questionType, questionNo, allowOfficialAnswer = false } = params;
  if (!sourceId) return null;

  const db = getAdminDb();
  const cacheId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
  const cached = await db.collection("pdf_question_cache").doc(cacheId).get();
  if (cached.exists) {
    const result = resultFromCache(cached.data());
    if (result) return result;
  }

  const snapshot = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
  const chunks: IndexedChunk[] = snapshot.docs.map((document: any) => ({
    id: document.id,
    ...document.data(),
    text: String(document.data()?.text || ""),
  }));
  const selected = selectIndexedQuestionChunks(chunks, questionNo);
  if (selected.length === 0) return null;

  const context = selected
    .map((chunk) => `[Page ${chunk.pageNumber || "?"}]\n${chunk.text}`)
    .join("\n\n---\n\n")
    .slice(0, 42_000);
  if (context.replace(/\s/g, "").length < 80) return null;

  const ai = getAIClient();
  const modelRequest = ai.models.generateContent({
    model: AI_MODELS.pdf,
    contents: `INDEXED PDF TEXT:\n${context}\n\nExtract ${questionType} ${questionNo} exactly.`,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      systemInstruction: `You extract one exact Sri Lankan A/L question from indexed PDF text.
Return JSON only with: found, pageNumber, questionText, options, officialAnswer, explanationSinhala, confidence, reason.
Never invent missing question text or options. For MCQ, found can be true only when the question and at least four options are present.
${allowOfficialAnswer ? "Copy officialAnswer only when it is explicitly printed in the context." : "Always return officialAnswer as null."}`,
    },
  });

  let response: any;
  try {
    response = await Promise.race([
      modelRequest,
      new Promise((_resolve, reject) => setTimeout(() => reject(Object.assign(new Error("Indexed PDF answer timed out."), { code: "INDEXED_QA_TIMEOUT" })), 45_000)),
    ]);
  } catch (error: any) {
    if (error?.code === "INDEXED_QA_TIMEOUT") return null;
    throw error;
  }

  const extracted = JSON.parse(cleanJson(String(response?.text || "{}")));
  const options = Array.isArray(extracted.options) ? extracted.options.filter(Boolean).map(String) : [];
  const questionText = String(extracted.questionText || "").trim();
  const found = extracted.found === true
    && questionText.length >= 12
    && (String(questionType).toUpperCase() !== "MCQ" || options.length >= 4);
  if (!found) return null;

  let solvedAnswer = null;
  if (String(questionType).toUpperCase() === "MCQ" && options.length >= 4 && !extracted.officialAnswer) {
    solvedAnswer = await solveExtractedMcqQuestion({ questionText, options, subject, year, questionNo });
  }

  const cacheData = removeUndefinedDeep({
    sourceId,
    subject,
    year,
    questionType,
    questionNo,
    pageNumber: extracted.pageNumber ?? selected[0]?.pageNumber ?? null,
    questionText,
    options,
    officialAnswer: allowOfficialAnswer ? extracted.officialAnswer || null : null,
    solvedAnswer,
    explanationSinhala: extracted.explanationSinhala || solvedAnswer?.explanationSinhala || null,
    confidence: Number(extracted.confidence || 0.8),
    extractionMethod: "indexed_pdf_text",
    validationStatus: "valid",
    updatedAt: new Date().toISOString(),
  });
  await db.collection("pdf_question_cache").doc(cacheId).set(cacheData, { merge: true });

  return resultFromCache(cacheData);
}
