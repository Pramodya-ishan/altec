import fs from 'fs';
let p = fs.readFileSync('server/ai/client.ts', 'utf8');

p = p.replace(/process\.env\.GEMINI_DEFAULT_MODEL \|\| "gemini-3.5-flash"/g, 'process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash"');
p = p.replace(/process\.env\.GEMINI_FAST_MODEL \|\| "gemini-3.1-flash-lite"/g, 'process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"');
p = p.replace(/process\.env\.GEMINI_PDF_QA_MODEL \|\| "gemini-3.5-flash"/g, 'process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"');

fs.writeFileSync('server/ai/client.ts', p);
