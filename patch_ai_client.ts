import fs from 'fs';
let code = fs.readFileSync('server/ai/client.ts', 'utf-8');

code = code.replace(/export const AI_MODELS = \{[\s\S]*?\};/m, 
`export const AI_MODELS = {
  default: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",
  pro: process.env.GEMINI_PRO_MODEL || "gemini-3.1-pro-preview",
  fast: process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash",
  search: process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash",
  urlContext: process.env.GEMINI_URL_CONTEXT_MODEL || "gemini-3.1-pro-preview",
};`);

code = code.replace(/export function getModelFallbackChain\([\s\S]*?\}\n/m, 
`export function getModelFallbackChain(requestedModel?: string): string[] {
  const chain: string[] = [];
  if (requestedModel) chain.push(requestedModel);
  chain.push("gemini-3-pro-preview");
  chain.push("gemini-2.5-pro");
  chain.push("gemini-2.5-flash");
  return Array.from(new Set(chain));
}`);

fs.writeFileSync('server/ai/client.ts', code);
