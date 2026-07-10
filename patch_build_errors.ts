import fs from 'fs';

// 1. Fix server/rag/routes.ts
let routes = fs.readFileSync('server/rag/routes.ts', 'utf8');
routes = routes.replace(
  "fullText += \\`\\\\n\\\\n--- Page \\${i} ---\\\\n\\\\n\\` + pageText;",
  "fullText += '\\n\\n--- Page ' + i + ' ---\\n\\n' + pageText;"
);
// Also the other backticks if any
routes = routes.replace(/\\`/g, '`');
routes = routes.replace(/\\\\n/g, '\\n');
routes = routes.replace(/\\\${/g, '${');

fs.writeFileSync('server/rag/routes.ts', routes);

// 2. Fix server/ai/respond.ts
if (fs.existsSync('server/ai/respond.ts')) {
  let respond = fs.readFileSync('server/ai/respond.ts', 'utf8');
  respond = respond.replace('../knowledge/retrieve', '../rag/retrieve');
  fs.writeFileSync('server/ai/respond.ts', respond);
}

// 3. Fix server/rag/retrieve.ts
let retrieve = fs.readFileSync('server/rag/retrieve.ts', 'utf8');
retrieve = retrieve.replace('const uniqueSources = new Map<string, any>();\n  const db = getAdminDb();', 'const uniqueSources = new Map<string, any>();');
fs.writeFileSync('server/rag/retrieve.ts', retrieve);

