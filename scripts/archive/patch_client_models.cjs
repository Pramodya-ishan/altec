const fs = require('fs');
let file = 'server/ai/client.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
// Map fake models to real ones to avoid NOT_FOUND errors
function mapModel(model) {
  if (!model) return "gemini-1.5-flash";
  if (model.includes("gemini-3") || model.includes("gemini-2")) {
     if (model.includes("image")) return "imagen-3.0-generate-001";
     if (model.includes("pro")) return "gemini-1.5-pro";
     return "gemini-1.5-flash";
  }
  return model;
}

export const AI_MODELS = {
  default: mapModel(process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash"),
  pro: mapModel(process.env.GEMINI_PRO_MODEL || "gemini-3-pro"),
  fast: mapModel(process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"),
  image: mapModel(process.env.NANO_BANANA_MODEL || "gemini-3.1-flash-image"),
  imagePro: mapModel(process.env.NANO_BANANA_PRO_MODEL || "gemini-3-pro-image"),
};
`;

content = content.replace(/export const AI_MODELS = \{[\s\S]*?\};/, replacement.trim());
fs.writeFileSync(file, content);
