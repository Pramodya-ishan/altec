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

export function getModelForTask(task: AITask): ModelConfig {
  switch (task) {
    case "direct_pdf_extract":
      return {
        primary: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash",
        fallback: process.env.GEMINI_PDF_QA_FALLBACK || "gemini-2.5-flash"
      };
    case "direct_pdf_solve":
      return {
        primary: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: "gemini-2.5-flash"
      };
    case "final_answer":
      return {
        primary: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview",
        fallback: process.env.GEMINI_FINAL_FALLBACK || "gemini-2.5-pro"
      };
    case "normal_chat":
      return {
        primary: process.env.GEMINI_DEFAULT_MODEL || process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: "gemini-2.5-flash"
      };
    case "fast_background":
      return {
        primary: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
        fallback: process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite"
      };
    case "embeddings":
      return {
        primary: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
        fallback: "text-embedding-004"
      };
    case "image_understanding":
      return {
        primary: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash",
        fallback: "gemini-2.5-flash-lite"
      };
    case "ocr":
      return {
        primary: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash",
        fallback: "gemini-2.5-flash-lite"
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
    payload.model = models.primary;
    const result = await client.models.generateContent(payload);
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
    const isRetryable = classification.retryable && (err.status === 404 || err.status >= 500);
    
    if (isRetryable && models.fallback) {
      console.log(`[modelRouter] Falling back to model ${models.fallback} for task ${task}`);
      try {
        payload.model = models.fallback;
        const result = await client.models.generateContent(payload);
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

export async function generateContentStreamWithFallback(task: AITask, payload: GenerateContentParameters, aiClient?: GoogleGenAI) {
    assertAiAvailable();
    const models = getModelForTask(task);
    const client = aiClient || getAIClient();
    
    try {
      console.log(`[modelRouter] Attempting stream with primary model ${models.primary} for task ${task}`);
      payload.model = models.primary;
      const stream = await client.models.generateContentStream(payload);
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
      
      const isRetryable = classification.retryable && (err.status === 404 || err.status >= 500);
      
      if (isRetryable && models.fallback) {
        console.log(`[modelRouter] Falling back stream to model ${models.fallback} for task ${task}`);
        try {
          payload.model = models.fallback;
          const stream = await client.models.generateContentStream(payload);
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
