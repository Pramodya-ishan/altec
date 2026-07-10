import fs from 'fs';
let content = fs.readFileSync('server/pdf/routes.ts', 'utf8');

const regex = /\/\/ 5\. Direct Gemini PDF Question Answering \(Zero-GCS-Auth Path\)\npdfRoutes\.post\("\/direct-qa-file", requireFirebaseUser, upload\.single\("file"\), async \(req: any, res\) => \{[\s\S]*?\}\);\n/m;

const newBlock = `// 5. Direct Gemini PDF Question Answering (Zero-GCS-Auth Path)
const inFlightDirectQa = new Map<string, Promise<any>>();
pdfRoutes.post("/direct-qa-file", requireFirebaseUser, upload.single("file"), async (req: any, res) => {
  try {
    const { sourceId, prompt, questionId, questionNo, questionType, subject, year } = req.body;
    console.log(\`[DirectPDFQA] Received request for sourceId: \${sourceId}, questionNo: \${questionNo}\`);
    
    let fileHashOrSize = "";
    if (req.file) {
      fileHashOrSize = String(req.file.buffer.length);
    }
    const idempotencyKey = \`\${req.user.uid}_\${sourceId}_\${questionType}_\${questionNo}_\${fileHashOrSize}\`;
    
    if (inFlightDirectQa.has(idempotencyKey)) {
      console.log(\`[DirectPDFQA] Duplicate request detected for \${idempotencyKey}, attaching to existing promise.\`);
      try {
        const result = await inFlightDirectQa.get(idempotencyKey);
        return res.json({ ok: true, ...result });
      } catch (e: any) {
        return res.status(500).json({ ok: false, errorCode: "DIRECT_QA_BACKEND_ERROR", error: e.message });
      }
    }
    
    const requestPromise = async () => {
      let buffer: Buffer;
      if (req.file) {
        buffer = req.file.buffer;
        console.log(\`[DirectPDFQA] File received via upload. Buffer size: \${buffer.length} bytes\`);
      } else {
        console.error("[DirectPDFQA] Missing file buffer or storagePath in request");
        return { ok: false, status: 400, errorCode: "DIRECT_QA_MISSING_FILE", error: "Missing uploaded file buffer or storagePath." };
      }
      if (!prompt) {
        console.error("[DirectPDFQA] Missing prompt");
        return { ok: false, status: 400, error: "Missing prompt." };
      }
      if (!questionNo || !questionType) {
        console.error("[DirectPDFQA] Missing questionNo or questionType");
        return {
          ok: false,
          status: 400,
          found: false,
          errorCode: "DIRECT_QA_MISSING_STRUCTURED_INTENT",
          stage: "VALIDATION",
          message: "Direct PDF QA requires questionNo and questionType."
        };
      }
      if (questionNo && questionType) {
        console.log(\`[DirectPDFQA] Using structured extraction for \${questionType} \${questionNo}\`);
        const { askGeminiDirectPdfStructured } = await import("../ai-core/pdf/directPdfQa");
        const result = await askGeminiDirectPdfStructured({
          uid: req.user.uid,
          sourceId: sourceId || "uploaded_temp",
          pdfBuffer: buffer,
          year: year || "unknown",
          subject: subject || "unknown",
          questionType,
          questionNo,
          prompt,
        });
        console.log(\`[DirectPDFQA] Structured extraction result: \${result.found ? "FOUND" : "NOT_FOUND"}\`);
        if (!result.ok || !result.found || !result.sourceEvidence?.questionText) {
          return {
            ok: false,
            found: false,
            errorCode: result.errorCode || "EXACT_QUESTION_EVIDENCE_MISSING",
            stage: result.stage || "MODEL_CALL",
            reason: result.reason || "Question evidence not found in PDF.",
            error: result.error
          };
        }
        return {
          ok: true,
          ...result
        };
      }
      console.log("[DirectPDFQA] Using general extraction");
      const result = await askGeminiDirectPdf({
        sourceId: sourceId || "uploaded_temp",
        pdfBuffer: buffer,
        prompt,
        questionId,
        subject,
        year,
      });
      if (result.answer) {
        result.answer = stripRawVisualBlocks(result.answer);
      }
      console.log(\`[DirectPDFQA] General extraction result: \${result.answer ? "SUCCESS" : "EMPTY"}\`);
      return {
        ok: true,
        ...result
      };
    };
    
    inFlightDirectQa.set(idempotencyKey, requestPromise());
    try {
      const result = await inFlightDirectQa.get(idempotencyKey);
      inFlightDirectQa.delete(idempotencyKey);
      if (result.status) {
         const { status, ...rest } = result;
         return res.status(status).json(rest);
      }
      return res.json(result);
    } catch (err: any) {
      inFlightDirectQa.delete(idempotencyKey);
      throw err;
    }
  } catch (err: any) {
    console.error("[DirectPDFQA] Backend error:", err);
    return res.status(500).json({ 
       ok: false, 
       found: false,
       errorCode: err.errorCode || "DIRECT_QA_BACKEND_FAILED",
       stage: err.stage || "MODEL_CALL",
       message: err.message || "Direct PDF QA failed"
    });
  }
});
`;

content = content.replace(regex, newBlock);
fs.writeFileSync('server/pdf/routes.ts', content);
