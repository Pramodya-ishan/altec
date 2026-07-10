import fs from 'fs';
let content = fs.readFileSync('server/knowledge/routes.ts', 'utf8');

const pdfRoutes = `
knowledgeRoutes.post("/ingest-pdf-base64", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { title, subject, lesson, sourceType, year, medium, pdfBase64, originalFileName } = req.body;
    
    if (!title || !subject || !sourceType || !pdfBase64) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js").catch(() => null);
    if (!pdfjsLib) {
      return res.status(500).json({ ok: false, error: "PDF library not available" });
    }

    const pdfData = Buffer.from(pdfBase64, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += \`\\n\\n--- Page \${i} ---\\n\\n\` + pageText;
    }
    
    if (fullText.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "PDF_TEXT_EXTRACTION_FAILED" });
    }

    const result = await processAndIngestText(fullText, {
      title,
      subject,
      lesson,
      sourceType,
      year,
      medium,
      createdBy: user.uid,
      originalFileName,
      sourceIdBase: \`pdf_\${Date.now()}\`
    });

    res.json({ ok: true, sourceId: result.sourceId, chunkCount: result.chunkCount });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "PDF_TEXT_EXTRACTION_FAILED" });
  }
});

knowledgeRoutes.post("/ingest-text", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { title, subject, lesson, sourceType, year, medium, text, originalFileName } = req.body;
    
    if (!title || !subject || !sourceType || !text) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const result = await processAndIngestText(text, {
      title,
      subject,
      lesson,
      sourceType,
      year,
      medium,
      createdBy: user.uid,
      originalFileName,
      sourceIdBase: \`txt_\${Date.now()}\`
    });

    res.json({ ok: true, sourceId: result.sourceId, chunkCount: result.chunkCount });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
`;

if (!content.includes('ingest-pdf-base64')) {
  content = content.replace(
    'export const knowledgeRoutes = Router();',
    'export const knowledgeRoutes = Router();\n' + pdfRoutes
  );
  fs.writeFileSync('server/knowledge/routes.ts', content);
}
