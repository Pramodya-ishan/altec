import { AI_MODELS } from "../../ai/client";
import { callGeminiWithFallback } from "../../ai/modelRouter";
import { stripRawVisualBlocks } from "../answer/stripVisualBlocks";
import { removeUndefinedDeep } from "../memory/chatSanitizer";
import { getAdminDb } from "../../firebase/admin";
import { solveExtractedMcqQuestion } from "./solveExtractedQuestion";
import { trackAIUsage, checkSpecificLimit } from "../../cost/usageTracker";
import { classifyAiError } from "../../ai/aiErrorClassifier";

export async function askGeminiDirectPdfStructured(params: {
  uid: string;
  sourceId: string;
  pdfBuffer: Buffer;
  year: string;
  subject: string;
  questionType: string;
  questionNo: string;
  prompt: string;
  allowOfficialAnswer?: boolean;
}) {
  const { sourceId, pdfBuffer, year, subject, questionType, questionNo, allowOfficialAnswer = false } = params;
  const modelName = AI_MODELS.pdf;

  const systemInstruction = `You are an evidence-first Sri Lankan A/L exam PDF extractor.
You are reading the exact locked PDF source.

Requested:
Year: ${year}
Subject: ${subject}
Question Type: ${questionType}
Question Number: ${questionNo}

STRICT RULES:
1. First find the exact requested question in the PDF.
2. Extract exact question text as written in the PDF.
3. If MCQ, extract all options exactly.
4. Only if exact questionText is extracted, solve/explain.
5. If exact question is not visible, return found:false.
6. Do NOT guess the question or the answer.
7. ${allowOfficialAnswer
  ? "Only copy officialAnswer when it is explicitly printed in this marking-scheme source."
  : "This source is not a verified marking scheme. Always return officialAnswer:null; any solution must be generated later as clearly labelled reasoning."}
8. Do NOT create a similar or model question.
9. Do NOT answer from syllabus or general memory.
10. Do NOT fill answer.estimatedAnswer unless questionText exists.

Return JSON only:
{
  "found": boolean,
  "sourceEvidence": {
    "sourceId": "${sourceId}",
    "pageNumber": number|null,
    "questionNo": "${questionNo}",
    "questionText": string|null,
    "options": string[]|null
  },
  "answer": {
    "officialAnswer": string|null,
    "estimatedAnswer": null,
    "explanationSinhala": string|null,
    "lesson": string|null
  },
  "confidence": number,
  "reason": string
}`;

  const pdfPart = {
    inlineData: {
      mimeType: "application/pdf",
      data: pdfBuffer.toString("base64"),
    },
  };

  const userPrompt = `
Requested:
Year: ${year}
Subject: ${subject}
Question Type: ${questionType}
Question Number: ${questionNo}
Source ID: ${sourceId}

Return JSON with exact evidence. If not found, set found:false.
`;

  // [PHASE 1] Track Direct PDF QA Call
  // Note: We don't have uid here easily, we might need to pass it from routes
  // For now, I'll update the params to include uid
  const uid = (params as any).uid || "anonymous";

  try {
    const { result: response } = await callGeminiWithFallback("direct_pdf_extract", {
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [pdfPart as any, { text: userPrompt }]
        }
      ],
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: "application/json"
      },
    });

    if (!response.text) {
       throw new Error("Empty response from Gemini API");
    }

    let result = JSON.parse(response.text.trim());

    // A question paper is evidence for the question, not for an official answer.
    // Never let the model upgrade its own reasoning to an official marking-scheme
    // answer unless the server verified the source type before the model call.
    if (!allowOfficialAnswer && result?.answer) {
      result.answer.officialAnswer = null;
    }
    
    // Sanitize explanation
    if (result.answer?.explanationSinhala) {
      result.answer.explanationSinhala = stripRawVisualBlocks(result.answer.explanationSinhala);
    }
    
    // [FIX 4/7] Direct PDF QA Validation
    const qText = result?.sourceEvidence?.questionText;
    const opts = result?.sourceEvidence?.options;

    if (!result.found || !qText || qText.length < 20) {
      console.log(`[DirectPDFQA] Extraction failed validation: found=${result.found}, textLength=${qText?.length || 0}`);
      result = {
        ...result,
        found: false,
        reason: result.reason || "EXACT_QUESTION_TEXT_MISSING",
        answer: {
          officialAnswer: null,
          estimatedAnswer: null,
          explanationSinhala: null,
          lesson: null
        },
        confidence: 0
      };
    }

    if (questionType === "MCQ" && (!Array.isArray(opts) || opts.length < 4)) {
      console.log(`[DirectPDFQA] MCQ validation failed: optionsCount=${opts?.length || 0}`);
      result = {
        ...result,
        found: false,
        reason: "MCQ_OPTIONS_MISSING"
      };
    }

    // [PHASE 1] Solver Pass
    if (
      result.found === true &&
      result.sourceEvidence?.questionText &&
      Array.isArray(result.sourceEvidence.options) &&
      result.sourceEvidence.options.length >= 4 &&
      !result.answer?.solvedAnswer &&
      !result.answer?.officialAnswer
    ) {
      console.log(`[DirectPDFQA] Triggering solver pass for ${questionType} ${questionNo}`);
      try {
        const solved = await solveExtractedMcqQuestion({
          questionText: result.sourceEvidence.questionText,
          options: result.sourceEvidence.options,
          subject,
          year,
          questionNo
        });
        if (solved) {
          // [PHASE 1] Track Solver Call
          await trackAIUsage(uid, AI_MODELS.pdf, 500, 500, "solverCalls");

          result.answer = {
            ...result.answer,
            solvedAnswer: solved
          };
          if (!result.answer.explanationSinhala && solved.explanationSinhala) {
             result.answer.explanationSinhala = solved.explanationSinhala;
          }
        }
      } catch (solveErr) {
        console.error("[DirectPDFQA] Solver pass failed:", solveErr);
      }
    }

    // Save to cache if found
    if (result.found && result.sourceEvidence?.questionText) {
       const db = getAdminDb();
       const cacheId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
       
       const cacheData = {
         sourceId,
         subject,
         year,
         questionType,
         questionNo,
         ...result.sourceEvidence,
         ...result.answer,
         confidence: result.confidence,
         extractionMethod: "gemini_direct_pdf_qa",
         validationStatus: result.confidence > 0.8 ? "valid" : "needs_review",
         updatedAt: new Date().toISOString()
       };

       try {
         const { removeUndefinedDeep } = await import("../memory/chatSanitizer");
         await db.collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep(cacheData), { merge: true });
         console.log(`[AI_CORE] Saved structured cache for ${cacheId}`);
       } catch (cacheErr) {
         console.error("[AI_CORE] Failed to save PDF question cache:", cacheErr);
       }
    }

    return { ok: true, ...result };
  } catch (err: any) {
    console.error("[AI_CORE] Direct PDF QA JSON extraction failed:", err);

    const classified = err?.code === "AI_BILLING_EXHAUSTED"
      ? { code: "AI_BILLING_EXHAUSTED" }
      : classifyAiError(err);

    if (classified.code === "AI_BILLING_EXHAUSTED") {
      return {
        ok: false,
        found: false,
        errorCode: "AI_BILLING_EXHAUSTED",
        stage: "MODEL_CALL",
        reason: "AI billing exhausted. PDF was not fully analyzed by Gemini.",
        message: "AI credits අවසන් නිසා PDF scan/answer generation complete වුණේ නැහැ.",
        canRetry: false
      };
    }

    const isRequireErr = String(err?.message || err).includes("require is not defined");

    return { 
      ok: false, 
      found: false, 
      errorCode: isRequireErr ? "AI_CLIENT_RUNTIME_ERROR" : "GEMINI_DIRECT_PDF_QA_FAILED",
      stage: "MODEL_CALL",
      reason: isRequireErr ? "AI client runtime error" : "Gemini Direct PDF QA failed before verified extraction.",
      error: String(err?.message || err).slice(0, 500)
    };
  } finally {
    // Track Direct PDF QA usage
    await trackAIUsage(uid, modelName, 1000, 500, "directPdfQaCalls");
  }
}

