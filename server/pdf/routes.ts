import express, { Router } from "express";
import multer from "multer";
import { requireFirebaseUser } from "../firebase/authMiddleware";
import { getAdminDb, getAdminBucket } from "../firebase/admin";
import { processUploadedPdf, finalizePipelineProcessing } from "./processingPipeline";
import { checkOcrJobStatus } from "../ocr/cloudVisionOcr";
import { askGeminiDirectPdf } from "./directPdfQa";
import { stripRawVisualBlocks } from "../ai-core/answer/stripVisualBlocks";
import { extractPdfText } from "./extractText";
import { assertContentManager, isContentManager, isSharedSourceScope, isStudentVisibleSource } from "../utils/contentPermissions";
import { normalizeLessonId, updateLessonResourceProcessing, upsertLessonResource } from "../lessonResources/service";
import { invalidateInventoryCache } from "../sources/sourceInventoryService";

export const pdfRoutes = Router();
const upload = multer({ storage: multer.memoryStorage() });

import { isAiBillingCircuitOpen, getAiBillingState } from "../ai/aiCircuitBreaker";

function storageObjectPath(input: unknown): string {
  const value = String(input || "").trim();
  if (!value) return "";
  if (value.startsWith("gs://")) {
    return value.replace(/^gs:\/\/[^/]+\//, "");
  }
  if (value.startsWith("https://firebasestorage.googleapis.com")) {
    try {
      const parsed = new URL(value);
      const marker = "/o/";
      const index = parsed.pathname.indexOf(marker);
      return index >= 0 ? decodeURIComponent(parsed.pathname.slice(index + marker.length)) : "";
    } catch {
      return "";
    }
  }
  return value.replace(/^\/+/, "");
}

function canUseStoragePath(user: any, path: string) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const privileged = user?.admin === true || roles.some((role: string) => ["admin", "content_editor", "teacher", "ops"].includes(role));
  return privileged
    || path.startsWith(`users/${user.uid}/`)
    || path.startsWith(`rag_uploads/${user.uid}/`);
}

function canViewSource(user: any, source: any) {
  return isContentManager(user)
    || source?.ownerUid === user?.uid
    || source?.createdBy === user?.uid
    || isStudentVisibleSource(source);
}

function canReviewQuestionCache(user: any) {
  const roles = Array.isArray(user?.roles) ? user.roles.map(String) : [];
  return isContentManager(user) || roles.includes("reviewer");
}

async function resolveDirectQaSource(user: any, sourceId: string, submittedPath: unknown) {
  const db = getAdminDb();
  const snapshots = await Promise.all([
    sourceId ? db.collection("rag_sources").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("past_papers").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("lesson_resources").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId).get() : Promise.resolve(null),
  ]);
  const candidates = snapshots
    .filter((snapshot: any) => snapshot?.exists)
    .map((snapshot: any) => snapshot.data?.() || null)
    .filter(Boolean);

  // Merge the authoritative lesson_resources publication metadata with the
  // corresponding extracted rag_sources data. This keeps legacy private rows
  // answerable for students without exposing personal chat uploads.
  const extractedSource = snapshots[0] && (snapshots[0] as any).exists
    ? (snapshots[0] as any).data?.() || null
    : null;
  const lessonResource = snapshots[2] && (snapshots[2] as any).exists
    ? (snapshots[2] as any).data?.() || null
    : null;
  if (extractedSource && lessonResource) {
    candidates.unshift({ ...extractedSource, ...lessonResource, sourceId });
  }
  // A legacy rag_sources row may exist without its storagePath while the
  // complete lesson-resource row lives under users/{uid}/syllabus_resources.
  // Prefer a complete row so terse follow-ups such as “q1” keep using the
  // already selected lesson PDF.
  const source = candidates.find((candidate: any) => storageObjectPath(candidate?.storagePath))
    || candidates[0]
    || null;
  const path = storageObjectPath(source?.storagePath || submittedPath);
  if (!path) throw Object.assign(new Error("PDF source has no valid storage path."), { status: 400, code: "DIRECT_QA_SOURCE_PATH_INVALID" });

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const privileged = user?.admin === true || roles.some((role: string) => ["admin", "content_editor", "teacher", "ops"].includes(role));
  const visible = isStudentVisibleSource(source);
  const owned = source?.ownerUid === user.uid || source?.createdBy === user.uid || canUseStoragePath(user, path);
  if (!privileged && !visible && !owned) {
    throw Object.assign(new Error("You do not have access to this PDF source."), { status: 403, code: "DIRECT_QA_SOURCE_FORBIDDEN" });
  }
  return { source, path };
}

