import { getAIClient } from "../ai/client";
import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { requireFirebaseUser, requireNonAnonymousUser } from "../firebase/authMiddleware";
import { getAdminDb, getAdminBucket, getAdminDbInfo } from "../firebase/admin";
import { extractPdfText } from "../pdf/extractText";
import { retryGoogleAuthOperation } from "../utils/retry";
import multer from "multer";
import { invalidateInventoryCache, computeIndexStatus } from "../sources/sourceInventoryService";
import { isGeminiPdfOcrConfigured } from "../pdf/geminiPdfOcr";
import { assertContentManager, isContentManager, isSharedSourceScope } from "../utils/contentPermissions";
import { normalizeLessonId, upsertLessonResource } from "../lessonResources/service";

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
async function resolveDownloadSource(db: any, sourceId: string, userUid: string) {
  const [ragSnapshot, paperSnapshot, lessonSnapshot, syllabusSnapshot] = await Promise.all([
    db.collection("rag_sources").doc(sourceId).get(),
    db.collection("past_papers").doc(sourceId).get(),
    db.collection("lesson_resources").doc(sourceId).get(),
    db.collection("users").doc(userUid).collection("syllabus_resources").doc(sourceId).get(),
  ]);

  const candidates: Array<{ origin: string; data: any }> = [];
  // Prefer global catalog records over legacy per-user metadata. This preserves
  // their published/official visibility even when the matching rag_sources row
  // was created by an older uploader with visibility:"private".
  if (paperSnapshot.exists) candidates.push({ origin: "past_papers", data: { id: paperSnapshot.id, ...paperSnapshot.data() } });
  if (lessonSnapshot.exists) candidates.push({ origin: "lesson_resources", data: { id: lessonSnapshot.id, ...lessonSnapshot.data() } });
  if (ragSnapshot.exists) candidates.push({ origin: "rag_sources", data: { id: ragSnapshot.id, ...ragSnapshot.data() } });
  if (syllabusSnapshot.exists) candidates.push({ origin: "syllabus_resources", data: { id: syllabusSnapshot.id, ...syllabusSnapshot.data() } });

  if (!lessonSnapshot.exists) {
    const lessonBySource = await db.collection("lesson_resources").where("sourceId", "==", sourceId).limit(1).get();
    if (!lessonBySource.empty) {
      const document = lessonBySource.docs[0];
      candidates.push({ origin: "lesson_resources", data: { id: document.id, ...document.data() } });
    }
  }

  return candidates.find((candidate) => String(candidate.data?.storagePath || "").trim())
    || candidates[0]
    || null;
}

function isPublishedSourceForStudents(origin: string, data: any) {
  const visibility = String(data?.visibility || "").toLowerCase();
  const scope = String(data?.sourceScope || "").toLowerCase();
  const resourceType = String(data?.resourceType || data?.sourceType || "").toLowerCase();

  // A document stored in the global past_papers collection is an application
  // resource, even when an old row still carries visibility:"private" from a
  // previous upload implementation.
  if (origin === "past_papers") return data?.published !== false;
  if (data?.published === true && ["official", "shared", "class", "institution", "public"].includes(visibility)) return true;
  if (["official", "shared", "class", "institution", "public"].includes(visibility)) return true;
  if (["past_paper", "paper_structure", "owner_syllabus", "shared_lesson", "official"].includes(scope)) return true;
  return ["past_paper", "model_paper", "marking_scheme", "paper_structure", "syllabus"].includes(resourceType)
    && data?.published !== false;
}

