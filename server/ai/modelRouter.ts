import { getAIClient } from "./client";
import { GoogleGenAI, GenerateContentParameters } from "@google/genai";
import {
  assertAiAvailable,
  openAiBillingCircuit
} from "./aiCircuitBreaker";
import { classifyAiError } from "./aiErrorClassifier";

export let lastOk = false;
export let lastError: string | null = null;

type ModelHealthState = { failures: number; unhealthyUntil: number; lastError: string };
const modelHealth = new Map<string, ModelHealthState>();

function modelHealthBaseTtlMs() {
  const configured = Number(process.env.AI_MODEL_HEALTH_TTL_MS || 45_000);
  return Math.max(5_000, Math.min(10 * 60_000, Number.isFinite(configured) ? configured : 45_000));
}

export function isModelTemporarilyUnhealthy(model: string, now = Date.now()) {
  const state = modelHealth.get(model);
  if (!state) return false;
  if (state.unhealthyUntil <= now) {
    modelHealth.delete(model);
    return false;
  }
  return true;
}

export function recordModelFailure(model: string, error: unknown, now = Date.now()) {
  const previous = modelHealth.get(model);
  const failures = Math.min(6, (previous?.failures || 0) + 1);
  const message = String((error as any)?.message || error || "model failure").toLowerCase();
  const multiplier = /404|not found|unsupported|does not exist/u.test(message) ? 6 : Math.min(4, failures);
  const unhealthyUntil = now + modelHealthBaseTtlMs() * multiplier;
  modelHealth.set(model, { failures, unhealthyUntil, lastError: message.slice(0, 240) });
  return modelHealth.get(model)!;
}

export function recordModelSuccess(model: string) {
  modelHealth.delete(model);
}

export function resetModelHealthForTests() {
  modelHealth.clear();
}

function modelRequestTimeoutMs(task: AITask) {
  const configured = Number(process.env.AI_MODEL_REQUEST_TIMEOUT_MS || 0);
  if (Number.isFinite(configured) && configured > 0) return Math.max(1_000, Math.min(180_000, Math.trunc(configured)));
  switch (task) {
    case "fast_background": return 25_000;
    case "normal_chat": return 45_000;
    case "final_answer": return 90_000;
    case "image_understanding": return 90_000;
    case "direct_pdf_extract":
    case "direct_pdf_solve": return 75_000;
    default: return 60_000;
  }
}

async function runModelRequest<T>(params: {
  task: AITask;
  label: string;
  externalSignal?: AbortSignal;
  execute: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = modelRequestTimeoutMs(params.task);
  let timedOut = false;
  const forwardAbort = () => controller.abort((params.externalSignal as any)?.reason);
  if (params.externalSignal?.aborted) forwardAbort();
  else params.externalSignal?.addEventListener("abort", forwardAbort, { once: true });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`${params.label} timed out after ${timeoutMs}ms`));
      const error: any = new Error(`${params.label} timed out after ${timeoutMs}ms`);
      error.code = "AI_MODEL_TIMEOUT";
      error.status = 408;
      error.retryable = true;
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([params.execute(controller.signal), timeoutPromise]);
  } catch (error: any) {
    if (timedOut && error?.code !== "AI_MODEL_TIMEOUT") {
      const timeoutError: any = new Error(`${params.label} timed out after ${timeoutMs}ms`);
      timeoutError.code = "AI_MODEL_TIMEOUT";
      timeoutError.status = 408;
      timeoutError.retryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    params.externalSignal?.removeEventListener("abort", forwardAbort);
  }
}

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

async function callHealthyFallback(
  payload: GenerateContentParameters,
  client: GoogleGenAI,
  fallback: string,
  options: { task: AITask; signal?: AbortSignal; streaming?: boolean },
) {
  const result = await runModelRequest({
    task: options.task,
    label: `${options.streaming ? "stream" : "request"} fallback ${fallback}`,
    externalSignal: options.signal,
    execute: async (requestSignal) => {
      const fallbackPayload: any = { ...payload, model: fallback, abortSignal: requestSignal };
      return options.streaming
        ? await client.models.generateContentStream(fallbackPayload)
        : await client.models.generateContent(fallbackPayload);
    },
  });
  recordModelSuccess(fallback);
  return result;
}