// 1. Register and process an authenticated upload.
pdfRoutes.post("/process-uploaded", requireFirebaseUser, express.json(), async (req: any, res) => {
  try {
    const user = req.user;
    const {
      sourceId,
      storagePath,
      title,
      fileName,
      subject,
      year,
      resourceType,
      sourceType,
      sourceScope = "chat_upload",
      lesson,
      lessonId,
      deferProcessing,
    } = req.body || {};

    if (!sourceId || !storagePath) {
      return res.status(400).json({ ok: false, code: "UPLOAD_METADATA_MISSING", message: "Missing sourceId or storagePath." });
    }

    const shared = isSharedSourceScope(sourceScope);
    if (shared) assertContentManager(user);

    const normalizedStoragePath = storageObjectPath(storagePath);
    if (!normalizedStoragePath || !canUseStoragePath(user, normalizedStoragePath)) {
      return res.status(403).json({ ok: false, code: "UPLOAD_PATH_FORBIDDEN", message: "The storage path is outside the signed-in user's upload area." });
    }

    const db = getAdminDb();
    const now = new Date().toISOString();
    const normalizedSubject = String(subject || "").toUpperCase();
    const lessonTitle = String(lesson || "General").trim().slice(0, 180) || "General";
    const normalizedLessonId = normalizeLessonId(lessonId || lessonTitle);
    const inferredMediaKind = String(sourceType || "").toLowerCase().includes("image")
      || /\.(png|jpe?g|webp)$/i.test(String(fileName || title || ""))
      ? "image"
      : "pdf";
    const visibility = shared
      ? (["official", "past_paper"].includes(String(sourceScope)) ? "official" : "class")
      : "private";
    const published = shared;
    const displayTitle = title || fileName || (inferredMediaKind === "image" ? "Lesson image" : "Uploaded PDF");

    const sourceRecord = {
      sourceId,
      ownerUid: user.uid,
      createdBy: user.uid,
      storagePath: normalizedStoragePath,
      title: displayTitle,
      fileName: fileName || (inferredMediaKind === "image" ? "image" : "upload.pdf"),
      subject: normalizedSubject,
      lesson: lessonTitle,
      lessonId: normalizedLessonId,
      year: year ? String(year) : null,
      resourceType: resourceType || (shared ? "paper_structure" : "uploaded_pdf"),
      sourceType: sourceType || resourceType || (inferredMediaKind === "image" ? "image" : "uploaded_pdf"),
      sourceScope,
      mediaKind: inferredMediaKind,
      visibility,
      published,
      indexStatus: inferredMediaKind === "image" ? "ready" : "queued",
      processingStatus: inferredMediaKind === "image" ? "ready" : "queued",
      chunkCount: 0,
      needsOcr: false,
      textIndexed: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("rag_sources").doc(sourceId).set(sourceRecord, { merge: true });

    if (sourceScope === "past_paper") {
      await db.collection("past_papers").doc(sourceId).set({ id: sourceId, ...sourceRecord }, { merge: true });
    }

    if (shared) {
      await upsertLessonResource({
        id: sourceId,
        sourceId,
        subject: normalizedSubject,
        lessonId: normalizedLessonId,
        lessonTitle,
        resourceType: sourceRecord.resourceType,
        mediaKind: inferredMediaKind,
        title: displayTitle,
        fileName: sourceRecord.fileName,
        storagePath: normalizedStoragePath,
        visibility: visibility as "class" | "official",
        published: true,
        processingStatus: sourceRecord.processingStatus,
        needsOcr: false,
        textIndexed: false,
        createdBy: user.uid,
        ownerUid: user.uid,
        createdAt: now,
      });
    }

    invalidateInventoryCache(user.uid);

    if (inferredMediaKind === "image") {
      return res.json({ ok: true, status: "ready", sourceId, needsOcr: false, message: "Lesson image is ready." });
    }

    if (deferProcessing === true) {
      return res.json({ ok: true, status: "awaiting_client_file", message: "Source registered; awaiting direct client file hand-off.", sourceId });
    }

    const processing = await processUploadedPdf({
      uid: user.uid,
      sourceId,
      storagePath: normalizedStoragePath,
      fileName: sourceRecord.fileName,
      title: displayTitle,
      subject: normalizedSubject,
      year: year || null,
      resourceType: sourceRecord.resourceType,
      sourceType: sourceRecord.sourceType,
      sourceScope,
      lesson: lessonTitle,
      forceOcr: false,
    });

    if (shared) {
      await updateLessonResourceProcessing(sourceId, {
        processingStatus: processing.status,
        needsOcr: processing.needsOcr,
        textIndexed: processing.status === "ready" || processing.chunkCount > 0,
      });
    }

    if (processing.status === "queued") {
      return res.status(202).json({
        ok: true,
        pending: true,
        code: "OCR_QUEUED",
        sourceId,
        status: "queued",
        needsOcr: true,
        message: "This scanned document is being processed.",
      });
    }

    if (!processing.ok && processing.needsOcr) {
      return res.status(503).json({
        ok: false,
        code: "OCR_PROCESSING_UNAVAILABLE",
        sourceId,
        needsOcr: true,
        message: "We could not process this scanned document. Please try again later.",
      });
    }

    return res.json({ ...processing, sourceId });
  } catch (error: any) {
    console.error("Error in process-uploaded route:", error);
    return res.status(error.status || 500).json({
      ok: false,
      code: error.code || "UPLOAD_PROCESSING_FAILED",
      message: error.status === 403 ? error.message : "The uploaded resource could not be processed.",
    });
  }
});

// 2. Reprocess OCR or Legacy Convert for a source
pdfRoutes.post("/reprocess/:sourceId", requireFirebaseUser, upload.single("file"), async (req: any, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();

    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }

    const srcData = sourceSnap.data()!;
    if (isSharedSourceScope(srcData.sourceScope)) {
      assertContentManager(user);
    } else if (srcData.ownerUid !== user.uid && !isContentManager(user)) {
      return res.status(403).json({ ok: false, code: "SOURCE_REPROCESS_FORBIDDEN", message: "You do not have permission to reprocess this source." });
    }
    let buffer: Buffer;

    if (req.file) {
      buffer = req.file.buffer;
    } else {
      // Download original PDF from Storage
      const storagePath = srcData.storagePath;
      if (!storagePath) {
        return res.status(400).json({ ok: false, error: "Source has no original PDF storage path." });
      }
      console.log(`Downloading original file from GCS: ${storagePath} to reprocess...`);
      const bucket = getAdminBucket();
      const file = bucket.file(storagePath);
      const [downloaded] = await file.download();
      buffer = downloaded;
    }

    const result = await processUploadedPdf({
      uid: srcData.ownerUid || user.uid,
      sourceId,
      storagePath: srcData.storagePath,
      fileName: srcData.fileName,
      title: srcData.title,
      subject: srcData.subject,
      year: srcData.year,
      resourceType: srcData.resourceType || "uploaded_pdf",
      sourceType: srcData.sourceType || "uploaded_pdf",
      sourceScope: srcData.sourceScope || "personal",
      buffer,
      forceOcr: true // repocess always forces OCR
    });

    return res.json(result);
  } catch (err: any) {
    console.error("Error in reprocess route:", err);
    return res.status(err.status || 500).json({ ok: false, code: err.code || "SOURCE_REPROCESS_FAILED", message: err.message });
  }
});