function safeInlineFileName(value: unknown) {
  return String(value || "source.pdf")
    .replace(/[\r\n"\\/]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180) || "source.pdf";
}

ragRoutes.get("/sources/:sourceId/download", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();
    const resolved = await resolveDownloadSource(db, sourceId, user.uid);

    if (!resolved) {
      return res.status(404).json({ ok: false, code: "SOURCE_NOT_FOUND", message: "Source not found." });
    }

    const data = resolved.data || {};
    if (!data.storagePath) {
      return res.status(404).json({ ok: false, code: "SOURCE_STORAGE_PATH_MISSING", message: "Storage path not found." });
    }

    const visibleToStudents = isPublishedSourceForStudents(resolved.origin, data);
    if (data.ownerUid !== user.uid && !visibleToStudents && !isContentManager(user)) {
      return res.status(403).json({ ok: false, code: "SOURCE_ACCESS_FORBIDDEN", message: "You do not have access to this source." });
    }

    const bucket = getAdminBucket();
    const file = bucket.file(String(data.storagePath));
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ ok: false, code: "SOURCE_FILE_NOT_FOUND", message: "File not found in storage." });
    }

    const [metadata] = await file.getMetadata().catch(() => [{} as any]);
    const contentType = String(data.mimeType || metadata.contentType || "application/pdf");
    const fileName = safeInlineFileName(data.fileName || data.title || metadata.name || "source.pdf");
    const shouldStream = req.query.stream === "true";
    const wantsJson = req.query.format === "json";
    const expiresAtMs = Date.now() + 15 * 60 * 1000;

    if (!shouldStream) {
      try {
        const [signedUrl] = await retryGoogleAuthOperation("sourcesGetSignedUrl", async () => {
          return await file.getSignedUrl({
            action: "read",
            expires: expiresAtMs,
            responseDisposition: `inline; filename="${fileName}"`,
            responseType: contentType,
          });
        });

        if (wantsJson) {
          res.setHeader("Cache-Control", "private, no-store");
          return res.json({
            ok: true,
            mode: "signed_url",
            url: signedUrl,
            expiresAt: new Date(expiresAtMs).toISOString(),
            fileName,
            contentType,
          });
        }
        return res.redirect(signedUrl);
      } catch (signErr) {
        console.warn("Failed to generate signed source URL; using authenticated stream.", signErr);
        if (wantsJson) {
          res.setHeader("Cache-Control", "private, no-store");
          return res.json({
            ok: true,
            mode: "stream",
            streamUrl: `/api/rag/sources/${encodeURIComponent(sourceId)}/download?stream=true`,
            fileName,
            contentType,
          });
        }
      }
    }

    const size = Number(metadata.size || 0);
    const rangeHeader = String(req.headers.range || "");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Accept-Ranges", "bytes");

    if (rangeHeader && size > 0) {
      const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader);
      if (match) {
        const start = Number(match[1]);
        const requestedEnd = match[2] ? Number(match[2]) : size - 1;
        const end = Math.min(size - 1, requestedEnd);
        if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start) {
          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
          res.setHeader("Content-Length", String(end - start + 1));
          return file.createReadStream({ start, end }).on("error", (error: Error) => res.destroy(error)).pipe(res);
        }
      }
      res.status(416).setHeader("Content-Range", `bytes */${size}`);
      return res.end();
    }

    if (size > 0) res.setHeader("Content-Length", String(size));
    return file.createReadStream().on("error", (error: Error) => res.destroy(error)).pipe(res);
  } catch (e: any) {
    if (isPermissionError(e)) {
      return res.status(503).json({
        ok: false,
        code: "SOURCE_BACKEND_PERMISSION_ERROR",
        message: "The server could not read this source. Check the runtime service-account Storage permissions."
      });
    }
    return res.status(500).json({ ok: false, code: "SOURCE_DOWNLOAD_FAILED", message: e.message });
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

// 3. Create past paper doc
ragRoutes.get("/past-papers", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const subject = normalizeSubject(String(req.query.subject || ""));
    const snapshot = await getAdminDb()
      .collection("past_papers")
      .where("subject", "==", subject)
      .limit(200)
      .get();
    const papers = snapshot.docs.map((document: any) => ({
      id: document.id,
      ...document.data(),
    }));
    return res.json({ ok: true, papers });
  } catch (err: any) {
    return res.status(isPermissionError(err) ? 503 : 500).json({
      ok: false,
      code: isPermissionError(err) ? "FIRESTORE_ADMIN_PERMISSION_DENIED" : "PAST_PAPERS_LIST_FAILED",
      message: isPermissionError(err)
        ? "The server does not have permission to read past papers."
        : (err?.message || "Past papers could not be loaded."),
    });
  }
});

