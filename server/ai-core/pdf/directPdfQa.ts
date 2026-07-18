import { AI_MODELS } from "../../ai/client";
import { callGeminiWithFallback } from "../../ai/modelRouter";
import { stripRawVisualBlocks } from "../answer/stripVisualBlocks";
import { removeUndefinedDeep } from "../memory/chatSanitizer";
import { getAdminDb } from "../../firebase/admin";
import { solveExtractedEssayQuestion, solveExtractedMcqQuestion } from "./solveExtractedQuestion";
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
    "options": string[]|null,
    "hasRelevantImage": boolean,
    "imageRegion": {"x":number,"y":number,"width":number,"height":number}|null
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
If a diagram, graph, table, photograph, or other visual is part of the requested question, set hasRelevantImage:true and return its approximate normalized page region. Coordinates must be between 0 and 1, measured from the page's top-left. Otherwise return hasRelevantImage:false and imageRegion:null.
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

    const region = result?.sourceEvidence?.imageRegion;
    if (region && typeof region === "object") {
      const values = [region.x, region.y, region.width, region.height].map(Number);
      const valid = values.every(Number.isFinite)
        && values[0] >= 0 && values[1] >= 0
        && values[2] > 0 && values[3] > 0
        && values[0] + values[2] <= 1.02
        && values[1] + values[3] <= 1.02;
      if (!valid) result.sourceEvidence.imageRegion = null;
    }

    // Solver runs only after the exact question has passed validation.
    if (result.found === true && result.sourceEvidence?.questionText && !result.answer?.solvedAnswer && !result.answer?.officialAnswer) {
      console.log(`[DirectPDFQA] Triggering solver pass for ${questionType} ${questionNo}`);
      try {
        const normalizedType = String(questionType || "").toUpperCase();
        const solved = normalizedType === "MCQ"
          ? await solveExtractedMcqQuestion({
              uid,
              sourceId,
              questionText: result.sourceEvidence.questionText,
              options: Array.isArray(result.sourceEvidence.options) ? result.sourceEvidence.options : [],
              subject,
              year,
              questionNo,
            })
          : await solveExtractedEssayQuestion({
              uid,
              sourceId,
              questionText: result.sourceEvidence.questionText,
              subject,
              year,
              questionNo,
              questionType: normalizedType || "ESSAY",
            });
        if (solved) {
          await trackAIUsage(uid, AI_MODELS.pdf, 500, 500, "solverCalls");
          result.answer = { ...result.answer, solvedAnswer: solved };
          if (!result.answer.explanationSinhala && "explanationSinhala" in solved && solved.explanationSinhala) {
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
         evidenceVersion: 3,
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

export async function askGeminiExtractedTextStructured(params: {
  uid: string;
  sourceId: string;
  extractedText: string;
  year: string;
  subject: string;
  questionType: string;
  questionNo: string;
  allowOfficialAnswer?: boolean;
}) {
  const {
    uid,
    sourceId,
    extractedText,
    year,
    subject,
    questionType,
    questionNo,
    allowOfficialAnswer = false,
  } = params;

  const normalizedQuestionNo = String(questionNo || "").replace(/\D/g, "") || String(questionNo || "");
  const boundedText = String(extractedText || "").slice(0, 90_000);
  if (boundedText.trim().length < 40) {
    return {
      ok: false,
      found: false,
      errorCode: "EXTRACTED_TEXT_EMPTY",
      stage: "LOCAL_TEXT_EXTRACTION",
      reason: "PDF text layer එකේ කියවිය හැකි text ප්‍රමාණවත් නැහැ.",
    };
  }

  const systemInstruction = `
ඔබට ලැබෙන්නේ සත්‍යාපිත PDF මූලාශ්‍රයකින් server එක extract කළ text පමණයි.

ඉලක්ක ප්‍රශ්නය: ${questionType} ${normalizedQuestionNo}
විෂය: ${subject}
වසර: ${year}

නීති:
1. දී ඇති text එකේ ඉලක්ක ප්‍රශ්නය පැහැදිලිව තිබුණොත් පමණක් found:true දෙන්න.
2. ප්‍රශ්නය සහ විකල්ප අලුතින් හදන්න එපා.
3. MCQ නම් ලැබෙන සියලු විකල්ප exact text ලෙස extract කරන්න.
4. ${allowOfficialAnswer ? "මෙය marking scheme එකක් නම් පමණක් printed official answer එක copy කරන්න." : "officialAnswer සෑම විටම null විය යුතුයි."}
5. පැහැදිලි කිරීම ස්වභාවික සිංහල Unicode වලින් දෙන්න.
6. JSON පමණක් return කරන්න.
`;

  const { result: response, modelUsed } = await callGeminiWithFallback("direct_pdf_extract", {
    model: AI_MODELS.pdf,
    contents: [{
      role: "user",
      parts: [{
        text: `ඉලක්කය: ${questionType} ${normalizedQuestionNo}\n\nPDF TEXT:\n${boundedText}\n\n` +
          `Return JSON: {"found":boolean,"sourceEvidence":{"sourceId":"${sourceId}","pageNumber":number|null,"questionNo":"${normalizedQuestionNo}","questionText":string|null,"options":string[]|null},"answer":{"officialAnswer":string|null,"estimatedAnswer":null,"explanationSinhala":string|null,"lesson":string|null},"confidence":number,"reason":string}`,
      }],
    }],
    config: {
      systemInstruction,
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    return { ok: false, found: false, errorCode: "EXTRACTED_TEXT_MODEL_EMPTY", stage: "MODEL_CALL" };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(response.text.trim());
  } catch {
    return { ok: false, found: false, errorCode: "EXTRACTED_TEXT_MODEL_INVALID_JSON", stage: "MODEL_CALL" };
  }

  const questionText = String(parsed?.sourceEvidence?.questionText || "").trim();
  const options = Array.isArray(parsed?.sourceEvidence?.options) ? parsed.sourceEvidence.options : [];
  const isValidMcq = String(questionType).toUpperCase() !== "MCQ" || options.length >= 4;
  if (parsed?.found !== true || questionText.length < 20 || !isValidMcq) {
    return {
      ok: false,
      found: false,
      errorCode: "EXACT_QUESTION_EVIDENCE_MISSING",
      stage: "LOCAL_TEXT_MATCH",
      reason: "Extract කළ text එකේ ඉලක්ක ප්‍රශ්නය සම්පූර්ණයෙන් හමු නොවුණි.",
    };
  }

  if (!allowOfficialAnswer && parsed.answer) parsed.answer.officialAnswer = null;
  const normalizedType = String(questionType).toUpperCase();
  if (!parsed.answer?.officialAnswer) {
    const solved = normalizedType === "MCQ"
      ? await solveExtractedMcqQuestion({
          uid,
          sourceId,
          questionText,
          options,
          subject,
          year,
          questionNo: normalizedQuestionNo,
        })
      : await solveExtractedEssayQuestion({
          uid,
          sourceId,
          questionText,
          subject,
          year,
          questionNo: normalizedQuestionNo,
          questionType: normalizedType || "ESSAY",
        });
    if (solved) {
      parsed.answer = {
        ...(parsed.answer || {}),
        solvedAnswer: solved,
        explanationSinhala: "explanationSinhala" in solved
          ? solved.explanationSinhala || parsed.answer?.explanationSinhala || null
          : parsed.answer?.explanationSinhala || null,
      };
    }
  }

  await trackAIUsage(uid, modelUsed || AI_MODELS.pdf, Math.ceil(boundedText.length / 4), 500, "directPdfQaCalls").catch(() => undefined);
  return { ok: true, ...parsed, model: modelUsed, extractionMethod: "server_pdf_text_layer" };
}
