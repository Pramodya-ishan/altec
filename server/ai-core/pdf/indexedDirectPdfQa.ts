import { getAdminDb } from "../../firebase/admin";
import { getAIClient, AI_MODELS } from "../../ai/client";
import { removeUndefinedDeep } from "../memory/chatSanitizer";
import { solveExtractedEssayQuestion, solveExtractedMcqQuestion } from "./solveExtractedQuestion";

import { selectIndexedQuestionChunks, type IndexedQuestionChunk } from "./indexedQuestionSelection";

type IndexedChunk = IndexedQuestionChunk;

function cleanJson(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
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
    completed: cache.completed !== false && cache.solvedAnswer?.complete !== false,
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
  const { uid, sourceId, year, subject, questionType, questionNo, allowOfficialAnswer = false } = params;
  if (!sourceId) return null;

  const db = getAdminDb();
  const cacheId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
  const cached = await db.collection("pdf_question_cache").doc(cacheId).get();
  const cachedData = cached.exists ? cached.data() : null;
  if (cachedData
    && cachedData.rejected !== true
    && String(cachedData.validationStatus || "").toLowerCase() !== "rejected"
    && Number(cachedData.evidenceVersion || 0) >= 3) {
    const result = resultFromCache(cachedData);
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

  let solvedAnswer: any = null;
  const normalizedType = String(questionType).toUpperCase();
  if (normalizedType === "MCQ" && options.length >= 4 && !extracted.officialAnswer) {
    solvedAnswer = await solveExtractedMcqQuestion({ uid, sourceId, questionText, options, subject, year, questionNo });
  } else if (["ESSAY", "STRUCTURED", "STRUCTURED ESSAY"].includes(normalizedType) && !extracted.officialAnswer) {
    solvedAnswer = await solveExtractedEssayQuestion({ uid, sourceId, questionText, subject, year, questionNo, questionType: normalizedType });
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
    completed: solvedAnswer?.complete !== false,
    explanationSinhala: extracted.explanationSinhala || solvedAnswer?.explanationSinhala || null,
    confidence: Number(extracted.confidence || 0.8),
    extractionMethod: "indexed_pdf_text",
    validationStatus: "valid",
    evidenceVersion: 3,
    updatedAt: new Date().toISOString(),
  });
  await db.collection("pdf_question_cache").doc(cacheId).set(cacheData, { merge: true });

  return resultFromCache(cacheData);
}
