import { getAIClient } from "./client";
import { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import {
  assertAiAvailable,
  openAiBillingCircuit
} from "./aiCircuitBreaker";
import { classifyAiError } from "./aiErrorClassifier";

export let lastOk = false;
export let lastError: string | null = null;

export function setLastOk(ok: boolean, err: string | null = null) {
  lastOk = ok;
  lastError = err;
}

// Sanitize/Enforce safe default models to avoid accidental Pro model usage for general chats
if (process.env.GEMINI_DEFAULT_MODEL && (process.env.GEMINI_DEFAULT_MODEL.includes("pro") || process.env.GEMINI_DEFAULT_MODEL.includes("preview"))) {
  process.env.GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
}
if (!process.env.GEMINI_DEFAULT_MODEL) {
  process.env.GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";
}
if (!process.env.GEMINI_FAST_MODEL) {
  process.env.GEMINI_FAST_MODEL = "gemini-3.5-flash";
}
if (!process.env.GEMINI_PDF_QA_MODEL) {
  process.env.GEMINI_PDF_QA_MODEL = "gemini-3.5-flash";
}
if (!process.env.GEMINI_PDF_QA_FALLBACK) {
  process.env.GEMINI_PDF_QA_FALLBACK = "gemini-2.5-flash";
}
if (!process.env.GEMINI_FINAL_MODEL) {
  process.env.GEMINI_FINAL_MODEL = "gemini-3.1-pro-preview";
}
if (!process.env.GEMINI_FINAL_FALLBACK) {
  process.env.GEMINI_FINAL_FALLBACK = "gemini-2.5-pro";
}
if (!process.env.GEMINI_LITE_MODEL) {
  process.env.GEMINI_LITE_MODEL = "gemini-3.1-flash-lite";
}

export type AITask = 
  | "final_answer"
  | "normal_chat"
  | "fast_background"
  | "embeddings"
  | "image_understanding"
  | "ocr"
  | "tts"
  | "image_generation"
  | "direct_pdf_extract"
  | "direct_pdf_solve";

interface ModelConfig {
  primary: string;
  fallback?: string;
}

function shouldTryModelFallback(error: any, retryable: boolean) {
  if (!retryable) return false;
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  const message = String(error?.message || error || "").toLowerCase();
  return !status
    || status === 404
    || status === 408
    || status === 409
    || status === 429
    || status >= 500
    || /timeout|timed out|network|fetch failed|connection|unavailable|overloaded|econnreset|socket/.test(message);
}

export function getModelForTask(task: AITask): ModelConfig {
  switch (task) {
    case "direct_pdf_extract":
      return {
        primary: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash",
        fallback: process.env.GEMINI_PDF_QA_FALLBACK || "gemini-3.5-flash"
      };
    case "direct_pdf_solve":
      return {
        // PDF answers already have an exact, verified question before this
        // task runs. A Flash model is substantially faster and is sufficient
        // for the first syllabus-bounded solve pass. The slower Pro path is
        // still available through the explicit final_answer fallback in the
        // solver when the fast pass is incomplete.
        primary: process.env.GEMINI_PDF_SOLVE_MODEL
          || process.env.GEMINI_PDF_QA_MODEL
          || "gemini-3.5-flash",
        fallback: process.env.GEMINI_PDF_SOLVE_FALLBACK
          || process.env.GEMINI_PDF_QA_FALLBACK
          || "gemini-2.5-flash"
      };
    case "final_answer":
      return {
        primary: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview",
        fallback: process.env.GEMINI_FINAL_FALLBACK || "gemini-3.1-pro-preview"
      };
    case "normal_chat":
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: "gemini-3.5-flash"
      };
    case "fast_background":
      return {
        primary: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash"
      };
    case "embeddings":
      return {
        primary: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
        fallback: "text-embedding-004"
      };
    case "image_understanding":
      return {
        primary: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview",
        fallback: "gemini-3.5-flash"
      };
    case "ocr":
      return {
        primary: process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash",
        fallback: "gemini-3.5-flash"
      };
    case "tts":
      return {
        primary: process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview"
      };
    case "image_generation":
      return {
        primary: process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002"
      };
    default:
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash"
      };
  }
}