// 3. Check status of OCR job
pdfRoutes.get("/ocr-status/:sourceId", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();

    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }

    const src = sourceSnap.data()!;
    if (!canViewSource(req.user, src)) {
      return res.status(403).json({ ok: false, code: "SOURCE_ACCESS_FORBIDDEN", message: "You do not have access to this source." });
    }
    const job = await checkOcrJobStatus(sourceId);

    // If background job finished, run the finalize step!
    if (job.status === "ready" && job.result) {
      console.log(`Background OCR job became ready. Running finalization for ${sourceId}`);
      await finalizePipelineProcessing({
        uid: src.ownerUid,
        sourceId,
        storagePath: src.storagePath,
        fileName: src.fileName,
        title: src.title,
        subject: src.subject,
        year: src.year,
        resourceType: src.resourceType || "uploaded_pdf",
        sourceScope: src.sourceScope || "personal",
        pages: job.result.pages.map(p => ({
          pageNumber: p.pageNumber,
          text: p.text,
          rawText: p.text,
          textEncoding: "unicode_sinhala",
          conversionApplied: false,
          conversionConfidence: 1.0
        })),
        extractionMethod: "cloud_vision_ocr",
        textEncoding: "unicode_sinhala",
        ocrConfidence: job.result.confidence,
        needsOcr: false,
        needsLegacyConversion: false
      });

      // Refetch the updated source
      const updatedSnap = await db.collection("rag_sources").doc(sourceId).get();
      const updatedSrc = updatedSnap.data()!;

      return res.json({
        ok: true,
        sourceId,
        ocrStatus: "ready",
        indexStatus: updatedSrc.indexStatus,
        chunkCount: updatedSrc.chunkCount,
        textIndexed: updatedSrc.textIndexed,
        needsOcr: updatedSrc.needsOcr,
        extractionMethod: updatedSrc.extractionMethod,
        ocrTextPdfStoragePath: updatedSrc.ocrTextPdfStoragePath,
        ocrTextPdfStatus: updatedSrc.ocrTextPdfStatus,
      });
    }

    return res.json({
      ok: true,
      sourceId,
      ocrStatus: job.status,
      indexStatus: src.indexStatus || "not_indexed",
      chunkCount: src.chunkCount || 0,
      textIndexed: src.textIndexed || false,
      needsOcr: src.needsOcr || false,
      extractionMethod: src.extractionMethod || "none",
      ocrTextPdfStoragePath: src.ocrTextPdfStoragePath || null,
      ocrTextPdfStatus: src.ocrTextPdfStatus || "disabled",
      error: job.error || null
    });
  } catch (err: any) {
    console.error("Error in ocr-status route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Retrieve page-by-page OCR text
pdfRoutes.get("/ocr-text/:sourceId", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();

    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }

    const source = sourceSnap.data()!;
    if (!canViewSource(req.user, source)) {
      return res.status(403).json({ ok: false, code: "OCR_TEXT_FORBIDDEN", message: "You do not have access to this source." });
    }
    const uid = source.ownerUid;

    const bucket = getAdminBucket();
    const safeFileName = source.fileName
      ? source.fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\u0D80-\u0DFF-]/g, "_")
      : "document";

    const jsonStoragePath = `users/${uid}/ocr_text/${sourceId}/pages.json`;
    const jsonFile = bucket.file(jsonStoragePath);

    const [exists] = await jsonFile.exists();
    if (exists) {
      const [downloaded] = await jsonFile.download();
      const parsed = JSON.parse(downloaded.toString("utf8"));
      return res.json({
        ok: true,
        source,
        pages: parsed.pages || []
      });
    }

    // Fallback: aggregate from rag_chunks
    const chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
    const pageMap = new Map<number, string>();

    chunksSnap.docs.forEach((d: any) => {
      const chunk = d.data();
      const pageNum = chunk.pageNumber || 1;
      const current = pageMap.get(pageNum) || "";
      pageMap.set(pageNum, current + (current ? "\n\n" : "") + chunk.text);
    });

    const pages = Array.from(pageMap.entries())
      .map(([pageNumber, text]) => ({
        pageNumber,
        text,
        confidence: 1.0,
        method: source.extractionMethod || "pdf_text"
      }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    return res.json({
      ok: true,
      source,
      pages
    });
  } catch (err: any) {
    console.error("Error in ocr-text route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Direct Gemini PDF Question Answering (Zero-GCS-Auth Path)
const inFlightDirectQa = new Map<string, Promise<any>>();
const failedDirectQaCooldown = new Map<string, number>();

pdfRoutes.post("/direct-qa-file", requireFirebaseUser, upload.single("file"), async (req: any, res) => {
  try {
    const { sourceId, storagePath, prompt, questionId, questionNo, questionType, subject, year } = req.body;
    console.log(`[DirectPDFQA] Received request for sourceId: ${sourceId}, questionNo: ${questionNo}`);

    const idempotencyKey = `${req.user.uid}:${sourceId}:${questionType}:${questionNo}`;

    const cooldownUntil = failedDirectQaCooldown.get(idempotencyKey);
    if ((cooldownUntil && Date.now() < cooldownUntil) || isAiBillingCircuitOpen()) {
      return res.status(429).json({
        ok: false,
        found: false,
        errorCode: "AI_BILLING_EXHAUSTED",
        stage: "AI_UNAVAILABLE",
        message: "The AI service is temporarily unavailable.",
        canRetry: false,
        billing: getAiBillingState()
      });
    }

    if (inFlightDirectQa.has(idempotencyKey)) {
      console.log(`[DirectPDFQA] Duplicate request detected for ${idempotencyKey}, attaching to existing promise.`);
      try {
        const result = await inFlightDirectQa.get(idempotencyKey);
        if (result.status) {
          const { status, ...rest } = result;
          return res.status(status).json(rest);
        }
        return res.json(result);
      } catch (e: any) {
        return res.status(500).json({ ok: false, errorCode: "DIRECT_QA_BACKEND_ERROR", error: e.message });
      }
    }

    const requestPromise = async () => {
      if (!questionNo || !questionType) {
        return {
          ok: false,
          status: 400,
          found: false,
          errorCode: "DIRECT_QA_MISSING_STRUCTURED_INTENT",
          stage: "VALIDATION",
          message: "Provide a question number and question type."
        };
      }

      let buffer: Buffer;
      let resolvedSource: any = null;
      if (req.file) {
        buffer = req.file.buffer;
        console.log(`[DirectPDFQA] File received via upload. Buffer size: ${buffer.length} bytes`);
      } else {
        const resolved = await resolveDirectQaSource(req.user, sourceId, storagePath);
        resolvedSource = resolved.source;

        // A scan may already have an asynchronous Vision operation running.
        // Reuse it instead of starting another whole-document scan whenever
        // the student follows up with a short message such as “q1”.
        if (sourceId && ["queued", "running"].includes(String(resolvedSource?.ocrStatus || ""))) {
          const existingJob = await checkOcrJobStatus(sourceId);
          if (existingJob.status === "ready" && existingJob.result) {
            await finalizePipelineProcessing({
              uid: String(resolvedSource.ownerUid || req.user.uid),
              sourceId,
              storagePath: String(resolvedSource.storagePath || storagePath || ""),
              fileName: String(resolvedSource.fileName || resolvedSource.title || `${sourceId}.pdf`),
              title: String(resolvedSource.title || resolvedSource.fileName || "PDF document"),
              subject: String(subject || resolvedSource.subject || ""),
              year: String(year || resolvedSource.year || "") || null,
              resourceType: String(resolvedSource.resourceType || "uploaded_pdf"),
              sourceType: String(resolvedSource.sourceType || resolvedSource.resourceType || "uploaded_pdf"),
              sourceScope: String(resolvedSource.sourceScope || "personal"),
              lesson: resolvedSource.lesson ? String(resolvedSource.lesson) : undefined,
              pages: existingJob.result.pages.map((page) => ({
                pageNumber: page.pageNumber,
                text: page.text,
                rawText: page.text,
                textEncoding: "unicode_sinhala",
                conversionApplied: false,
                conversionConfidence: 1,
              })),
              extractionMethod: "cloud_vision_ocr",
              textEncoding: "unicode_sinhala",
              ocrConfidence: existingJob.result.confidence,
              needsOcr: false,
              needsLegacyConversion: false,
            });
          } else if (["queued", "running"].includes(existingJob.status)) {
            return {
              ok: false,
              status: 202,
              found: false,
              errorCode: "OCR_QUEUED",
              code: "OCR_QUEUED",
              pending: true,
              stage: "PDF_INDEXING",
              message: "This scanned document is being processed. The question will be retried automatically.",
              canRetry: true,
              retryAfterMs: 8_000,
            };
          }
        }

        // Prefer the already indexed source text. This keeps follow-up prompts
        // such as “q1” attached to the selected PDF and avoids repeatedly
        // uploading/scanning a large document in a short-lived function.
        if (sourceId) {
          const chunkSnapshot = await getAdminDb().collection("rag_chunks").where("sourceId", "==", sourceId).get();
          const indexedChunks = chunkSnapshot.docs
            .map((document: any) => document.data())
            .filter((chunk: any) => String(chunk?.text || "").trim())
            .sort((a: any, b: any) => {
              const pageDelta = Number(a.pageNumber || 0) - Number(b.pageNumber || 0);
              return pageDelta || Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0);
            });

          if (indexedChunks.length > 0) {
            const targetNo = String(questionNo).replace(/\D/g, "") || String(questionNo);
            const marker = new RegExp(`(?:^|\\s|\\n)(?:q(?:uestion)?\\s*)?0?${targetNo}(?:\\.|\\)|\\s|$)`, "i");
            const exactIndexes = indexedChunks
              .map((chunk: any, index: number) => marker.test(String(chunk.text || "")) ? index : -1)
              .filter((index: number) => index >= 0);
            const selectedIndexes = new Set<number>();
            if (exactIndexes.length > 0) {
              exactIndexes.slice(0, 3).forEach((index: number) => {
                for (let offset = -1; offset <= 2; offset += 1) {
                  if (indexedChunks[index + offset]) selectedIndexes.add(index + offset);
                }
              });
            } else {
              indexedChunks.slice(0, 10).forEach((_chunk: any, index: number) => selectedIndexes.add(index));
            }
            const indexedText = Array.from(selectedIndexes)
              .sort((a, b) => a - b)
              .map((index) => {
                const chunk = indexedChunks[index];
                return `[Page ${chunk.pageNumber || "?"}]\n${chunk.text}`;
              })
              .join("\n\n")
              .slice(0, 90_000);

            if (indexedText.trim().length >= 80) {
              const { askGeminiExtractedTextStructured } = await import("../ai-core/pdf/directPdfQa");
              const indexedResult = await askGeminiExtractedTextStructured({
                uid: req.user.uid,
                sourceId,
                extractedText: indexedText,
                year: year || "unknown",
                subject: subject || "unknown",
                questionType,
                questionNo,
                allowOfficialAnswer: [resolvedSource?.resourceType, resolvedSource?.sourceType, resolvedSource?.sourceScope]
                  .some((value) => String(value || "").toLowerCase().includes("marking"))
                  || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || "")),
              });
              if (indexedResult.ok && indexedResult.found) return indexedResult;
            }
          }
        }

        console.log(`[DirectPDFQA] Reading verified source from Firebase Admin: ${resolved.path}`);
        const [downloaded] = await getAdminBucket().file(resolved.path).download();
        buffer = downloaded;
        if (!buffer?.length) {
          return { ok: false, status: 404, errorCode: "DIRECT_QA_SOURCE_EMPTY", error: "The stored PDF is empty or unavailable." };
        }
      }
      const effectivePrompt = prompt?.trim() || `${year || ""} ${subject || ""} ${questionType || "question"} ${questionNo} answer`;
      if (questionNo && questionType) {
        console.log(`[DirectPDFQA] Using structured extraction for ${questionType} ${questionNo}`);
        const { askGeminiDirectPdfStructured, askGeminiExtractedTextStructured } = await import("../ai-core/pdf/directPdfQa");
        // Fast path for native/legacy text-layer PDFs. This avoids sending a
        // large binary to the model and removes the 180-second whole-document
        // timeout seen in production. Scan-only documents continue to the
        // full-PDF/OCR fallback below.
        const localExtraction = await extractPdfText(buffer);
        if (localExtraction.status === "PDF_PARSER_UNAVAILABLE" || localExtraction.status === "PDF_PARSER_RUNTIME_ERROR") {
          return {
            ok: false,
            status: 500,
            found: false,
            errorCode: "PDF_PARSER_RUNTIME_ERROR",
            stage: "PDF_PARSING",
            message: "The PDF could not be parsed because of an internal server error.",
            canRetry: true,
          };
        }
        if (localExtraction.text.trim().length >= 80) {
          const targetNo = String(questionNo).replace(/\D/g, "") || String(questionNo);
          const marker = new RegExp(`(?:^|\\s|\\n)(?:q(?:uestion)?\\s*)?0?${targetNo}(?:\\.|\\)|\\s|$)`, "i");
          const matchingPages = localExtraction.pages.filter((page: any) => marker.test(String(page.text || page.rawText || "")));
          const candidatePages = matchingPages.length > 0
            ? matchingPages.slice(0, 4)
            : localExtraction.pages.slice(Math.max(0, Number(targetNo) - 1), Math.max(0, Number(targetNo) - 1) + 4);
          const candidateText = (candidatePages.length > 0 ? candidatePages : localExtraction.pages.slice(0, 5))
            .map((page: any) => `[Page ${page.pageNumber}]\n${page.text || page.rawText || ""}`)
            .join("\n\n")
            .slice(0, 90_000);
          const textResult = await askGeminiExtractedTextStructured({
            uid: req.user.uid,
            sourceId: sourceId || "uploaded_temp",
            extractedText: candidateText,
            year: year || "unknown",
            subject: subject || "unknown",
            questionType,
            questionNo,
            allowOfficialAnswer: [resolvedSource?.resourceType, resolvedSource?.sourceType, resolvedSource?.sourceScope]
              .some((value) => String(value || "").toLowerCase().includes("marking"))
              || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || "")),
          });
          if (textResult.ok && textResult.found) {
            return textResult;
          }
          if (!localExtraction.needsOcr) {
            return textResult;
          }
        }
        // A stored scan must be indexed once, not uploaded to the model again
        // for every question. Whole-document binary calls on large scans were
        // timing out after 180 seconds and left the chat in a pending state.
        // Queue Cloud Vision OCR, persist the source state, then let the next
        // question use the fast rag_chunks path above.
        if (sourceId && resolvedSource) {
          const cloudOcrEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true"
            || process.env.OCR_ENABLED === "true";
          const db = getAdminDb();
          await db.collection("rag_sources").doc(sourceId).set({
            indexStatus: cloudOcrEnabled ? "queued" : "needs_ocr",
            ocrStatus: cloudOcrEnabled ? "queued" : "not_configured",
            needsOcr: true,
            textIndexed: false,
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          if (cloudOcrEnabled) {
            const indexingResult = await processUploadedPdf({
              uid: String(resolvedSource.ownerUid || req.user.uid),
              sourceId,
              storagePath: storageObjectPath(resolvedSource.storagePath || storagePath),
              fileName: String(resolvedSource.fileName || resolvedSource.title || `${sourceId}.pdf`),
              title: String(resolvedSource.title || resolvedSource.fileName || "PDF document"),
              subject: String(subject || resolvedSource.subject || ""),
              year: String(year || resolvedSource.year || "") || null,
              resourceType: String(resolvedSource.resourceType || "uploaded_pdf"),
              sourceType: String(resolvedSource.sourceType || resolvedSource.resourceType || "uploaded_pdf"),
              sourceScope: String(resolvedSource.sourceScope || "personal"),
              lesson: resolvedSource.lesson ? String(resolvedSource.lesson) : undefined,
              buffer,
              forceOcr: true,
            });

            // Cloud Vision can finish inline for a small scan. In that case
            // answer the question in the same request instead of forcing the
            // student to repeat “q1”. This also preserves the selected PDF
            // across terse follow-up messages.
            if (indexingResult.status === "ready") {
              const refreshedChunks = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
              const orderedChunks = refreshedChunks.docs
                .map((document: any) => document.data())
                .filter((chunk: any) => String(chunk?.text || "").trim())
                .sort((left: any, right: any) => Number(left.pageNumber || 0) - Number(right.pageNumber || 0)
                  || Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0));
              if (orderedChunks.length > 0) {
                const targetNo = String(questionNo).replace(/\D/g, "") || String(questionNo);
                const marker = new RegExp(`(?:^|\\s|\\n)(?:q(?:uestion)?\\s*)?0?${targetNo}(?:\\.|\\)|\\s|$)`, "i");
                const exactIndex = orderedChunks.findIndex((chunk: any) => marker.test(String(chunk.text || "")));
                const startIndex = exactIndex >= 0 ? Math.max(0, exactIndex - 1) : 0;
                const indexedText = orderedChunks
                  .slice(startIndex, exactIndex >= 0 ? startIndex + 5 : 10)
                  .map((chunk: any) => `[Page ${chunk.pageNumber || "?"}]\n${chunk.text}`)
                  .join("\n\n")
                  .slice(0, 90_000);
                if (indexedText.trim().length >= 80) {
                  const answerFromIndex = await askGeminiExtractedTextStructured({
                    uid: req.user.uid,
                    sourceId,
                    extractedText: indexedText,
                    year: year || "unknown",
                    subject: subject || "unknown",
                    questionType,
                    questionNo,
                    allowOfficialAnswer: [resolvedSource?.resourceType, resolvedSource?.sourceType, resolvedSource?.sourceScope]
                      .some((value) => String(value || "").toLowerCase().includes("marking"))
                      || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || "")),
                  });
                  if (answerFromIndex.ok && answerFromIndex.found) return answerFromIndex;
                }
              }
            }

            return {
              ok: false,
              status: 202,
              found: false,
              errorCode: indexingResult.status === "ready" ? "PDF_INDEX_READY_RETRY" : "OCR_QUEUED",
              code: indexingResult.status === "ready" ? "PDF_INDEX_READY_RETRY" : "OCR_QUEUED",
              pending: indexingResult.status !== "ready",
              stage: "PDF_INDEXING",
              message: indexingResult.status === "ready"
                ? "The document index is ready. Retrying the question."
                : "This scanned document is being processed.",
              canRetry: true,
              retryAfterMs: indexingResult.status === "ready" ? 1000 : 12000,
            };
          }

          // OCR infrastructure may be temporarily unavailable in a preview or
          // during a configuration rollout. A bounded saved PDF can still be
          // answered through Gemini's native PDF understanding instead of
          // returning an environment/configuration template to the student.
          const fallbackLimit = Number(process.env.DIRECT_PDF_INLINE_MAX_BYTES || 10 * 1024 * 1024);
          if (buffer.length <= fallbackLimit) {
            const fallbackResult = await askGeminiDirectPdfStructured({
              uid: req.user.uid,
              sourceId,
              pdfBuffer: buffer,
              year: year || resolvedSource.year || "unknown",
              subject: subject || resolvedSource.subject || "unknown",
              questionType,
              questionNo,
              prompt: effectivePrompt,
              allowOfficialAnswer: [
                resolvedSource?.resourceType,
                resolvedSource?.sourceType,
                resolvedSource?.sourceScope,
              ].some((value) => String(value || "").toLowerCase().includes("marking"))
                || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || "")),
            });
            if (fallbackResult.ok && fallbackResult.found && fallbackResult.sourceEvidence?.questionText) {
              return { ok: true, ...fallbackResult, fallbackMode: "gemini_pdf" };
            }
            if (fallbackResult.errorCode === "AI_BILLING_EXHAUSTED" || fallbackResult.errorCode === "AI_RATE_LIMITED") {
              return {
                ok: false,
                status: fallbackResult.errorCode === "AI_RATE_LIMITED" ? 429 : 503,
                found: false,
                errorCode: fallbackResult.errorCode,
                stage: "MODEL_CALL",
                message: fallbackResult.errorCode === "AI_RATE_LIMITED"
                  ? "The PDF service is busy. Please retry shortly."
                  : "The PDF answer service is temporarily unavailable.",
                canRetry: fallbackResult.errorCode === "AI_RATE_LIMITED",
              };
            }
          }

          return {
            ok: false,
            status: 503,
            found: false,
            errorCode: "OCR_PROCESSING_UNAVAILABLE",
            stage: "PDF_INDEXING",
            message: "We could not process this scanned document. Please try again later.",
            canRetry: true,
          };
        }

        // A small one-off file uploaded directly in this request has no saved
        // source to index, so it may still use the bounded direct model path.
        const inlineLimit = Number(process.env.DIRECT_PDF_INLINE_MAX_BYTES || 10 * 1024 * 1024);
        if (buffer.length > inlineLimit) {
          return {
            ok: false,
            status: 413,
            found: false,
            errorCode: "DIRECT_PDF_TOO_LARGE_TO_SCAN_INLINE",
            stage: "PDF_INDEXING",
            message: "Save and index this large PDF before asking questions from it.",
          };
        }

        const result = await askGeminiDirectPdfStructured({
          uid: req.user.uid,
          sourceId: sourceId || "uploaded_temp",
          pdfBuffer: buffer,
          year: year || "unknown",
          subject: subject || "unknown",
          questionType,
          questionNo,
          prompt: effectivePrompt,
          allowOfficialAnswer: [
            resolvedSource?.resourceType,
            resolvedSource?.sourceType,
            resolvedSource?.sourceScope,
          ].some((value) => String(value || "").toLowerCase().includes("marking"))
            || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || "")),
        });
        console.log(`[DirectPDFQA] Structured extraction result: ${result.found ? "FOUND" : "NOT_FOUND"}`);
        if (!result.ok || !result.found || !result.sourceEvidence?.questionText) {
          const isRequire = result.errorCode === "AI_CLIENT_RUNTIME_ERROR" || (result.error && String(result.error).includes("require is not defined"));
          const isBilling = result.errorCode === "AI_BILLING_EXHAUSTED" || (result.error && (String(result.error).includes("depleted") || String(result.error).includes("credits") || String(result.error).includes("billing") || String(result.error).includes("RESOURCE_EXHAUSTED")));
          const isRateLimit = result.errorCode === "AI_RATE_LIMITED";

          if (isBilling || result.errorCode === "AI_BILLING_EXHAUSTED") {
            failedDirectQaCooldown.set(idempotencyKey, Date.now() + 10 * 60 * 1000);
            return {
              ok: false,
              found: false,
              errorCode: "AI_BILLING_EXHAUSTED",
              stage: "MODEL_CALL",
              reason: "AI billing exhausted. PDF was not fully analyzed by Gemini.",
              message: "The PDF answer could not be completed because the AI service limit was reached.",
              canRetry: false
            };
          }

          return {
            ok: false,
            found: false,
            errorCode: isRequire ? "AI_CLIENT_RUNTIME_ERROR" : (isRateLimit ? "AI_RATE_LIMITED" : (result.errorCode || "EXACT_QUESTION_EVIDENCE_MISSING")),
            stage: result.stage || "MODEL_CALL",
            reason: isRequire ? "AI client runtime error: require is not defined" : (isRateLimit ? "AI rate limit hit. Please retry in a moment." : (result.reason || "Question evidence not found in PDF.")),
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
        prompt: effectivePrompt,
        questionId,
        subject,
        year,
      });
      if (result.answer) {
        result.answer = stripRawVisualBlocks(result.answer);
      }
      console.log(`[DirectPDFQA] General extraction result: ${result.answer ? "SUCCESS" : "EMPTY"}`);
      return {
        ok: true,
        ...result
      };
    };

    inFlightDirectQa.set(idempotencyKey, requestPromise());
    try {
      const result = await inFlightDirectQa.get(idempotencyKey);
      if (result && result.errorCode === "AI_BILLING_EXHAUSTED") {
        setTimeout(() => {
          inFlightDirectQa.delete(idempotencyKey);
        }, 10 * 60 * 1000);
      } else {
        inFlightDirectQa.delete(idempotencyKey);
      }

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
    return res.status(Number(err.status) || 500).json({
       ok: false,
       found: false,
       errorCode: err.code || err.errorCode || "DIRECT_QA_BACKEND_FAILED",
       stage: err.stage || "MODEL_CALL",
       message: err.message || "Direct PDF QA failed"
    });
  }
});

