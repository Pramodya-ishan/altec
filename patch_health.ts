import fs from 'fs';

let content = fs.readFileSync('server/ai/routes.ts', 'utf8');
content = content.replace(
  /export const aiRoutes = Router\(\);/,
  `export const aiRoutes = Router();\n\n// GET /api/ai/health\naiRoutes.get("/health", async (req, res) => {\n  try {\n    const db = require("../firebase/admin").getAdminDb();\n    let dbStatus = "unknown";\n    try {\n      await db.collection("users").limit(1).get();\n      dbStatus = "connected";\n    } catch (e: any) {\n      dbStatus = "error: " + e.message;\n    }\n    \n    const ai = require("./client").getAIClient();\n    let aiStatus = "unknown";\n    try {\n      await ai.models.generateContent({\n        model: process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash",\n        contents: "hi"\n      });\n      aiStatus = "ready";\n    } catch (e: any) {\n      aiStatus = "error: " + e.message;\n    }\n    \n    res.json({\n      ok: true,\n      database: dbStatus,\n      ai: aiStatus,\n      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "unknown"\n    });\n  } catch (error: any) {\n    res.status(500).json({ ok: false, error: error.message });\n  }\n});`
);

fs.writeFileSync('server/ai/routes.ts', content);
