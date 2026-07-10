import { getAIClient } from "../ai/client";
import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { requireFirebaseUser, requireNonAnonymousUser } from "../firebase/authMiddleware";
import { getAdminDb, getAdminBucket, getAdminDbInfo } from "../firebase/admin";
import { extractPdfText } from "../pdf/extractText";
import { retryGoogleAuthOperation } from "../utils/retry";
import multer from "multer";
import { invalidateInventoryCache, computeIndexStatus } from "../sources/sourceInventoryService";

export const ragRoutes = Router();
const upload = multer({ storage: multer.memoryStorage() });

export function normalizeSubject(sub: string): string {
  const s = (sub || "").trim().toUpperCase();
  if (s.includes("SFT") || s.includes("SCIENCE")) return "SFT";
  if (s.includes("ET") || s.includes("ENGINEERING")) return "ET";
  if (s.includes("ICT") || s.includes("INFORMATION")) return "ICT";
  return s || "SFT";
}

const isPermissionError = (err: any) => {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("permission_denied") ||
    msg.includes("permission denied") ||
    err?.code === 7 ||
    err?.status === 7
  );
};

export function detectQuestionNo(text: string): string | null {
  const lower = text.toLowerCase();
  if (
    lower.includes("q1") ||
    lower.includes("question 1") ||
    lower.includes("question 01") ||
    lower.includes("ප්‍රශ්නය 1") ||
    lower.includes("ප්‍රශ්නය 01") ||
    lower.includes("ප්රශ්නය 1") ||
    lower.includes("ප්රශ්නය 01") ||
    lower.includes("පළමු") ||
    lower.includes("පළවෙනි") ||
    /(?:^|\s|\n)0?1\.\s/.test(lower)
  ) {
    return "Q1";
  }

  if (
    lower.includes("q2") ||
    lower.includes("question 2") ||
    lower.includes("question 02") ||
    lower.includes("ප්‍රශ්නය 2") ||
    lower.includes("ප්‍රශ්නය 02") ||
    lower.includes("ප්රශ්නය 2") ||
    lower.includes("ප්රශ්නය 02") ||
    lower.includes("දෙවන") ||
    lower.includes("දෙවෙනි") ||
    /(?:^|\s|\n)0?2\.\s/.test(lower)
  ) {
    return "Q2";
  }

  if (
    lower.includes("q3") ||
    lower.includes("question 3") ||
    lower.includes("question 03") ||
    lower.includes("ප්‍රශ්නය 3") ||
    lower.includes("ප්‍රශ්නය 03") ||
    lower.includes("ප්රශ්නය 3") ||
    lower.includes("ප්රශ්නය 03") ||
    lower.includes("තුන්වන") ||
    lower.includes("තුන්වෙනි") ||
    /(?:^|\s|\n)0?3\.\s/.test(lower)
  ) {
    return "Q3";
  }

  return null;
}