/**
 * Answers from the text index instead of uploading the complete PDF to Gemini.
 * Persistent lesson/past-paper sources always take this path.  It is faster,
 * avoids serverless timeouts, and keeps the answer tied to stored evidence.
 */
export async function askIndexedPdfQuestionStructured(params: {
  uid: string;
  sourceId: string;
  chunks: Array<{ text?: string; pageNumber?: number; chunkIndex?: number }>;
  year: string;
  subject: string;
  questionType: string;
  questionNo: string;
  allowOfficialAnswer?: boolean;
}) {
  const {
    uid,
    sourceId,
    chunks,
    year,
    subject,
    questionType,
    questionNo,
    allowOfficialAnswer = false,
  } = params;

  const ordered = [...chunks]
    .sort((a, b) => Number(a.pageNumber || a.chunkIndex || 0) - Number(b.pageNumber || b.chunkIndex || 0))
    .map((chunk) => `[Page ${chunk.pageNumber || "?"}]\n${String(chunk.text || "").trim()}`)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 70_000);

  if (ordered.replace(/\s/g, "").length < 80) {
    return {
      ok: false,
      found: false,
      errorCode: "PDF_REINDEX_REQUIRED",
      stage: "INDEX_LOOKUP",
      reason: "The indexed PDF text is empty or incomplete.",
    };
  }

  const systemInstruction = `You extract one exact Sri Lankan A/L exam question from INDEXED PDF TEXT.
Requested: ${year} ${subject} ${questionType} ${questionNo}.
Rules:
- Use only the supplied indexed text. Never invent a question, option, answer, page, or source detail.
- Match question markers such as 01., 1., Q1, Question 1, or Sinhala question numbering.
- Extract the complete question and, for MCQ, all printed options.
- If the exact question is absent or unreadable return found:false.
- ${allowOfficialAnswer ? "Copy an official answer only when it is explicitly printed in this verified marking-scheme text." : "Always set officialAnswer:null. This is not a verified marking scheme."}
- Return JSON only.`;

  try {
    const { result: response } = await callGeminiWithFallback("direct_pdf_extract", {
      model: AI_MODELS.pdf,
      contents: [{
        role: "user",
        parts: [{
          text: `${systemInstruction}\n\nINDEXED PDF TEXT:\n${ordered}\n\nReturn {"found":boolean,"sourceEvidence":{"sourceId":"${sourceId}","pageNumber":number|null,"questionNo":"${questionNo}","questionText":string|null,"options":string[]|null},"answer":{"officialAnswer":string|null,"explanationSinhala":string|null,"lesson":string|null},"confidence":number,"reason":string}.`,
        }],
      }],
      config: { temperature: 0, responseMimeType: "application/json" },
    });

    const result = JSON.parse(String(response.text || "{}").trim());
    const questionText = String(result?.sourceEvidence?.questionText || "").trim();
    const options = Array.isArray(result?.sourceEvidence?.options)
      ? result.sourceEvidence.options.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];
    const isMcq = String(questionType).toLowerCase().includes("mcq");

    if (!result?.found || questionText.length < 12 || (isMcq && options.length < 4)) {
      return {
        ok: false,
        found: false,
        errorCode: "EXACT_QUESTION_EVIDENCE_MISSING",
        stage: "INDEX_LOOKUP",
        reason: "The exact question is not readable in the indexed PDF text.",
      };
    }

    if (!allowOfficialAnswer && result.answer) result.answer.officialAnswer = null;
    if (!result.answer) result.answer = { officialAnswer: null };

    if (isMcq && !result.answer.officialAnswer) {
      const solved = await solveExtractedMcqQuestion({
        questionText,
        options,
        subject,
        year,
        questionNo,
      }).catch(() => null);
      if (solved) result.answer.solvedAnswer = solved;
    }

    const cacheId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
    await getAdminDb().collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep({
      sourceId,
      subject,
      year,
      questionType,
      questionNo,
      ...result.sourceEvidence,
      ...result.answer,
      confidence: Number(result.confidence || 0),
      extractionMethod: "indexed_pdf_text",
      validationStatus: Number(result.confidence || 0) >= 0.8 ? "valid" : "needs_review",
      updatedAt: new Date().toISOString(),
    }), { merge: true });

    await trackAIUsage(uid, AI_MODELS.pdf, Math.ceil(ordered.length / 4), 500, "directPdfQaCalls");
    return { ok: true, ...result };
  } catch (error: any) {
    const classified = classifyAiError(error);
    return {
      ok: false,
      found: false,
      errorCode: classified.code || "INDEXED_PDF_QA_FAILED",
      stage: "MODEL_CALL",
      reason: String(error?.message || error).slice(0, 400),
    };
  }
}
