import fs from 'fs';
let p = fs.readFileSync('server/ai/routes.ts', 'utf8');

p = p.replace(
  /models: \{/,
  `directPdfQa: { mode: "frontend_blob_to_gemini", requiresGcs: false, available: true },
      ocr: { available: false },
      models: {
        tts: { available: false },
        fast: { configured: process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash" },`
);
fs.writeFileSync('server/ai/routes.ts', p);
