import fs from 'fs';
let p = fs.readFileSync('server/pdf/routes.ts', 'utf8');
p = p.replace(/prompt,/g, 'prompt: effectivePrompt,');
fs.writeFileSync('server/pdf/routes.ts', p);
