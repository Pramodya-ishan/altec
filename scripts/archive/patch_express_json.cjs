const fs = require('fs');
let file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/app\.use\(express\.json\(\)\);/, "app.use(express.json({ limit: '50mb' }));");
fs.writeFileSync(file, content);
