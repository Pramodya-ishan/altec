import fs from 'fs';
let code = fs.readFileSync('server/rag/routes.ts', 'utf-8');

code = code.replace(/ragRoutes\.post\("\/upload", async \(req, res\) => \{[\s\S]*?\}\);/m, 
`ragRoutes.post("/upload", async (req, res) => {
  try {
    const user = await requireUser(req);
    // reject anonymous users with LOGIN_REQUIRED
    if (!user || user.uid.startsWith('anonymous') || (!user.email && process.env.DEV_BYPASS_AUTH !== 'true')) {
        return res.status(401).json({ ok: false, code: "LOGIN_REQUIRED", message: "PDF upload requires a logged-in account." });
    }

    const { title, subject, year, paperType, pdfBase64, fileName, mimeType = "application/pdf" } = req.body;
    
    if (!pdfBase64 || !fileName) {
      return res.status(400).json({ ok: false, code: "MISSING_FIELDS", message: "Missing required fields" });
    }

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js").catch(() => null);
    if (!pdfjsLib) {
      return res.status(500).json({ ok: false, code: "PDF_LIB_MISSING", message: "PDF library not available" });
    }
    
    // Silence canvas warnings
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");

    // 1. Extract text
    const pdfData = Buffer.from(pdfBase64, 'base64');
    let fullText = "";
    let needsOcr = false;

    try {
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(pdfData),
        disableFontFace: true,
        verbosity: 0
      });
      const pdf = await loadingTask.promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += '\n\n' + pageText;
      }
    } catch (e: any) {
      console.warn("PDF extraction warning:", e.message);
      needsOcr = true;
    }

    if (fullText.trim().length === 0) {
      needsOcr = true;
    }

    // 2. Upload to Firebase Storage
    const storage = getAdminStorage();
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9.\\-_]/g, '_');
    const storagePath = \`rag_uploads/\${user.uid}/\${timestamp}_\${safeFileName}\`;
    let downloadUrl = "";
    try {
        const file = storage.bucket().file(storagePath);
        await file.save(pdfData, {
          metadata: { contentType: mimeType }
        });
        await file.makePublic().catch(() => {});
        downloadUrl = \`https://storage.googleapis.com/\${storage.bucket().name}/\${storagePath}\`;
    } catch(e: any) {
        return res.status(500).json({ ok: false, code: "STORAGE_UPLOAD_FAILED", message: e.message || "Failed to upload to storage" });
    }

    // 3. Write rag_sources
    const db = getAdminDb();
    const sourceRef = db.collection("rag_sources").doc();
    const sourceId = sourceRef.id;
    try {
        await sourceRef.set({
          ownerUid: user.uid,
          ownerEmail: user.email || "unknown",
          title: title || fileName,
          fileName,
          storagePath,
          downloadUrl,
          mimeType,
          size: pdfData.length,
          subject: subject || null,
          year: year || null,
          paperType: paperType || null,
          visibility: "private",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
    } catch(e: any) {
        // delete from storage if DB write failed
        storage.bucket().file(storagePath).delete().catch(() => {});
        return res.status(500).json({ ok: false, code: "DB_WRITE_FAILED", message: e.message || "Failed to save to database" });
    }

    // 4. Chunk and write rag_chunks
    let chunkCount = 0;
    if (!needsOcr) {
      const words = fullText.split(/\\s+/);
      const chunkSize = 1000;
      const batch = db.batch();
      
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkText = words.slice(i, i + chunkSize).join(" ");
        const chunkRef = db.collection("rag_chunks").doc();
        batch.set(chunkRef, {
          sourceId,
          ownerUid: user.uid,
          text: chunkText,
          chunkIndex: chunkCount++,
          subject: subject || null,
          year: year || null,
          tags: [title || fileName, subject].filter(Boolean),
          visibility: "private",
          embeddingStatus: "none",
          createdAt: new Date().toISOString()
        });
      }
      
      if (chunkCount > 0) {
        await batch.commit().catch(e => {
             console.warn("Chunks batch commit failed:", e.message);
        });
      }
    }
    
    if (needsOcr) {
       res.json({ ok: true, sourceId, fileUrl: downloadUrl, chunkCount: 0, needsOcr: true, message: "PDF text extract කරන්න බැහැ. OCR අවශ්‍යයි." });
    } else {
       res.json({ ok: true, sourceId, fileUrl: downloadUrl, chunkCount, needsOcr: false });
    }

  } catch (error: any) {
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: error.message || "Upload failed" });
  }
});`);

fs.writeFileSync('server/rag/routes.ts', code);
