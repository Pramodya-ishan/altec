const fs = require('fs');
let file = 'server/ai/routes.ts';
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('/respond-stream')) {
    content = content.replace(/\/\/ Main Respond endpoint/, 
        `import { aiRespondStream } from "./respondStream";\n\naiRoutes.post("/respond-stream", async (req, res) => {\n  try {\n    const user = await requireUser(req);\n    (req as any).user = user;\n    await aiRespondStream(req, res);\n  } catch (error: any) {\n    res.status(500).json({ ok: false, error: error.message });\n  }\n});\n\n// Main Respond endpoint`);
    fs.writeFileSync(file, content);
}
