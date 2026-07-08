import fs from "fs";
import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

export function prepareGoogleCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = "/tmp/google-credentials.json";
    try {
      let credStr = raw.trim();
      if (!credStr.startsWith('{')) credStr = '{' + credStr;
      if (!credStr.endsWith('}')) credStr = credStr + '}';
      JSON.parse(credStr);
      fs.writeFileSync(filePath, credStr, { mode: 0o600 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
    } catch (e) {
      console.error("Failed to parse and write GOOGLE_APPLICATION_CREDENTIALS_JSON", e);
    }
  }
}

export function getAIClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;

  prepareGoogleCredentials();

  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

  cachedClient = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || "al-ai-chat",
    location: location,
  });

  return cachedClient;
}

function mapModel(model: string, defaultFallback: string) {
  if (!model) return defaultFallback;
  return model;
}

export const AI_MODELS = {
  default: mapModel(process.env.GEMINI_DEFAULT_MODEL || "", "gemini-2.5-flash"),
  pro: mapModel(process.env.GEMINI_PRO_MODEL || "", "gemini-2.5-pro"),
  fast: mapModel(process.env.GEMINI_FAST_MODEL || "", "gemini-2.0-flash"),
  image: mapModel(process.env.GEMINI_IMAGE_MODEL || process.env.NANO_BANANA_MODEL || "", "imagen-3.0-generate-001"),
  imagePro: mapModel(process.env.GEMINI_IMAGE_PRO_MODEL || process.env.NANO_BANANA_PRO_MODEL || "", "imagen-3.0-generate-001"),
};

export function getModelFallbackChain(requestedModel?: string): string[] {
  const chain: string[] = [];
  if (requestedModel) {
    chain.push(requestedModel);
  }
  chain.push(AI_MODELS.fast);
  chain.push(AI_MODELS.default);
  chain.push(AI_MODELS.pro);
  return Array.from(new Set(chain));
}
