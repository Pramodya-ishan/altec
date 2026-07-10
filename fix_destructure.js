import fs from 'fs';
let p = fs.readFileSync('server/pdf/routes.ts', 'utf8');
p = p.replace(/const \{ sourceId, prompt: effectivePrompt, questionId/g, 'const { sourceId, prompt, questionId');
fs.writeFileSync('server/pdf/routes.ts', p);
