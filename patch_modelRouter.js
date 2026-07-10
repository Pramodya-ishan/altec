import fs from 'fs';
let p = fs.readFileSync('server/ai/modelRouter.ts', 'utf8');

p = p.replace(/process\.env\.GEMINI_NORMAL_MODEL \|\| "gemini-3.5-flash"/g, 'process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash"');
p = p.replace(/process\.env\.GEMINI_FAST_MODEL \|\| "gemini-3.1-flash-lite"/g, 'process.env.GEMINI_FAST_MODEL || "gemini-2.5-flash"');

fs.writeFileSync('server/ai/modelRouter.ts', p);
