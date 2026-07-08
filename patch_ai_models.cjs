const fs = require('fs');
let file = 'server/ai/client.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('return "gemini-1.5-pro";', 'return "gemini-1.5-pro-002";');
content = content.replace('return "gemini-1.5-flash";', 'return "gemini-1.5-flash-002";');
content = content.replace('return "imagen-3.0-generate-001";', 'return "imagen-3.0-generate-001";'); // no change
content = content.replace('if (!model) return "gemini-1.5-flash";', 'if (!model) return "gemini-1.5-flash-002";');

fs.writeFileSync(file, content);
