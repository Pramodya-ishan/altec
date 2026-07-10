import fs from 'fs';
let content = fs.readFileSync('server/ai/respondStream.ts', 'utf8');

content = content.replace(/\\`/g, '`');
content = content.replace(/\\\${/g, '${');

fs.writeFileSync('server/ai/respondStream.ts', content);