ragRoutes.post("/past-papers", requireNonAnonymousUser, async (req: any, res) => {
  try {
    assertContentManager(req.user);
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
    const existingSnapshot = await db.collection("past_papers").doc(finalId).get();
    const existing = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
    const alreadyProcessed = Boolean(existing.processedAt) || Number(existing.chunkCount || 0) > 0 || existing.indexStatus === "failed" || existing.indexStatus === "needs_ocr";
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
      visibility: "official",
      published: true,
      createdBy: req.user.uid,
      lesson: String(req.body.lesson || "Past papers"),
      lessonId: normalizeLessonId(req.body.lessonId || req.body.lesson || "Past papers"),
      chunkCount: alreadyProcessed ? Number(existing.chunkCount || 0) : Number(chunkCount || 0),
      needsOcr: alreadyProcessed ? existing.needsOcr === true : needsOcr === true,
      textIndexed: alreadyProcessed ? existing.textIndexed === true : Number(chunkCount || 0) > 0 && needsOcr !== true,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString()
    };

    await db.collection("past_papers").doc(finalId).set(paperDoc, { merge: true });
    await db.collection("rag_sources").doc(finalId).set(paperDoc, { merge: true });
    await upsertLessonResource({
      id: finalId,
      sourceId: finalId,
      subject: normSubject,
      lessonId: paperDoc.lessonId,
      lessonTitle: paperDoc.lesson,
      resourceType: "past_paper",
      mediaKind: "pdf",
      title: paperDoc.title,
      fileName: paperDoc.fileName,
      storagePath: paperDoc.storagePath,
      visibility: "official",
      published: true,
      processingStatus: paperDoc.chunkCount > 0 ? "ready" : "queued",
      needsOcr: paperDoc.needsOcr,
      textIndexed: paperDoc.chunkCount > 0 && !paperDoc.needsOcr,
      createdBy: req.user.uid,
      ownerUid: req.user.uid,
      createdAt: paperDoc.createdAt,
    });
    invalidateInventoryCache(req.user.uid);

    res.json({ ok: true, doc: paperDoc });
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    res.status(status).json({ ok: false, code: err?.code || "PAST_PAPER_SAVE_FAILED", message: err?.message || "Past paper could not be saved." });
  }
});

// 4. Delete past paper
ragRoutes.delete("/past-papers/:id", requireNonAnonymousUser, async (req: any, res) => {
  try {
    const sourceId = req.params.id;
    const db = getAdminDb();
    
    assertContentManager(req.user);
    const isAdmin = true;
    
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
    
    batch.delete(db.collection("lesson_resources").doc(sourceId));
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
    const status = Number(err?.status) || 500;
    res.status(status).json({ ok: false, code: err?.code || "PAST_PAPER_DELETE_FAILED", message: err?.message || "Past paper could not be deleted." });
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

    const manager = isContentManager(user);
    if (isSharedSourceScope(data.sourceScope)) {
      assertContentManager(user);
    } else if (data.ownerUid !== user.uid && !manager) {
      return res.status(403).json({ ok: false, code: "SOURCE_DELETE_FORBIDDEN", message: "You do not have permission to delete this source." });
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

    // Delete from rag_sources and the global lesson catalog entry.
    batch.delete(docRef);
    batch.delete(db.collection("lesson_resources").doc(sourceId));

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
    if (isSharedSourceScope(sourceData?.sourceScope)) {
      assertContentManager(user);
    } else if (sourceData?.ownerUid !== user.uid && !isContentManager(user)) {
      return res.status(403).json({ ok: false, code: "SOURCE_REINDEX_FORBIDDEN", message: "You do not have permission to reindex this source." });
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
    const rag_chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    rag_chunksSnap.docs.forEach((d: any) => {
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
        if (!isGeminiPdfOcrConfigured()) {
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
            model: "gemini-2.5-flash",
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

        const hasLegacyTextLayer = String(textEncoding || "").startsWith("legacy_")
          && Array.isArray(extraction.pages)
          && extraction.pages.length > 0;
        if (hasLegacyTextLayer) {
          // A selectable legacy-font PDF is not a scanned document. Preserve
          // its page text for source matching and let direct PDF QA interpret
          // the original document when an exact question is requested.
          finalPages = extraction.pages;
          needsOcr = false;
          needsLegacy = false;
        }

        if (!hasLegacyTextLayer && !needsOcr && extraction.pages) {
          finalPages = extraction.pages;
        } else if (!hasLegacyTextLayer) {
          if (isGeminiPdfOcrConfigured()) {
            isOcrRun = true;
            try {
              const ai = getAIClient();
              const pdfBase64 = pdfData.toString("base64");
              const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
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
        ocrUnavailable: !isGeminiPdfOcrConfigured(),
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
    const status = Number(err?.status) || 500;
    res.status(status).json({ ok: false, code: err?.code || "SOURCE_REINDEX_FAILED", message: err?.message || "The source could not be reindexed." });
  }
});

// GET actual chunks for a source
ragRoutes.get("/sources/:sourceId/chunks", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const sourceSnapshot = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnapshot.exists) {
      return res.status(404).json({ ok: false, code: "SOURCE_NOT_FOUND", message: "Source not found." });
    }
    const source = sourceSnapshot.data() || {};
    const visible = ["public", "official", "shared", "class", "institution"].includes(String(source.visibility || ""));
    if (!isContentManager(req.user) && source.ownerUid !== req.user.uid && !visible) {
      return res.status(403).json({ ok: false, code: "SOURCE_CHUNKS_FORBIDDEN", message: "You do not have access to this source." });
    }
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