// 1. Download/Signed URL for sources
ragRoutes.get("/sources/:sourceId/download", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();
    
    const docRef = db.collection("rag_sources").doc(sourceId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found" });
    }
    
    const data = docSnap.data();
    if (!data || !data.storagePath) {
      return res.status(404).json({ ok: false, error: "Storage path not found" });
    }
    
    // Ensure only the owner of the source document can download the file
    if (data.ownerUid !== user.uid) {
      return res.status(403).json({ ok: false, error: "Unauthorized access to source. Only the owner of the source document can download the file." });
    }
    
    const bucket = getAdminBucket();
    const file = bucket.file(data.storagePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ ok: false, error: "File not found in storage" });
    }
    
    const shouldStream = req.query.stream === "true";
    
    if (!shouldStream) {
      // Try to create a signed URL first (valid for 15 mins) and redirect
      try {
        const [signedUrl] = await retryGoogleAuthOperation("sourcesGetSignedUrl", async () => {
          return await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 mins
          });
        });
        return res.redirect(signedUrl);
      } catch (signErr) {
        console.warn("Failed to generate signed URL, falling back to direct stream:", signErr);
      }
    }
    
    // Fallback: direct stream
    res.setHeader("Content-Type", data.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(data.fileName || "source.pdf")}"`);
    file.createReadStream().pipe(res);
  } catch (e: any) {
    if (isPermissionError(e)) {
      return res.status(403).json({
        ok: false,
        code: "FIRESTORE_PERMISSION_DENIED",
        message: "Firestore/Storage Admin permission issue. Check backend health."
      });
    }
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 2. Upload and chunk RAG sources
ragRoutes.post("/upload", upload.single("file"), requireNonAnonymousUser, async (req: any, res) => {
  return res.status(400).json({
    ok: false,
    code: "USE_CLIENT_STORAGE_UPLOAD",
    recommendedUploadMode: "client_firebase_storage",
    message: "Firebase Admin Storage is degraded in this workspace. Please use client-side storage uploads directly."
  });
});

ragRoutes.post("/ingest-uploaded", upload.single("file"), requireNonAnonymousUser, async (req: any, res) => {
  try {
    const user = req.user;
    const {
      sourceId,
      storagePath,
      title,
      subject,
      lesson,
      resourceType,
      sourceType,
      sourceScope,
      year,
      medium
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Missing uploaded file." });
    }
    if (!sourceId || !storagePath) {
      return res.status(400).json({ ok: false, error: "Missing sourceId or storagePath." });
    }

    const expectedPrefix1 = `users/${user.uid}/`;
    const expectedPrefix2 = `rag_uploads/${user.uid}/`;
    if (!storagePath.startsWith(expectedPrefix1) && !storagePath.startsWith(expectedPrefix2)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid storage path. Must belong to the authenticated user."
      });
    }

    // Extract text from the uploaded file buffer
    const pdfData = req.file.buffer;
    const extraction = await extractPdfText(pdfData);
    const fullText = extraction.text;
    const needsOcr = extraction.needsOcr;
    const needsLegacyConversion = extraction.needsLegacyConversion || false;
    const textEncoding = extraction.textEncoding || "unknown";

    const db = getAdminDb();
    
    // Create source document
    const indexStatus = "processing";
    const textIndexedInit = false;

    const sourceDoc = {
      ownerUid: user.uid,
      ownerEmail: user.email || "unknown",
      title: title || req.file.originalname,
      fileName: req.file.originalname,
      storagePath,
      mimeType: req.file.mimetype,
      size: pdfData.length,
      subject: normalizeSubject(subject || ""),
      lesson: lesson || null,
      subtopic: null,
      sourceType: sourceType || resourceType || null,
      resourceType: resourceType || null,
      medium: medium || "Sinhala",
      tags: [title || req.file.originalname, subject].filter(Boolean),
      year: year ? String(year) : null,
      paperType: null,
      sourceScope: sourceScope || "personal",
      visibility: sourceScope === "official" ? "official" : "private",
      chunkCount: 0,
      needsOcr,
      needsLegacyConversion,
      textEncoding,
      textIndexed: textIndexedInit,
      indexStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // We write to Firestore
    try {
      const sourceRef = db.collection("rag_sources").doc(sourceId);
      await sourceRef.set(sourceDoc);
    } catch (e: any) {
      console.error("Firestore write failed for source metadata:", e);
      return res.status(500).json({
        ok: false,
        code: "FIRESTORE_WRITE_FAILED",
        message: "PDF Storage upload done, but Firestore metadata failed."
      });
    }

    let chunkCount = 0;
    if (!needsOcr && extraction.pages) {
      const batch = db.batch();

      for (const p of extraction.pages) {
        const pageText = p.text.trim();
        if (!pageText) continue;

        const questionNo = detectQuestionNo(pageText);

        const chunkRef = db.collection("rag_chunks").doc();
        const chunkId = chunkRef.id;

        const chunkDoc = {
          sourceId,
          pageNumber: p.pageNumber,
          questionNo: questionNo || null,
          ownerUid: user.uid,
          ownerEmail: user.email || "unknown",
          text: pageText,
          rawTextPreview: p.rawText ? p.rawText.slice(0, 200) : pageText.slice(0, 200),
          textEncoding: p.textEncoding || "unknown",
          conversionApplied: p.conversionApplied || false,
          conversionConfidence: p.conversionConfidence || 0,
          chunkIndex: chunkCount++,
          title: title || req.file.originalname,
          fileName: req.file.originalname,
          subject: normalizeSubject(subject || ""),
          lesson: lesson || null,
          subtopic: null,
          resourceType: resourceType || null,
          year: year ? String(year) : null,
          medium: medium || "Sinhala",
          tags: [title || req.file.originalname, subject].filter(Boolean),
          sourceScope: sourceScope || "personal",
          visibility: sourceScope === "official" ? "official" : "private",
          embeddingStatus: "none",
          createdAt: new Date().toISOString()
        };

        batch.set(chunkRef, chunkDoc);

        if (sourceScope === "owner_syllabus") {
          const sylChunkRef = db.collection("users").doc(user.uid).collection("syllabus_chunks").doc(chunkId);
          batch.set(sylChunkRef, {
            id: chunkId,
            ...chunkDoc
          });
        }
      }

      if (chunkCount > 0) {
        try {
          await batch.commit();
        } catch (e: any) {
          console.error("Firestore batch commit failed for chunks:", e);
          return res.status(500).json({
            ok: false,
            code: "FIRESTORE_WRITE_FAILED",
            message: "PDF Storage upload done, but Firestore chunks failed."
          });
        }
      }
    }

    // Now always update source metadata across collections
    const finalIndexStatus = computeIndexStatus({
      chunkCount,
      needsOcr,
      needsLegacyConversion,
      textEncoding,
      indexStatus: chunkCount > 0 ? "ready" : "not_indexed"
    });
    const finalTextIndexed = chunkCount > 0 && !needsOcr;

    const metaUpdate = {
      chunkCount,
      needsOcr,
      needsLegacyConversion,
      textEncoding,
      textIndexed: finalTextIndexed,
      indexStatus: finalIndexStatus,
      updatedAt: new Date().toISOString()
    };

    try {
      await db.collection("rag_sources").doc(sourceId).update(metaUpdate);

      if (sourceScope === "past_paper") {
        await db.collection("past_papers").doc(sourceId).set({
          id: sourceId,
          sourceId,
          title: title || req.file.originalname,
          fileName: req.file.originalname,
          subject: normalizeSubject(subject || ""),
          year: year ? String(year) : "",
          category: "A/L Past Papers",
          paperType: resourceType || "Full Paper",
          type: resourceType || "Full Paper",
          resourceType: resourceType || "past_paper",
          sourceType: resourceType || "past_paper",
          sourceScope: "past_paper",
          storagePath,
          ownerUid: user.uid,
          ownerEmail: user.email || "unknown",
          uploaded: true,
          ...metaUpdate,
          createdAt: new Date().toISOString()
        });
      } else if (sourceScope === "owner_syllabus") {
        await db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId).set({
          id: sourceId,
          ...sourceDoc,
          status: finalIndexStatus,
          ...metaUpdate
        });
      } else if (sourceScope === "paper_structure") {
        await db.collection("rag_sources").doc(sourceId).update({
          lesson: lesson || null,
          sourceScope: "paper_structure",
          resourceType: "paper_structure"
        });
      }

      invalidateInventoryCache(user.uid);
    } catch (e: any) {
      console.error("Failed to update extra collections metadata:", e);
    }

    // Store in user's current chat context
    try {
      const chatCtxRef = db.collection("users").doc(user.uid).collection("chat_context").doc("current");
      const chatCtxSnap = await chatCtxRef.get();
      let temporaryPdfs = [];
      if (chatCtxSnap.exists) {
        const ctxData = chatCtxSnap.data();
        if (ctxData && Array.isArray(ctxData.temporaryPdfs)) {
          temporaryPdfs = ctxData.temporaryPdfs;
        }
      }
      const activePdf = {
        sourceId,
        fileName: req.file.originalname,
        title: title || req.file.originalname,
        storagePath,
        uploadedAt: new Date().toISOString(),
        subject: subject || null,
        resourceType: resourceType || null
      };
      if (!temporaryPdfs.some((p: any) => p.sourceId === sourceId)) {
        temporaryPdfs.push({
          sourceId,
          fileName: req.file.originalname,
          title: title || req.file.originalname,
          storagePath,
          uploadedAt: new Date().toISOString()
        });
      }
      await chatCtxRef.set({ activePdf, temporaryPdfs }, { merge: true });
    } catch (ctxErr: any) {
      console.warn("Failed to save to current chat context in /ingest-uploaded:", ctxErr.message);
    }

    return res.json({
      ok: true,
      sourceId,
      storagePath,
      fileName: req.file.originalname,
      title: title || req.file.originalname,
      chunkCount,
      needsOcr,
      needsLegacyConversion,
      textEncoding
    });

  } catch (error: any) {
    console.error("Error in ingest-uploaded endpoint:", error);
    res.status(500).json({
      ok: false,
      code: "FIRESTORE_WRITE_FAILED",
      message: "PDF Storage upload done, but Firestore metadata/chunks failed."
    });
  }
});