export async function callGeminiWithFallback(task: AITask, payload: GenerateContentParameters, aiClient?: GoogleGenAI) {
  assertAiAvailable();
  const models = getModelForTask(task);
  const client = aiClient || getAIClient();
  
  try {
    console.log(`[modelRouter] Attempting primary model ${models.primary} for task ${task}`);
    const result = await client.models.generateContent({ ...payload, model: models.primary });
    if (task === "normal_chat") {
      lastOk = true;
      lastError = null;
    }
    return { result, modelUsed: models.primary };
  } catch (err: any) {
    if (task === "normal_chat") {
      lastOk = false;
      lastError = err.message || String(err);
    }
    console.warn(`[modelRouter] Primary model ${models.primary} failed for task ${task}: ${err.message}`);
    const classification = classifyAiError(err);

    if (classification.code === "AI_BILLING_EXHAUSTED") {
      openAiBillingCircuit(err);
      const e: any = new Error(classification.userMessage);
      e.code = "AI_BILLING_EXHAUSTED";
      e.status = 429;
      e.retryable = false;
      throw e;
    }
    
    // Check if error is recoverable via fallback
    const isRetryable = shouldTryModelFallback(err, classification.retryable);
    
    if (isRetryable && models.fallback) {
      console.log(`[modelRouter] Falling back to model ${models.fallback} for task ${task}`);
      try {
        const result = await client.models.generateContent({ ...payload, model: models.fallback });
        return { result, modelUsed: models.fallback, warning: `Primary model unavailable, used fallback ${models.fallback}` };
      } catch (fallbackErr: any) {
        console.error(`[modelRouter] Fallback model ${models.fallback} also failed: ${fallbackErr.message}`);
        const fallbackClassification = classifyAiError(fallbackErr);
        if (fallbackClassification.code === "AI_BILLING_EXHAUSTED") {
          openAiBillingCircuit(fallbackErr);
          const e: any = new Error(fallbackClassification.userMessage);
          e.code = "AI_BILLING_EXHAUSTED";
          e.status = 429;
          e.retryable = false;
          throw e;
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}

export async function generateContentStreamWithFallback(task: AITask, payload: GenerateContentParameters, aiClient?: GoogleGenAI, signal?: AbortSignal) {
    assertAiAvailable();
    const models = getModelForTask(task);
    const client = aiClient || getAIClient();
    
    try {
      console.log(`[modelRouter] Attempting stream with primary model ${models.primary} for task ${task}`);
      const primaryPayload: any = { ...payload, model: models.primary };
      if (signal) primaryPayload.abortSignal = signal;
      const stream = await client.models.generateContentStream(primaryPayload);
      if (task === "normal_chat") {
        lastOk = true;
        lastError = null;
      }
      return { stream, modelUsed: models.primary };
    } catch (err: any) {
      if (task === "normal_chat") {
        lastOk = false;
        lastError = err.message || String(err);
      }
      console.warn(`[modelRouter] Primary model ${models.primary} stream failed for task ${task}: ${err.message}`);
      
      const classification = classifyAiError(err);

      if (classification.code === "AI_BILLING_EXHAUSTED") {
        openAiBillingCircuit(err);
        const e: any = new Error(classification.userMessage);
        e.code = "AI_BILLING_EXHAUSTED";
        e.status = 429;
        e.retryable = false;
        throw e;
      }
      
      const isRetryable = shouldTryModelFallback(err, classification.retryable);
      
      if (isRetryable && models.fallback) {
        console.log(`[modelRouter] Falling back stream to model ${models.fallback} for task ${task}`);
        try {
          const fallbackPayload: any = { ...payload, model: models.fallback };
          if (signal) fallbackPayload.abortSignal = signal;
          const stream = await client.models.generateContentStream(fallbackPayload);
          return { stream, modelUsed: models.fallback, warning: `Primary model unavailable, used fallback ${models.fallback}` };
        } catch (fallbackErr: any) {
          console.error(`[modelRouter] Fallback stream model ${models.fallback} also failed: ${fallbackErr.message}`);
          const fallbackClassification = classifyAiError(fallbackErr);
          if (fallbackClassification.code === "AI_BILLING_EXHAUSTED") {
            openAiBillingCircuit(fallbackErr);
            const e: any = new Error(fallbackClassification.userMessage);
            e.code = "AI_BILLING_EXHAUSTED";
            e.status = 429;
            e.retryable = false;
            throw e;
          }
          throw fallbackErr;
        }
      }
      throw err;
    }
  }
