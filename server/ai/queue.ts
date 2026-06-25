import { GoogleGenAI } from '@google/genai';
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy-key-for-build',
});
export const RPM_LIMIT = 15;
export const RPD_LIMIT = 1500;
export let requestCountPM = 0;
export let requestCountPD = 0;
export let lastResetPM = Date.now();
export let lastResetPD = Date.now();
export const MAX_CONCURRENT_GEMINI = 1;
export let currentGeminiRequests = 0;
export const geminiQueue: (() => void)[] = [];
export async function enqueueGeminiRequest() {
  if (currentGeminiRequests >= MAX_CONCURRENT_GEMINI) {
    await new Promise<void>((resolve) => geminiQueue.push(resolve));
  }
  currentGeminiRequests++;
  if (Date.now() - lastResetPM > 60000) {
    requestCountPM = 0;
    lastResetPM = Date.now();
  }
  if (Date.now() - lastResetPD > 86400000) {
    requestCountPD = 0;
    lastResetPD = Date.now();
  }
  requestCountPM++;
  requestCountPD++;
}
export function dequeueGeminiRequest() {
  currentGeminiRequests--;
  if (geminiQueue.length > 0) {
    const next = geminiQueue.shift();
    if (next) next();
  }
}

export async function enqueueGeminiTask<T>(task: () => Promise<T>): Promise<T> {
  await enqueueGeminiRequest();
  try {
    let retries = 1; // Only retry once per model to avoid hanging the chat
    let delayMs = 1500;
    while (retries > 0) {
      try {
        return await task();
      } catch (e: any) {
        if (e.status === 503 || e.status === 429) {
          if (e.message && e.message.includes("limit: 0")) {
             // fast fail to next model if quota limit is strictly 0
             throw e;
          }
          retries--;
          if (retries === 0) throw e;
          console.warn(`Gemini API returned ${e.status}. Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2;
        } else {
          throw e; // throw immediately if not 503 or 429
        }
      }
    }
    return await task();
  } finally {
    dequeueGeminiRequest();
  }
}

export async function callPollinationsAI(messages: any[], jsonMode = false): Promise<string> {
  throw new Error("External fallbacks are disabled for academic data.");
}

export function cleanRequestLog() {
  if (Date.now() - lastResetPM > 60000) {
    requestCountPM = 0;
  }
}
