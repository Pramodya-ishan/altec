import { GoogleGenAI } from "@google/genai";

const MAX_CONCURRENT_GEMINI = 1;
let currentGeminiRequests = 0;
const geminiQueue: any[] = [];

async function processGeminiQueue() {
   if (currentGeminiRequests >= MAX_CONCURRENT_GEMINI) return;
   if (geminiQueue.length > 0) {
      const { task, resolve, reject } = geminiQueue.shift()!;
      currentGeminiRequests++;
      try {
         const result = await task();
         resolve(result);
      } catch (e) {
         reject(e);
      } finally {
         currentGeminiRequests--;
         setTimeout(processGeminiQueue, 3000);
      }
   }
}

export function enqueueGeminiTask<T>(task: () => Promise<T>): Promise<T> {
   return new Promise((resolve, reject) => {
      geminiQueue.push({ task, resolve, reject });
      processGeminiQueue();
   });
}

export async function generateContentWithFallback(ai: GoogleGenAI, tryModels: string[], contents: any, config?: any) {
   let lastError: any = null;
   for (const m of tryModels) {
      try {
         const supportsSearch = m.startsWith('gemini-3');
         const finalConfig = config ? { ...config } : {};
         if (supportsSearch && config?.toolConfig?.includeServerSideToolInvocations) {
            finalConfig.toolConfig = { includeServerSideToolInvocations: true };
         }
         
         const response = await enqueueGeminiTask(async () => {
            return await ai.models.generateContent({
               model: m,
               contents,
               config: finalConfig
            });
         });
         return { response, model: m };
      } catch (e: any) {
         lastError = e;
         console.warn(`Model ${m} failed: ${e.message}. Trying next...`);
         
         // Parse retry string
         const errorString = String(e.message || "");
         const retryMatch = errorString.match(/retry in (\d+(?:\.\d+)?)s/);
         if (retryMatch) {
            const waitTime = parseFloat(retryMatch[1]) * 1000 + 500;
            console.log(`Rate limit reached on ${m}. Cooling down for ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
         } else if (e.status === 429) {
            await new Promise(r => setTimeout(r, 5000));
         }
         continue;
      }
   }
   throw lastError;
}