// 6. Get Question Cache for a Source
pdfRoutes.get("/question-cache", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.query;
    if (!sourceId) return res.status(400).json({ ok: false, error: "Missing sourceId" });
    const db = getAdminDb();
    const sourceSnapshot = await db.collection("rag_sources").doc(String(sourceId)).get();
    const source = sourceSnapshot.exists ? sourceSnapshot.data() : null;
    if (!source || !canViewSource(req.user, source)) {
      return res.status(source ? 403 : 404).json({
        ok: false,
        code: source ? "QUESTION_CACHE_FORBIDDEN" : "SOURCE_NOT_FOUND",
        message: source ? "You do not have access to this source." : "Source not found.",
      });
    }
    const cacheSnap = await db.collection("pdf_question_cache")
      .where("sourceId", "==", sourceId)
      .orderBy("updatedAt", "desc")
      .get();

    const items = cacheSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      ok: true,
      sourceId,
      items
    });
  } catch (err: any) {
    console.error("Error in question-cache route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Reject cached question
pdfRoutes.post("/question-cache/:docId/reject", requireFirebaseUser, async (req: any, res) => {
  try {
    const { docId } = req.params;
    if (!canReviewQuestionCache(req.user)) {
      return res.status(403).json({ ok: false, code: "QUESTION_CACHE_REVIEW_FORBIDDEN", message: "You do not have permission to review cached questions." });
    }
    const db = getAdminDb();
    await db.collection("pdf_question_cache").doc(docId).update({
      validationStatus: "rejected",
      updatedAt: new Date().toISOString()
    });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Re-solve cached question
pdfRoutes.post("/question-cache/:docId/resolve", requireFirebaseUser, async (req: any, res) => {
  try {
    const { docId } = req.params;
    if (!canReviewQuestionCache(req.user)) {
      return res.status(403).json({ ok: false, code: "QUESTION_CACHE_REVIEW_FORBIDDEN", message: "You do not have permission to resolve cached questions." });
    }
    const db = getAdminDb();
    const doc = await db.collection("pdf_question_cache").doc(docId).get();
    if (!doc.exists) return res.status(404).json({ ok: false, error: "Cache not found" });

    const data = doc.data()!;
    if (!data.questionText || !data.options) {
      return res.status(400).json({ ok: false, error: "Missing question text or options for solving" });
    }

    const { solveExtractedMcqQuestion } = await import("../ai-core/pdf/solveExtractedQuestion");
    const solved = await solveExtractedMcqQuestion({
      questionText: data.questionText,
      options: data.options,
      subject: data.subject || "SFT",
      year: data.year || "unknown",
      questionNo: data.questionNo || ""
    });

    if (solved) {
      await db.collection("pdf_question_cache").doc(docId).update({
        solvedAnswer: solved,
        explanationSinhala: solved.explanationSinhala,
        updatedAt: new Date().toISOString()
      });
      return res.json({ ok: true, solved });
    }

    return res.status(500).json({ ok: false, error: "Solver failed to return result" });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 9. Verified Answer Overrides
pdfRoutes.get("/verified-answers/:sourceId", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.params;
    const db = getAdminDb();
    const snap = await db.collection("verified_answers")
      .where("sourceId", "==", sourceId)
      .get();

    const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return res.json({ ok: true, items });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

pdfRoutes.post("/verified-answers", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    // Basic admin check (could be more robust)
    const isAdmin = user.roles?.includes("admin") || user.admin === true;
    if (!isAdmin) return res.status(403).json({ ok: false, error: "Admin only" });

    const { sourceId, questionType, questionNo, ...data } = req.body;
    if (!sourceId || !questionType || !questionNo) {
      return res.status(400).json({ ok: false, error: "Missing identification fields" });
    }

    const db = getAdminDb();
    const docId = `${sourceId}_${questionType}_${questionNo}`.replace(/\//g, "_");

    const verifiedDoc = {
      ...data,
      sourceId,
      questionType,
      questionNo,
      verifiedBy: user.uid,
      verifiedAt: new Date().toISOString(),
      status: "verified"
    };

    await db.collection("verified_answers").doc(docId).set(verifiedDoc, { merge: true });
    return res.json({ ok: true, id: docId });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 10. Source Inventory
pdfRoutes.get("/sources", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();

    // Admin sees all, user sees owned
    const isAdmin = user.roles?.includes("admin") || user.admin === true;
    let query: any = db.collection("rag_sources");
    if (!isAdmin) {
      query = query.where("ownerUid", "==", user.uid);
    }

    const snap = await query.orderBy("createdAt", "desc").get();
    const sources = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return res.json({ ok: true, sources });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Admin repair endpoint
pdfRoutes.post("/admin/repair-source/:sourceId", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.params;
    // In a real app, verify admin claims. Here we assume owner or admin.
    const db = getAdminDb();
    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }
    const src = sourceSnap.data()!;

    // Reset index status
    await db.collection("rag_sources").doc(sourceId).update({
      indexStatus: "queued",
      updatedAt: new Date().toISOString()
    });

    // Run async
    setImmediate(() => {
      processUploadedPdf({
        uid: src.ownerUid,
        sourceId,
        storagePath: src.storagePath,
        fileName: src.fileName,
        title: src.title,
        subject: src.subject,
        year: src.year,
        resourceType: src.resourceType || "uploaded_pdf",
        sourceType: src.sourceType || "uploaded_pdf",
        sourceScope: src.sourceScope || "personal",
        forceOcr: req.body.forceOcr === true
      }).catch(err => console.error("Async repair error:", err));
    });

    return res.json({ ok: true, message: "Repair queued." });
  } catch (err: any) {
    console.error("Error in repair endpoint:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
