import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { checkAiBillingCircuit, handleAiError } from "./aiCircuitBreaker";
import {
  getGoogleServiceAccountFromEnvironment,
  serializeGoogleServiceAccount,
} from "../utils/googleCredentials";

let cachedClient: GoogleGenAI | null = null;
let hasLoggedDiagnostics = false;

function shouldUseVertex(): boolean {
  const configuredMode = String(process.env.GEMINI_USE_VERTEX || "").trim().toLowerCase();
  if (configuredMode === "true") return true;
  if (configuredMode === "false") return false;

  // This project is Vertex-first. When no mode and no API key are configured,
  // keep unrelated routes (including authentication) available and let ADC be
  // resolved only when an AI request is actually made.
  return !process.env.GEMINI_API_KEY;
}

export function prepareGoogleCredentials() {
  const serviceAccount = getGoogleServiceAccountFromEnvironment();
  if (serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = "/tmp/google-credentials.json";
    fs.writeFileSync(filePath, serializeGoogleServiceAccount(serviceAccount), { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
  }
}

export function getAIClient(): GoogleGenAI {
  let client: GoogleGenAI;
  if (cachedClient) {
    client = cachedClient;
  } else {
    prepareGoogleCredentials();

    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const useVertex = shouldUseVertex();
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";

    if (useVertex) {
      cachedClient = new GoogleGenAI({
        vertexai: true,
        project: project,
        location: location,
      });
    } else {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required when GEMINI_USE_VERTEX is not true");
      }
      cachedClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });
    }
    client = cachedClient;
  }

  // Print startup diagnostics once
  if (!hasLoggedDiagnostics) {
    hasLoggedDiagnostics = true;
    const deployTarget = process.env.APP_DEPLOY_TARGET || "cloud_run";
    const useVertex = shouldUseVertex();
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
    const hasServiceAccountJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasGeminiApiKey = !!process.env.GEMINI_API_KEY;

    console.log(`[DEPLOY] target=${deployTarget}`);
    if (useVertex) {
      console.log(`[AI_CONFIG] mode=vertex`);
      console.log(`[AI_CONFIG] project=${project}`);
      console.log(`[AI_CONFIG] location=${location}`);
      console.log(`[AI_CONFIG] hasServiceAccountJson=${hasServiceAccountJson}`);
      console.log(`[AI_CONFIG] GEMINI_API_KEY ignored because GEMINI_USE_VERTEX=true`);
    } else {
      console.log(`[AI_CONFIG] mode=api_key`);
      console.log(`[AI_CONFIG] hasServiceAccountJson=${hasServiceAccountJson}`);
      console.log(`[AI_CONFIG] hasGeminiApiKey=true`);
    }
    const ttsEnabled = String(process.env.ENABLE_TTS || "").toLowerCase() === "true";
    console.log(`[AI_CONFIG] normal_chat=${process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash"}`);
    console.log(`[AI_CONFIG] pdfQa=${process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"}`);
    console.log(`[AI_CONFIG] final=${process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview"}`);
    console.log(`[AI_CONFIG] tts=${ttsEnabled}`);
  }

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "models") {
        const models = Reflect.get(target, prop, receiver);
        return new Proxy(models, {
          get(modelsTarget, modelsProp, modelsReceiver) {
            const originalVal = Reflect.get(modelsTarget, modelsProp, modelsReceiver);
            if (typeof originalVal === "function" && (modelsProp === "generateContent" || modelsProp === "generateContentStream")) {
              return async function (...args: any[]) {
                checkAiBillingCircuit();
                try {
                  return await originalVal.apply(modelsTarget, args);
                } catch (err: any) {
                  handleAiError(err);
                  throw err;
                }
              };
            }
            return originalVal;
          }
        });
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

function mapModel(model: string, defaultFallback: string) {
  if (!model) return defaultFallback;
  return model;
}

export const AI_MODELS = {
  default: process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash",
  pro: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
  fast: process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash",
  search: process.env.GEMINI_SEARCH_MODEL || "gemini-3.5-flash",
  urlContext: process.env.GEMINI_URL_CONTEXT_MODEL || "gemini-3.1-pro-preview",
  image: process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-001",
  imagePro: process.env.GEMINI_IMAGE_PRO_MODEL || "imagen-3.0-generate-001",
  pdf: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"
};

export function getModelFallbackChain(requestedModel?: string): string[] {
  const chain: string[] = [];
  if (requestedModel) chain.push(requestedModel);
  chain.push(AI_MODELS.pro);
  chain.push("gemini-3.1-pro-preview");
  chain.push(AI_MODELS.default);
  chain.push("gemini-3.5-flash");
  return Array.from(new Set(chain)).filter(Boolean);
}
