import fs from 'fs';
let code = fs.readFileSync('server/ai/client.ts', 'utf-8');

code = code.replace(/export function getModelFallbackChain\([\s\S]*?\}\n/g, 
`export function getModelFallbackChain(requestedModel?: string): string[] {
  const chain: string[] = [];
  if (requestedModel) chain.push(requestedModel);
  chain.push(process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview");
  chain.push("gemini-3-pro-preview");
  chain.push("gemini-2.5-pro");
  chain.push("gemini-2.5-flash");
  return Array.from(new Set(chain));
}
`);

// The previous script probably left garbage. Let's rewrite the whole file just to be safe.
const freshClient = `
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
  default: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",
  pro: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
  fast: process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash",
  search: process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash",
  urlContext: process.env.GEMINI_URL_CONTEXT_MODEL || "gemini-3.1-pro-preview",
};

export function getModelFallbackChain(requestedModel?: string): string[] {
  const chain: string[] = [];
  if (requestedModel) chain.push(requestedModel);
  chain.push(AI_MODELS.pro);
  chain.push("gemini-3-pro-preview");
  chain.push("gemini-2.5-pro");
  chain.push(AI_MODELS.default);
  chain.push("gemini-2.5-flash");
  return Array.from(new Set(chain)).filter(Boolean);
}
`;
fs.writeFileSync('server/ai/client.ts', freshClient.trim() + "\\n");