// 3. Create past paper doc
ragRoutes.post("/past-papers", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const {
      id,
      sourceId,
      title,
      fileName,
      subject,
      year,
      category,
      paperType,
      type,
      resourceType,
      sourceType,
      sourceScope,
      storagePath,
      chunkCount,
      needsOcr,
      createdAt,
      updatedAt
    } = req.body;

    const finalId = id || sourceId;
    if (!finalId) {
      return res.status(400).json({ ok: false, error: "Missing paper ID" });
    }

    const normSubject = normalizeSubject(subject || "");
    const db = getAdminDb();
    const paperDoc = {
      id: finalId,
      sourceId: finalId,
      title: title || fileName || "Untitled Past Paper",
      fileName: fileName || title || "untitled.pdf",
      subject: normSubject,
      year: String(year || ""),
      category: category || "A/L Past Papers",
      paperType: paperType || type || "Full Paper",
      type: paperType || type || "Full Paper",
      resourceType: resourceType || "past_paper",
      sourceType: sourceType || resourceType || "past_paper",
      sourceScope: sourceScope || "past_paper",
      storagePath: storagePath || null,
      ownerUid: req.user.uid,
      ownerEmail: req.user.email || "unknown",
      uploaded: true,
      chunkCount: Number(chunkCount || 0),
      needsOcr: needsOcr === true,
      textIndexed: Number(chunkCount || 0) > 0 && needsOcr !== true,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString()
    };

    await db.collection("past_papers").doc(finalId).set(paperDoc);
    invalidateInventoryCache(req.user.uid);

    res.json({ ok: true, doc: paperDoc });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Delete past paper
ragRoutes.delete("/past-papers/:id", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const sourceId = req.params.id;
    const db = getAdminDb();
    
    // Verify user owns the paper or is admin
    const ownerEmail = process.env.SYLLABUS_OWNER_EMAIL || "26002ishan@gmail.com";
    const isAdmin = req.user.email?.toLowerCase() === ownerEmail.toLowerCase();
    
    let storagePath: string | null = null;
    let pastPaperDeleted = false;
    let ragSourceDeleted = false;
    let chunksDeletedCount = 0;
    let syllabusChunksDeletedCount = 0;
    
    // Attempt past_papers doc check
    const ppDoc = await db.collection("past_papers").doc(sourceId).get();
    if (ppDoc.exists) {
      const data = ppDoc.data();
      if (data?.ownerUid !== req.user.uid && !isAdmin) {
        return res.status(403).json({ ok: false, error: "Unauthorized" });
      }
      storagePath = data?.storagePath || null;
      await db.collection("past_papers").doc(sourceId).delete();
      pastPaperDeleted = true;
    }
    
    // Attempt rag_sources doc check
    const sourceDoc = await db.collection("rag_sources").doc(sourceId).get();
    if (sourceDoc.exists) {
      const data = sourceDoc.data();
      if (data?.ownerUid !== req.user.uid && !isAdmin) {
        return res.status(403).json({ ok: false, error: "Unauthorized" });
      }
      if (!storagePath) {
        storagePath = data?.storagePath || null;
      }
      await db.collection("rag_sources").doc(sourceId).delete();
      ragSourceDeleted = true;
    }

    // Delete chunks
    const chunks = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const batch = db.batch();
    chunks.docs.forEach((d: any) => {
      batch.delete(d.ref);
      chunksDeletedCount++;
    });
    
    const sylChunks = await db.collection("users").doc(req.user.uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunks.docs.forEach((d: any) => {
      batch.delete(d.ref);
      syllabusChunksDeletedCount++;
    });

    const syllabusResources = await db.collection("users").doc(req.user.uid).collection("syllabus_resources").doc(sourceId).get();
    if (syllabusResources.exists) {
      batch.delete(syllabusResources.ref);
    }
    
    await batch.commit();

    // Optionally delete from storage
    let storageAttempted = false;
    let storageOk = false;
    let storageError: string | null = null;

    if (storagePath) {
      storageAttempted = true;
      try {
        const { getAdminBucket } = await import("../firebase/admin");
        const bucket = getAdminBucket();
        await bucket.file(storagePath).delete();
        storageOk = true;
      } catch (e: any) {
        console.warn("Admin Storage delete failed (expected if degraded):", e.message);
        storageError = e.message;
      }
    }
    
    invalidateInventoryCache(req.user.uid);
    
    res.json({
      ok: true,
      deleted: {
        pastPaper: pastPaperDeleted,
        ragSource: ragSourceDeleted,
        chunks: chunksDeletedCount,
        syllabusChunks: syllabusChunksDeletedCount
      },
      storageDelete: {
        attempted: storageAttempted,
        ok: storageOk,
        skipped: !storagePath,
        error: storageError
      }
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Delete individual RAG source

ragRoutes.delete("/sources/:sourceId", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();

    const docRef = db.collection("rag_sources").doc(sourceId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }

    const data = docSnap.data();
    if (!data) {
      return res.status(404).json({ ok: false, error: "Source data not found." });
    }

    const ownerEmail = process.env.SYLLABUS_OWNER_EMAIL || "26002ishan@gmail.com";
    const isAdmin = user.email?.toLowerCase() === ownerEmail.toLowerCase();

    // Check ownership
    if (data.ownerUid !== user.uid && !isAdmin) {
      return res.status(403).json({ ok: false, error: "ඔබට මෙම PDF එක මකා දැමීමට අවසර නැත." });
    }

    const storagePath = data.storagePath;

    // 1. Delete file from Storage if exists
    let storageAttempted = false;
    let storageOk = false;
    let storageError: string | null = null;

    if (storagePath) {
      storageAttempted = true;
      try {
        const bucket = getAdminBucket();
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          storageOk = true;
        }
      } catch (err: any) {
        console.warn("Storage deletion error (continuing):", err.message);
        storageError = err.message;
      }
    }

    // 2. Delete from DB using a batch write
    const batch = db.batch();

    // Delete from rag_sources
    batch.delete(docRef);

    // If it was a syllabus resource, delete from user sub-collections
    if (data.sourceScope === "owner_syllabus" || data.sourceScope === "past_paper") {
      const sylRef = db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId);
      batch.delete(sylRef);

      try {
        const sylChunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks")
          .where("sourceId", "==", sourceId)
          .get();
        sylChunksSnap.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
      } catch (err: any) {
        console.warn("Syllabus chunks query error (continuing):", err.message);
      }
    }

    // Delete from rag_chunks
    try {
      const chunksSnap = await db.collection("rag_chunks")
        .where("sourceId", "==", sourceId)
        .get();
      chunksSnap.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
    } catch (err: any) {
      console.warn("RAG chunks query error (continuing):", err.message);
    }

    await batch.commit();

    invalidateInventoryCache(user.uid);

    return res.json({
      ok: true,
      message: "PDF document deleted successfully.",
      storageDelete: {
        attempted: storageAttempted,
        ok: storageOk,
        skipped: !storagePath,
        error: storageError
      }
    });

  } catch (error: any) {
    console.error("Error deleting source:", error);
    if (isPermissionError(error)) {
      return res.status(403).json({
        ok: false,
        code: "FIRESTORE_PERMISSION_DENIED",
        message: "Firestore Admin/IAM permission issue."
      });
    }
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// 6. OCR client reindexing endpoint
ragRoutes.post("/reindex-uploaded", upload.single("file"), requireNonAnonymousUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { sourceId, pages, mode = "auto" } = req.body;
    
    if (!sourceId) {
      return res.status(400).json({ ok: false, error: "Missing sourceId." });
    }

    const db = getAdminDb();
    const sourceRef = db.collection("rag_sources").doc(sourceId);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found in rag_sources." });
    }

    const sourceData = sourceSnap.data();
    const ownerEmail = process.env.SYLLABUS_OWNER_EMAIL || "26002ishan@gmail.com";
    const isAdmin = user.email?.toLowerCase() === ownerEmail.toLowerCase();
    if (sourceData?.ownerUid !== user.uid && !isAdmin) {
      return res.status(403).json({ ok: false, error: "Unauthorized to reindex this source." });
    }

    let chunkCount = 0;
    let needsOcr = sourceData?.needsOcr || false;
    let needsLegacy = sourceData?.needsLegacyConversion || false;
    let textEncoding = sourceData?.textEncoding || "unknown";

    const title = sourceData?.title || "Reindexed Document";
    const fileName = sourceData?.fileName || "document.pdf";
    const subject = sourceData?.subject || "SFT";
    const lesson = sourceData?.lesson || null;
    const resourceType = sourceData?.resourceType || "uploaded_pdf";
    const year = sourceData?.year || null;
    const medium = sourceData?.medium || "Sinhala";
    const sourceScope = sourceData?.sourceScope || "personal";

    const batch = db.batch();

    // 1. Delete old chunks
    const ragChunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    ragChunksSnap.docs.forEach((d: any) => {
      batch.delete(d.ref);
    });

    const sylChunksSnap = await db.collection("users").doc(user.uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunksSnap.docs.forEach((d: any) => {
      batch.delete(d.ref);
    });

    let finalPages: any[] = [];
    let isOcrRun = false;
    let isOcrFailed = false;

    let pdfData: Buffer | null = null;
    if (req.file) {
      pdfData = req.file.buffer;
    } else if (!pages && sourceData?.storagePath) {
      try {
        const bucket = getAdminBucket();
        const file = bucket.file(sourceData.storagePath);
        const [exists] = await file.exists();
        if (exists) {
          const [buffer] = await retryGoogleAuthOperation("fileDownload", async () => await file.download());
          pdfData = buffer;
        }
      } catch (err: any) {
        console.error("Failed to download PDF from storage for reindexing:", err);
      }
    }

    // 2. Either process newly uploaded/downloaded file OR use passed-in pages array
    if (pdfData) {
      if (mode === "text_extract") {
        const extraction = await extractPdfText(pdfData);
        needsOcr = extraction.needsOcr;
        needsLegacy = extraction.needsLegacyConversion;
        textEncoding = extraction.textEncoding;
        if (!needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        }
      } else if (mode === "legacy_convert") {
        const extraction = await extractPdfText(pdfData);
        needsOcr = extraction.needsOcr;
        needsLegacy = true; // explicitly forced
        textEncoding = extraction.textEncoding;
        if (!needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        }
      } else if (mode === "ocr") {
        if (!process.env.GEMINI_API_KEY) {
          invalidateInventoryCache(user.uid);
          return res.json({
            ok: true,
            chunkCount: 0,
            needsOcr: true,
            indexStatus: "needs_ocr",
            ocrUnavailable: true,
            message: "OCR provider not configured"
          });
        }
        isOcrRun = true;
        try {
          const ai = getAIClient();
          const pdfBase64 = pdfData.toString("base64");
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64
                }
              },
              {
                text: "Extract all readable Sinhala/English text page-by-page from this Sri Lankan A/L Technology exam PDF. Preserve question numbers, MCQ numbers, diagrams descriptions, formulas. Return JSON pages [{pageNumber, text}]"
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  pages: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        pageNumber: { type: Type.INTEGER },
                        text: { type: Type.STRING }
                      },
                      required: ["pageNumber", "text"]
                    }
                  }
                },
                required: ["pages"]
              }
            }
          });

          const responseText = response.text || "";
          const parsed = JSON.parse(responseText);
          if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
            finalPages = parsed.pages;
            needsOcr = false;
            textEncoding = "ocr_sinhala";
            needsLegacy = false;
          } else {
            isOcrFailed = true;
          }
        } catch (err: any) {
          console.error("Gemini OCR failed:", err);
          isOcrFailed = true;
        }
      } else {
        // mode === "auto"
        const extraction = await extractPdfText(pdfData);
        needsOcr = extraction.needsOcr;
        needsLegacy = extraction.needsLegacyConversion;
        textEncoding = extraction.textEncoding;

        if (!needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        } else {
          if (process.env.GEMINI_API_KEY) {
            isOcrRun = true;
            try {
              const ai = getAIClient();
              const pdfBase64 = pdfData.toString("base64");
              const response = await ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: [
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: pdfBase64
                    }
                  },
                  {
                    text: "Extract all readable Sinhala/English text page-by-page from this Sri Lankan A/L Technology exam PDF. Preserve question numbers, MCQ numbers, diagrams descriptions, formulas. Return JSON pages [{pageNumber, text}]"
                  }
                ],
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      pages: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            pageNumber: { type: Type.INTEGER },
                            text: { type: Type.STRING }
                          },
                          required: ["pageNumber", "text"]
                        }
                      }
                    },
                    required: ["pages"]
                  }
                }
              });

              const responseText = response.text || "";
              const parsed = JSON.parse(responseText);
              if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
                finalPages = parsed.pages;
                needsOcr = false;
                textEncoding = "ocr_sinhala";
                needsLegacy = false;
              } else {
                isOcrFailed = true;
              }
            } catch (err: any) {
              console.error("Auto OCR failed:", err);
              isOcrFailed = true;
            }
          }
        }
      }
    } else if (pages) {
      const pagesArray = typeof pages === "string" ? JSON.parse(pages) : pages;
      if (Array.isArray(pagesArray)) {
        finalPages = pagesArray;
      } else {
        return res.status(400).json({ ok: false, error: "Invalid pages format." });
      }
    } else {
      return res.status(400).json({ ok: false, error: "Missing file or pages array for reindexing." });
    }

    if (isOcrRun && isOcrFailed && finalPages.length === 0) {
      const metaUpdate = {
        chunkCount: 0,
        needsOcr: true,
        textIndexed: false,
        indexStatus: "needs_ocr",
        needsLegacyConversion: false,
        textEncoding: "unknown",
        updatedAt: new Date().toISOString()
      };
      await sourceRef.update(metaUpdate).catch((err: any) => console.warn("Firestore update failed:", err));
      if (sourceScope === "past_paper") {
        await db.collection("past_papers").doc(sourceId).update(metaUpdate).catch((err: any) => console.warn("Firestore update failed:", err));
      }
      invalidateInventoryCache(user.uid);
      return res.json({
        ok: true,
        chunkCount: 0,
        needsOcr: true,
        indexStatus: "needs_ocr",
        ocrUnavailable: false,
        message: "OCR processing failed or returned empty pages."
      });
    }

    if (finalPages.length === 0 && needsOcr) {
      const metaUpdate = {
        chunkCount: 0,
        needsOcr: true,
        textIndexed: false,
        indexStatus: "needs_ocr",
        needsLegacyConversion: false,
        textEncoding: "unknown",
        updatedAt: new Date().toISOString()
      };
      await sourceRef.update(metaUpdate).catch((err: any) => console.warn("Firestore update failed:", err));
      if (sourceScope === "past_paper") {
        await db.collection("past_papers").doc(sourceId).update(metaUpdate).catch((err: any) => console.warn("Firestore update failed:", err));
      }
      invalidateInventoryCache(user.uid);
      return res.json({
        ok: true,
        chunkCount: 0,
        needsOcr: true,
        indexStatus: "needs_ocr",
        ocrUnavailable: !process.env.GEMINI_API_KEY,
        message: "OCR provider not configured or PDF empty"
      });
    }

    // Write chunks to firestore
    const chunkText = (text: string, size: number = 1000, overlap: number = 150): string[] => {
      const chunks: string[] = [];
      if (!text) return chunks;
      let i = 0;
      while (i < text.length) {
        const chunk = text.slice(i, i + size);
        chunks.push(chunk);
        i += (size - overlap);
        if (size - overlap <= 0) break; // prevent infinite loop
      }
      return chunks;
    };

    if (finalPages.length > 0) {
      for (const p of finalPages) {
        const pageText = (p.text || "").trim();
        if (!pageText) continue;

        const pageNum = Number(p.pageNumber || p.page_number || 1);
        const subChunks = chunkText(pageText, 1000, 150);

        for (let j = 0; j < subChunks.length; j++) {
          const chunkTextContent = subChunks[j];
          const questionNo = detectQuestionNo(chunkTextContent);
          const chunkId = `chunk_${sourceId}_${chunkCount}`;

          const chunkDoc = {
            sourceId,
            pageNumber: pageNum,
            questionNo: questionNo || null,
            ownerUid: user.uid,
            ownerEmail: user.email || "unknown",
            text: chunkTextContent,
            rawTextPreview: chunkTextContent.slice(0, 200),
            textEncoding: textEncoding || "unknown",
            conversionApplied: p.conversionApplied || false,
            conversionConfidence: p.conversionConfidence || 0,
            chunkIndex: chunkCount++,
            title,
            fileName,
            subject: normalizeSubject(subject || ""),
            lesson,
            subtopic: null,
            resourceType,
            year: year ? String(year) : null,
            medium,
            tags: [title, subject].filter(Boolean),
            sourceScope,
            visibility: sourceScope === "official" ? "official" : "private",
            embeddingStatus: "none",
            createdAt: new Date().toISOString()
          };

          batch.set(db.collection("rag_chunks").doc(chunkId), chunkDoc);

          if (sourceScope === "owner_syllabus") {
            const sylChunkRef = db.collection("users").doc(user.uid).collection("syllabus_chunks").doc(chunkId);
            batch.set(sylChunkRef, { id: chunkId, ...chunkDoc });
          }
        }
      }
    }

    await batch.commit();

    // 3. Update metadata
    const finalIndexStatus = computeIndexStatus({
      chunkCount,
      needsOcr,
      needsLegacyConversion: needsLegacy,
      textEncoding,
      indexStatus: chunkCount > 0 ? "ready" : "not_indexed"
    });
    const finalTextIndexed = chunkCount > 0 && !needsOcr;

    const metaUpdate = {
      chunkCount,
      needsOcr,
      textIndexed: finalTextIndexed,
      indexStatus: finalIndexStatus,
      needsLegacyConversion: needsLegacy,
      textEncoding,
      updatedAt: new Date().toISOString()
    };

    await sourceRef.update(metaUpdate);

    if (sourceScope === "past_paper") {
      await db.collection("past_papers").doc(sourceId).update(metaUpdate);
    } else if (sourceScope === "owner_syllabus") {
      await db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId).update({
        status: finalIndexStatus,
        ...metaUpdate
      });
    }

    invalidateInventoryCache(user.uid);

    return res.json({
      ok: true,
      message: `Document reindexed with ${chunkCount} chunks.`,
      chunkCount,
      needsOcr,
      needsLegacyConversion: needsLegacy,
      textEncoding
    });

  } catch (err: any) {
    console.error("Error in reindex-uploaded endpoint:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET actual chunks for a source
ragRoutes.get("/sources/:sourceId/chunks", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const chunks = chunksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    chunks.sort((a: any, b: any) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
    return res.json({
      ok: true,
      chunks
    });
  } catch (err: any) {
    console.error("Error fetching chunks:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


