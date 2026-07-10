const fs = require('fs');
const content = fs.readFileSync('server/pdf/directPdfQa.ts', 'utf8');
const fixed = content.replace(/let aiClient: GoogleGenAI[\s\S]*?return aiClient;\n}/, `import { getAIClient as globalGetAIClient } from "../ai/client";
function getAIClient() { return globalGetAIClient(); }`);
fs.writeFileSync('server/pdf/directPdfQa.ts', fixed);
