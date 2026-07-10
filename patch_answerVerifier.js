import fs from 'fs';
let content = fs.readFileSync('server/ai-core/answer/answerVerifier.ts', 'utf8');

content = content.replace("    };\n       }\n    }", "    }");

fs.writeFileSync('server/ai-core/answer/answerVerifier.ts', content);
