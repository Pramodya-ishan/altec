import { AI_MODELS } from "../../ai/client";
import { callGeminiWithFallback } from "../../ai/modelRouter";
import { stripRawVisualBlocks } from "../answer/stripVisualBlocks";
import { removeUndefinedDeep } from "../memory/chatSanitizer";
import { getAdminDb } from "../../firebase/admin";
import { solveExtractedMcqQuestion } from "./solveExtractedQuestion";
import { trackAIUsage, checkSpecificLimit } from "../../cost/usageTracker";
import { classifyAiError } from "../../ai/aiErrorClassifier";
import { cleanAssistantResponse, normalizeSinhalaUnicode } from "../../../shared/text/assistantText";
import { extractQuestionFromFullPaper } from "./questionExtractor";

const EVIDENCE_VERSION = 4;

function looksLikeLegacySinhalaGarbage(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return false;
  const sinhala = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
  const legacySignals = (text.match(/[ñú;=<>]|\b(?:fuu|iy|iys|l=|fkdie|mß|wd;;|T[123])\b/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return sinhala === 0 && legacySignals >= 2 && latin / Math.max(1, text.length) > 0.18;
}

function extractLeadingQuestionNumber(value: unknown): string | null {
  const text = normalizeSinhalaUnicode(value).trim();
  const match = text.match(/^(?:#{1,6}\s*)?(?:question|q)?\s*0*(\d{1,3})\s*(?:[.)\]:-]|$)/i);
  return match?.[1] ? String(Number(match[1])) : null;
}

function isQuestionNumberMismatch(questionText: unknown, requestedQuestionNo: unknown) {
  const extracted = extractLeadingQuestionNumber(questionText);
  const requestedMatch = String(requestedQuestionNo || "").match(/\d{1,3}/);
  const requested = requestedMatch?.[0] ? String(Number(requestedMatch[0])) : null;
  return Boolean(extracted && requested && extracted !== requested);
}

function sanitizeDirectQaResult(input: any) {
  if (!input || typeof input !== "object") return input;
  const result = { ...input };
  if (result.sourceEvidence && typeof result.sourceEvidence === "object") {
    result.sourceEvidence = {
      ...result.sourceEvidence,
      questionText: result.sourceEvidence.questionText
        ? normalizeSinhalaUnicode(result.sourceEvidence.questionText).trim()
        : result.sourceEvidence.questionText,
      options: Array.isArray(result.sourceEvidence.options)
        ? result.sourceEvidence.options.map((value: unknown) => normalizeSinhalaUnicode(value).trim()).filter(Boolean)
        : result.sourceEvidence.options,
    };
  }
  if (result.answer && typeof result.answer === "object") {
    const solved = result.answer.solvedAnswer && typeof result.answer.solvedAnswer === "object"
      ? {
          ...result.answer.solvedAnswer,
          optionText: result.answer.solvedAnswer.optionText
            ? normalizeSinhalaUnicode(result.answer.solvedAnswer.optionText).trim()
            : result.answer.solvedAnswer.optionText,
          explanationSinhala: result.answer.solvedAnswer.explanationSinhala
            ? cleanAssistantResponse(result.answer.solvedAnswer.explanationSinhala)
            : result.answer.solvedAnswer.explanationSinhala,
          whyOthersWrong: Array.isArray(result.answer.solvedAnswer.whyOthersWrong)
            ? result.answer.solvedAnswer.whyOthersWrong.map((value: unknown) => cleanAssistantResponse(value)).filter(Boolean)
            : result.answer.solvedAnswer.whyOthersWrong,
          questionUnicode: result.answer.solvedAnswer.questionUnicode
            ? normalizeSinhalaUnicode(result.answer.solvedAnswer.questionUnicode).trim()
            : result.answer.solvedAnswer.questionUnicode,
          optionsUnicode: Array.isArray(result.answer.solvedAnswer.optionsUnicode)
            ? result.answer.solvedAnswer.optionsUnicode.map((value: unknown) => normalizeSinhalaUnicode(value).trim()).filter(Boolean)
            : result.answer.solvedAnswer.optionsUnicode,
        }
      : result.answer.solvedAnswer;
    result.answer = {
      ...result.answer,
      officialAnswer: result.answer.officialAnswer ? cleanAssistantResponse(result.answer.officialAnswer) : result.answer.officialAnswer,
      estimatedAnswer: result.answer.estimatedAnswer ? cleanAssistantResponse(result.answer.estimatedAnswer) : result.answer.estimatedAnswer,
      explanationSinhala: result.answer.explanationSinhala ? cleanAssistantResponse(result.answer.explanationSinhala) : result.answer.explanationSinhala,
      lesson: result.answer.lesson ? normalizeSinhalaUnicode(result.answer.lesson).trim() : result.answer.lesson,
      solvedAnswer: solved,
    };
  }
  return result;
}

function directQaCacheId(sourceId: string, questionType: string, questionNo: string) {
  return `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");
}

async function readVerifiedQuestionCache(params: {
  sourceId: string;
  subject: string;
  year: string;
  questionType: string;
  questionNo: string;
  allowOfficialAnswer: boolean;
  requiresSyllabusGrounding: boolean;
}) {
  try {
    const snapshot = await getAdminDb()
      .collection("pdf_question_cache")
      .doc(directQaCacheId(params.sourceId, params.questionType, params.questionNo))
      .get();
    if (!snapshot.exists) return null;

    const cached = snapshot.data() || {};
    const questionText = String(cached.questionText || "").trim();
    const options = Array.isArray(cached.options)
      ? cached.options.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];
    const isMcq = String(params.questionType).toLowerCase().includes("mcq");
    const subjectMatches = !cached.subject || String(cached.subject).toUpperCase() === String(params.subject).toUpperCase();
    const yearMatches = !cached.year || String(cached.year) === String(params.year) || params.year === "unknown";
    const cachedHasLegacyGarbage = looksLikeLegacySinhalaGarbage(questionText)
      || options.some(looksLikeLegacySinhalaGarbage);
    const hasVerifiedAnswer = Boolean(
      (params.allowOfficialAnswer && String(cached.officialAnswer || "").trim())
      || (/^[1-5]$/.test(String(cached?.solvedAnswer?.optionNo || "").trim())
        && String(cached?.solvedAnswer?.explanationSinhala || cached.explanationSinhala || "").trim())
    );
    const verified = Number(cached.evidenceVersion || 0) >= EVIDENCE_VERSION
      && cached.validationStatus !== "rejected"
      && subjectMatches
      && yearMatches
      && questionText.length >= 12
      && !cachedHasLegacyGarbage
      && (!isMcq || options.length >= 4)
      && (!isMcq || hasVerifiedAnswer)
      && (!params.requiresSyllabusGrounding || cached.syllabusGrounded === true);
    if (!verified) return null;

    return sanitizeDirectQaResult({
      ok: true,
      found: true,
      fromCache: true,
      sourceEvidence: {
        sourceId: params.sourceId,
        pageNumber: Number.isFinite(Number(cached.pageNumber)) ? Number(cached.pageNumber) : null,
        questionNo: params.questionNo,
        questionText,
        options: options.length > 0 ? options : null,
      },
      answer: {
        officialAnswer: params.allowOfficialAnswer ? (cached.officialAnswer || null) : null,
        estimatedAnswer: cached.estimatedAnswer || null,
        explanationSinhala: cached.explanationSinhala || null,
        lesson: cached.lesson || null,
        solvedAnswer: cached.solvedAnswer || null,
      },
      confidence: Number(cached.confidence || 0),
      reason: "VERIFIED_EVIDENCE_CACHE",
    });
  } catch (error) {
    console.warn("[DirectPDFQA] Verified cache lookup skipped:", String((error as any)?.message || error));
    return null;
  }
}

export async function askGeminiDirectPdfStructured(params: {
  uid: string;
  sourceId: string;
  pdfBuffer?: Buffer | null;
  pdfGcsUri?: string | null;
  year: string;
  subject: string;
  questionType: string;
  questionNo: string;
  prompt: string;
  allowOfficialAnswer?: boolean;
  syllabusPdfBuffer?: Buffer | null;
  syllabusPdfGcsUri?: string | null;
  originalPageNumbers?: number[];
}) {
  const {
    sourceId,
    pdfBuffer = null,
    pdfGcsUri = null,
    year,
    subject,
    questionType,
    questionNo,
    allowOfficialAnswer = false,
    syllabusPdfBuffer = null,
    syllabusPdfGcsUri = null,
    originalPageNumbers = [],
  } = params;
  const modelName = AI_MODELS.pdf;

  const cached = await readVerifiedQuestionCache({
    sourceId,
    subject,
    year,
    questionType,
    questionNo,
    allowOfficialAnswer,
    requiresSyllabusGrounding: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
  });
  if (cached) return cached;

  const systemInstruction = `You are an evidence-first Sri Lankan A/L exam PDF extractor.
You are reading the exact locked PDF source.

Requested:
Year: ${year}
Subject: ${subject}
Question Type: ${questionType}
Question Number: ${questionNo}
${originalPageNumbers.length > 0 ? `The attached subset pages map to original PDF pages: ${originalPageNumbers.join(", ")}.` : ""}

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
11. Read the rendered glyphs, diagrams, labels, arrows and geometry on the page—not only the embedded text layer.
12. If the PDF uses FM Abhaya or another legacy Sinhala font, TRANSCRIBE the visible Sinhala into proper Unicode Sinhala. Never return Latin/ASCII font codes such as "fuu", "mß", "l=", "ñ" or "ú".
13. For a diagram-based MCQ, include the diagram's relevant relationships in questionText using a short bracketed Unicode description so the solver has all required evidence.

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

  if (!pdfBuffer && !pdfGcsUri) {
    throw new Error("Direct PDF QA requires either PDF bytes or a verified Vertex GCS URI.");
  }
  const pdfPart = pdfBuffer
    ? { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } }
    : { fileData: { mimeType: "application/pdf", fileUri: pdfGcsUri as string } };

  const userPrompt = `
Requested:
Year: ${year}
Subject: ${subject}
Question Type: ${questionType}
Question Number: ${questionNo}
Source ID: ${sourceId}
${originalPageNumbers.length > 0 ? `Subset page mapping (subset page 1 first): ${originalPageNumbers.join(", ")}` : ""}

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

    if (originalPageNumbers.length > 0 && result?.sourceEvidence) {
      const subsetPage = Number(result.sourceEvidence.pageNumber || 0);
      result.sourceEvidence.pageNumber = subsetPage >= 1
        ? (originalPageNumbers[subsetPage - 1] || originalPageNumbers[0])
        : originalPageNumbers[0];
    }

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
    let qText = result?.sourceEvidence?.questionText;
    let opts = result?.sourceEvidence?.options;

    let extractedOptions = Array.isArray(opts) ? opts : [];
    let hasUnreadableLegacyText = looksLikeLegacySinhalaGarbage(qText)
      || extractedOptions.some(looksLikeLegacySinhalaGarbage);

    // Legacy-font PDFs can expose a completely corrupted text layer while the
    // rendered page and diagram remain perfectly readable.  In that case do a
    // visual-only solve before rejecting the extraction.  The solver must
    // return both a Unicode transcription and a selected option, so raw OCR can
    // never reach the client.
    if (
      questionType === "MCQ"
      && hasUnreadableLegacyText
      && (pdfBuffer || pdfGcsUri)
    ) {
      const visualSolved = await solveExtractedMcqQuestion({
        questionText: "",
        options: [],
        subject,
        year,
        questionNo,
        referencePdfBuffer: syllabusPdfBuffer,
        referencePdfGcsUri: syllabusPdfGcsUri,
        referenceLabel: "Sri Lankan A/L SFT syllabus PDF",
        questionPdfBuffer: pdfBuffer,
        questionPdfGcsUri: pdfGcsUri,
        visualOnly: true,
      }).catch((error) => {
        console.error("[DirectPDFQA] Visual legacy-font solver failed:", error);
        return null;
      });

      if (visualSolved?.questionUnicode && visualSolved.optionsUnicode?.length && result?.sourceEvidence) {
        result.sourceEvidence.questionText = visualSolved.questionUnicode;
        result.sourceEvidence.options = visualSolved.optionsUnicode;
        result.found = true;
        result.reason = "VISUAL_LEGACY_FONT_TRANSCRIPTION";
        result.answer = {
          ...(result.answer || {}),
          officialAnswer: null,
          solvedAnswer: visualSolved,
          explanationSinhala: visualSolved.explanationSinhala || null,
        };
        result.confidence = Math.max(Number(result.confidence || 0), visualSolved.confidence);
        qText = result.sourceEvidence.questionText;
        opts = result.sourceEvidence.options;
        extractedOptions = opts;
        hasUnreadableLegacyText = false;
      }
    }

    if (result.found && isQuestionNumberMismatch(qText, questionNo)) {
      console.warn(`[DirectPDFQA] Rejected mismatched question text. Requested Q${questionNo}; extracted marker=${extractLeadingQuestionNumber(qText)}`);
      result = {
        ...result,
        found: false,
        reason: "QUESTION_NUMBER_MISMATCH",
        answer: { officialAnswer: null, estimatedAnswer: null, explanationSinhala: null, lesson: null },
        confidence: 0,
      };
    }

    if (!result.found || !qText || qText.length < 20 || hasUnreadableLegacyText) {
      console.log(`[DirectPDFQA] Extraction failed validation: found=${result.found}, textLength=${qText?.length || 0}`);
      result = {
        ...result,
        found: false,
        reason: hasUnreadableLegacyText
          ? "LEGACY_SINHALA_VISUAL_TRANSCRIPTION_REQUIRED"
          : (result.reason || "EXACT_QUESTION_TEXT_MISSING"),
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
          questionNo,
          referencePdfBuffer: syllabusPdfBuffer,
          referencePdfGcsUri: syllabusPdfGcsUri,
          referenceLabel: "Sri Lankan A/L SFT syllabus PDF",
          questionPdfBuffer: pdfBuffer,
          questionPdfGcsUri: pdfGcsUri,
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

    if (
      questionType === "MCQ"
      && result.found === true
      && !result.answer?.officialAnswer
      && !/^[1-5]$/.test(String(result.answer?.solvedAnswer?.optionNo || "").trim())
    ) {
      return {
        ok: false,
        found: false,
        errorCode: "MCQ_SOLVER_EMPTY",
        stage: "ANSWER_VALIDATION",
        reason: "The exact MCQ was located, but the solver did not return one validated option.",
        canRetry: true,
      };
    }

    result = sanitizeDirectQaResult(result);

    // Save to cache if found
    if (result.found && result.sourceEvidence?.questionText) {
       const db = getAdminDb();
       const cacheId = directQaCacheId(sourceId, questionType, questionNo);
       
       const cacheData = {
         sourceId,
         subject,
         year,
         questionType,
         questionNo,
         ...result.sourceEvidence,
         ...result.answer,
         confidence: result.confidence,
         extractionMethod: originalPageNumbers.length > 0
           ? "gemini_targeted_legacy_page"
           : "gemini_direct_pdf_qa",
         validationStatus: result.confidence > 0.8 ? "valid" : "needs_review",
         evidenceVersion: EVIDENCE_VERSION,
         syllabusGrounded: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
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

    return sanitizeDirectQaResult({ ok: true, ...result });
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
  syllabusPdfBuffer?: Buffer | null;
  syllabusPdfGcsUri?: string | null;
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
    syllabusPdfBuffer = null,
    syllabusPdfGcsUri = null,
  } = params;

  const cached = await readVerifiedQuestionCache({
    sourceId,
    subject,
    year,
    questionType,
    questionNo,
    allowOfficialAnswer,
    requiresSyllabusGrounding: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
  });
  if (cached) return cached;

  const isMcq = String(questionType).toLowerCase().includes("mcq");

  // Scan the complete OCR/native-text index before asking a model to locate the
  // question. This prevents a vector-search miss from returning unrelated
  // questions or dumping arbitrary paper chunks into the reply.
  const deterministicEvidence = extractQuestionFromFullPaper(chunks, questionNo, questionType);
  if (deterministicEvidence.found && isMcq && !allowOfficialAnswer) {
    const questionText = deterministicEvidence.questionText as string;
    const options = deterministicEvidence.options;
    const solved = await solveExtractedMcqQuestion({
      questionText,
      options,
      subject,
      year,
      questionNo,
      referencePdfBuffer: syllabusPdfBuffer,
      referencePdfGcsUri: syllabusPdfGcsUri,
      referenceLabel: "Sri Lankan A/L SFT syllabus PDF",
    }).catch((error) => {
      console.error("[DirectPDFQA] Full-paper OCR solver failed:", error);
      return null;
    });

    if (!solved || !/^[1-5]$/.test(String(solved.optionNo || "").trim())) {
      return {
        ok: false,
        found: false,
        errorCode: "MCQ_SOLVER_EMPTY",
        stage: "ANSWER_VALIDATION",
        reason: "The exact MCQ was isolated from the full-paper OCR scan, but no validated option was produced.",
        canRetry: true,
      };
    }

    const deterministicResult = sanitizeDirectQaResult({
      ok: true,
      found: true,
      sourceEvidence: {
        sourceId,
        pageNumber: deterministicEvidence.pageNumber,
        questionNo,
        questionText,
        options,
      },
      answer: {
        officialAnswer: null,
        estimatedAnswer: null,
        explanationSinhala: solved.explanationSinhala || null,
        lesson: null,
        solvedAnswer: solved,
      },
      confidence: Math.max(0.9, Number(solved.confidence || 0)),
      reason: deterministicEvidence.reason,
      fullPaperScan: true,
      scannedCharacters: deterministicEvidence.scanTextLength,
    });

    const cacheId = directQaCacheId(sourceId, questionType, questionNo);
    await getAdminDb().collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep({
      sourceId,
      subject,
      year,
      questionType,
      questionNo,
      ...deterministicResult.sourceEvidence,
      ...deterministicResult.answer,
      confidence: deterministicResult.confidence,
      extractionMethod: "full_paper_ocr_scan",
      validationStatus: "valid",
      evidenceVersion: EVIDENCE_VERSION,
      syllabusGrounded: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
      fullPaperScan: true,
      scannedCharacters: deterministicEvidence.scanTextLength,
      updatedAt: new Date().toISOString(),
    }), { merge: true });

    await trackAIUsage(uid, AI_MODELS.pdf, Math.ceil(deterministicEvidence.scanTextLength / 4), 500, "directPdfQaCalls");
    return deterministicResult;
  }

  if (isMcq && !allowOfficialAnswer && !deterministicEvidence.found) {
    return {
      ok: false,
      found: false,
      errorCode: "FULL_PAPER_VISUAL_SCAN_REQUIRED",
      stage: "FULL_PAPER_INDEX_SCAN",
      reason: deterministicEvidence.reason,
      message: "The full OCR/text index did not contain a safe, complete question boundary. Scan the original PDF pages visually.",
      canRetry: true,
    };
  }

  const ordered = [...chunks]
    .sort((a, b) => {
      const pageDiff = Number(a.pageNumber || 0) - Number(b.pageNumber || 0);
      return pageDiff || (Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0));
    })
    .map((chunk) => `[Page ${chunk.pageNumber || "?"}]\n${String(chunk.text || "").trim()}`)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 180_000);

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
    const numberMismatch = isQuestionNumberMismatch(questionText, questionNo);
    if (!result?.found || numberMismatch || questionText.length < 12 || (isMcq && options.length < 4)) {
      return {
        ok: false,
        found: false,
        errorCode: numberMismatch ? "QUESTION_NUMBER_MISMATCH" : "EXACT_QUESTION_EVIDENCE_MISSING",
        stage: "INDEX_LOOKUP",
        reason: numberMismatch
          ? `The extracted question marker does not match requested question ${questionNo}.`
          : "The exact question is not readable in the indexed PDF text.",
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
        referencePdfBuffer: syllabusPdfBuffer,
        referencePdfGcsUri: syllabusPdfGcsUri,
        referenceLabel: "Sri Lankan A/L SFT syllabus PDF",
      }).catch(() => null);
      if (solved) result.answer.solvedAnswer = solved;
    }

    if (
      isMcq
      && !result.answer.officialAnswer
      && !/^[1-5]$/.test(String(result.answer?.solvedAnswer?.optionNo || "").trim())
    ) {
      return {
        ok: false,
        found: false,
        errorCode: "MCQ_SOLVER_EMPTY",
        stage: "ANSWER_VALIDATION",
        reason: "The indexed question was found, but no validated MCQ option was produced.",
        canRetry: true,
      };
    }

    const cacheId = directQaCacheId(sourceId, questionType, questionNo);
    await getAdminDb().collection("pdf_question_cache").doc(cacheId).set(removeUndefinedDeep({
      sourceId,
      subject,
      year,
      questionType,
      questionNo,
      ...result.sourceEvidence,
      ...result.answer,
      confidence: Number(result.confidence || 0),
      extractionMethod: "full_paper_index_scan",
      validationStatus: Number(result.confidence || 0) >= 0.8 ? "valid" : "needs_review",
      evidenceVersion: EVIDENCE_VERSION,
      syllabusGrounded: Boolean(syllabusPdfBuffer || syllabusPdfGcsUri),
      fullPaperScan: true,
      scannedCharacters: ordered.length,
      updatedAt: new Date().toISOString(),
    }), { merge: true });

    await trackAIUsage(uid, AI_MODELS.pdf, Math.ceil(ordered.length / 4), 500, "directPdfQaCalls");
    return sanitizeDirectQaResult({ ok: true, ...result });
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