export async function callGeminiWithFallback(task: AITask, payload: GenerateContentParameters, aiClient?: GoogleGenAI) {
  assertAiAvailable();
  const models = getModelForTask(task);
  const client = aiClient || getAIClient();
  if (models.fallback && models.fallback !== models.primary && isModelTemporarilyUnhealthy(models.primary)) {
    console.warn(`[modelRouter] Skipping temporarily unhealthy primary ${models.primary}; using ${models.fallback}`);
    try {
      const result = await callHealthyFallback(payload, client, models.fallback, { task }) as any;
      return { result, modelUsed: models.fallback, warning: `Primary model temporarily unhealthy, used fallback ${models.fallback}` };
    } catch (fallbackErr: any) {
      recordModelFailure(models.fallback, fallbackErr);
      throw fallbackErr;
    }
  }
  
  try {
    console.log(`[modelRouter] Attempting primary model ${models.primary} for task ${task}`);
    const result = await runModelRequest({
      task,
      label: `request primary ${models.primary}`,
      execute: (requestSignal) => client.models.generateContent({ ...payload, model: models.primary, abortSignal: requestSignal } as any),
    });
    recordModelSuccess(models.primary);
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
    if (isRetryable) recordModelFailure(models.primary, err);
    
    if (isRetryable && models.fallback) {
      console.log(`[modelRouter] Falling back to model ${models.fallback} for task ${task}`);
      try {
        const result = await runModelRequest({
          task,
          label: `request fallback ${models.fallback}`,
          execute: (requestSignal) => client.models.generateContent({ ...payload, model: models.fallback, abortSignal: requestSignal } as any),
        });
        recordModelSuccess(models.fallback);
        return { result, modelUsed: models.fallback, warning: `Primary model unavailable, used fallback ${models.fallback}` };
      } catch (fallbackErr: any) {
        recordModelFailure(models.fallback, fallbackErr);
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
    if (models.fallback && models.fallback !== models.primary && isModelTemporarilyUnhealthy(models.primary)) {
      console.warn(`[modelRouter] Skipping temporarily unhealthy stream primary ${models.primary}; using ${models.fallback}`);
      try {
        const stream = await callHealthyFallback(payload, client, models.fallback, { task, signal, streaming: true }) as any;
        return { stream, modelUsed: models.fallback, warning: `Primary model temporarily unhealthy, used fallback ${models.fallback}` };
      } catch (fallbackErr: any) {
        recordModelFailure(models.fallback, fallbackErr);
        throw fallbackErr;
      }
    }
    
    try {
      console.log(`[modelRouter] Attempting stream with primary model ${models.primary} for task ${task}`);
      const stream = await runModelRequest({
        task,
        label: `stream primary ${models.primary}`,
        externalSignal: signal,
        execute: (requestSignal) => client.models.generateContentStream({ ...payload, model: models.primary, abortSignal: requestSignal } as any),
      });
      recordModelSuccess(models.primary);
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
      if (isRetryable) recordModelFailure(models.primary, err);
      
      if (isRetryable && models.fallback) {
        console.log(`[modelRouter] Falling back stream to model ${models.fallback} for task ${task}`);
        try {
          const stream = await runModelRequest({
            task,
            label: `stream fallback ${models.fallback}`,
            externalSignal: signal,
            execute: (requestSignal) => client.models.generateContentStream({ ...payload, model: models.fallback, abortSignal: requestSignal } as any),
          });
          recordModelSuccess(models.fallback);
          return { stream, modelUsed: models.fallback, warning: `Primary model unavailable, used fallback ${models.fallback}` };
        } catch (fallbackErr: any) {
          recordModelFailure(models.fallback, fallbackErr);
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
