import { getAIClient } from "./client";

export const ai = getAIClient();

// This is a capacity semaphore, not a user/IP rate limit. Requests wait rather
// than receiving 429 responses. Provider quotas and Vercel execution limits
// still apply and cannot be disabled by application code.
const configuredConcurrency = Number(process.env.GEMINI_MAX_CONCURRENCY || 4);
export const MAX_CONCURRENT_GEMINI = Number.isFinite(configuredConcurrency)
  ? Math.max(1, Math.min(16, Math.floor(configuredConcurrency)))
  : 4;

let activeRequests = 0;
const waiters: Array<() => void> = [];

async function acquire() {
  if (activeRequests >= MAX_CONCURRENT_GEMINI) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  activeRequests += 1;
}

function release() {
  activeRequests = Math.max(0, activeRequests - 1);
  waiters.shift()?.();
}

function isRetryableProviderError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? Number(error.status) : 0;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function enqueueGeminiTask<T>(task: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    try {
      return await task();
    } catch (error) {
      if (!isRetryableProviderError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.floor(Math.random() * 400)));
      return await task();
    }
  } finally {
    release();
  }
}

export async function enqueueGeminiRequest() {
  await acquire();
}

export function dequeueGeminiRequest() {
  release();
}

export async function callPollinationsAI(): Promise<string> {
  throw new Error("External fallbacks are disabled for academic data.");
}
