import fs from 'fs';

let content = fs.readFileSync('server/ai/routes.ts', 'utf8');

const healthEndpoint = `
aiRoutes.get("/model-health", async (req, res) => {
  try {
    const { aiBillingCircuitOpenUntil } = require("./modelRouter");
    const isExhausted = Date.now() < aiBillingCircuitOpenUntil;
    
    res.json({
      ok: true,
      billing: {
        status: isExhausted ? "exhausted" : "ok",
        circuitOpenUntil: aiBillingCircuitOpenUntil
      },
      models: {
        [process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview"]: { available: !isExhausted },
        [process.env.GEMINI_NORMAL_MODEL || "gemini-3.5-flash"]: { available: !isExhausted },
        [process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash"]: { available: !isExhausted },
        [process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite"]: { available: !isExhausted },
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
`;

content = content.replace("export const aiRoutes = Router();", "export const aiRoutes = Router();\n" + healthEndpoint);

fs.writeFileSync('server/ai/routes.ts', content);
