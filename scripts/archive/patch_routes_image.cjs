const fs = require('fs');
let file = 'server/ai/routes.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
// Main Respond endpoint
aiRoutes.post("/respond", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    if (req.body.mode === 'image_generation') {
        const { generateEducationalImage } = await import("../image/generate");
        const result = await generateEducationalImage(req);
        if (!result.ok) res.status(500).json(result);
        else res.json(result);
        return;
    }

    const result = await processAIRequest(req);
    if (!result.ok) {
       res.status(result.code === 'QUOTA_EXCEEDED' ? 429 : 500).json(result);
    } else {
       res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
`;

content = content.replace(/\/\/ Main Respond endpoint[\s\S]*?\} catch \(error: any\) \{\s*\n\s*res\.status\(500\)\.json\(\{ ok: false, error: error\.message \}\);\s*\n\s*\}\s*\n\}\);/, replacement.trim());

fs.writeFileSync(file, content);
