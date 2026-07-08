const fs = require('fs');
let file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const fs = require\('fs'\);\n/, '');

fs.writeFileSync(file, content);
