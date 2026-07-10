import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace('import { knowledgeRoutes } from "./server/knowledge/routes";', 'import { ragRoutes } from "./server/rag/routes";');
content = content.replace('app.use("/api/knowledge", knowledgeRoutes);', 'app.use("/api/rag", ragRoutes);');
fs.writeFileSync('server.ts', content);
