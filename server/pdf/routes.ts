import express, { Router } from "express";
import multer from "multer";
import { requireFirebaseUser, requireNonAnonymousUser } from "../firebase/authMiddleware";
import { getAdminDb, getAdminBucket } from "../firebase/admin";
import { processUploadedPdf, finalizePipelineProcessing } from "./processingPipeline";
import { checkOcrJobStatus } from "../ocr/cloudVisionOcr";
import { askGeminiDirectPdf } from "./directPdfQa";
import { stripRawVisualBlocks } from "../ai-core/answer/stripVisualBlocks";
import { retrieveExactPaperQuestion } from "../knowledge/retrieve";
import { loadPdfSourceBuffer, storageGsUri, validatedPdfDownloadUrl } from "./sourceBuffer";
import { getSftSyllabusGroundingPdf } from "./syllabusGrounding";
import { isVertexAiEnabled } from "../ai/client";

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
  const privileged = user?.admin === true || roles.some((role: string) => ["admin", "content_editor", "ops"].includes(role));
  return privileged
    || path.startsWith(`users/${user.uid}/`)
    || path.startsWith(`rag_uploads/${user.uid}/`);
}

async function resolveDirectQaSource(user: any, sourceId: string, submittedPath: unknown, submittedDownloadUrl?: unknown) {
  const db = getAdminDb();
  const snapshots = await Promise.all([
    sourceId ? db.collection("rag_sources").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("past_papers").doc(sourceId).get() : Promise.resolve(null),
  ]);
  const sourceSnapshot = snapshots.find((snapshot: any) => snapshot?.exists) as any;
  const source = sourceSnapshot?.data?.() || null;
  const path = storageObjectPath(source?.storagePath || submittedPath);
  if (!path) throw Object.assign(new Error("PDF source has no valid storage path."), { status: 400, code: "DIRECT_QA_SOURCE_PATH_INVALID" });

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const privileged = user?.admin === true || roles.some((role: string) => ["admin", "content_editor", "ops"].includes(role));
  const visible = ["public", "official", "shared"].includes(String(source?.visibility || ""));
  const owned = source?.ownerUid === user.uid || canUseStoragePath(user, path);
  if (!privileged && !visible && !owned) {
    throw Object.assign(new Error("You do not have access to this PDF source."), { status: 403, code: "DIRECT_QA_SOURCE_FORBIDDEN" });
  }
  const downloadUrl = validatedPdfDownloadUrl(
    submittedDownloadUrl || source?.downloadUrl || source?.url,
    path,
  );
  return { source, path, downloadUrl };
}

// 1. Process uploaded PDF immediately after upload
pdfRoutes.post("/process-uploaded", requireNonAnonymousUser, express.json(), async (req: any, res) => {
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
      sourceScope,
      lesson,
      deferProcessing,
      downloadUrl,
    } = req.body;

    if (!sourceId || !storagePath) {
      return res.status(400).json({ ok: false, error: "Missing sourceId or storagePath." });
    }

    const normalizedStoragePath = storageObjectPath(storagePath);
    if (!normalizedStoragePath || !canUseStoragePath(user, normalizedStoragePath)) {
      return res.status(403).json({ ok: false, error: "Storage path is outside the signed-in user's upload area." });
    }

    // Create the metadata document before the asynchronous worker starts. New
    // client-storage uploads do not have a rag_sources document yet, so update()
    // raised Firestore NOT_FOUND and surfaced as /process-uploaded 500.
    const db = getAdminDb();
    const now = new Date().toISOString();
    const verifiedDownloadUrl = validatedPdfDownloadUrl(downloadUrl, normalizedStoragePath) || null;
    await db.collection("rag_sources").doc(sourceId).set({
      sourceId,
      ownerUid: user.uid,
      storagePath: normalizedStoragePath,
      downloadUrl: verifiedDownloadUrl,
      title: title || fileName || "Uploaded PDF",
      fileName: fileName || "upload.pdf",
      subject: String(subject || "").toUpperCase(),
      lesson: lesson ? String(lesson).trim().slice(0, 180) : null,
      year: year ? String(year) : null,
      resourceType: resourceType || "uploaded_pdf",
      sourceType: sourceType || resourceType || "uploaded_pdf",
      sourceScope: sourceScope || "personal",
      visibility: "private",
      indexStatus: "queued",
      chunkCount: 0,
      needsOcr: false,
      textIndexed: false,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    if ((sourceScope || "") === "past_paper") {
      await db.collection("past_papers").doc(sourceId).set({
        id: sourceId,
        sourceId,
        ownerUid: user.uid,
        storagePath: normalizedStoragePath,
        downloadUrl: verifiedDownloadUrl,
        title: title || fileName || "Uploaded PDF",
        fileName: fileName || "upload.pdf",
        subject: String(subject || "").toUpperCase(),
        year: year ? String(year) : null,
        resourceType: resourceType || "past_paper",
        sourceType: sourceType || resourceType || "past_paper",
        sourceScope: "past_paper",
        indexStatus: "queued",
        chunkCount: 0,
        needsOcr: false,
        textIndexed: false,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
    }

    // Small client-storage uploads immediately hand the same File to the
    // multipart reindex route. Do not start a competing Storage download that
    // could fail later and overwrite a successful client-buffer index.
    if (deferProcessing !== true) setImmediate(() => {
      processUploadedPdf({
        uid: user.uid,
        sourceId,
        storagePath: normalizedStoragePath,
        fileName: fileName || "upload.pdf",
        title: title || fileName || "Uploaded PDF",
        subject,
        year: year || null,
        resourceType: resourceType || "uploaded_pdf",
        sourceType: sourceType || resourceType || "uploaded_pdf",
        sourceScope: sourceScope || "personal",
        lesson: lesson ? String(lesson).trim().slice(0, 180) : undefined,
        forceOcr: false
      }).catch(err => console.error("Async processUploadedPdf error:", err));
    });

    return res.json({
      ok: true,
      status: deferProcessing === true ? "awaiting_client_file" : "queued",
      message: deferProcessing === true ? "Source registered; awaiting direct client file hand-off" : "Processing queued",
      sourceId
    });
  } catch (err: any) {
    console.error("Error in process-uploaded route:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. Reprocess OCR or Legacy Convert for a source
pdfRoutes.post("/reprocess/:sourceId", requireNonAnonymousUser, upload.single("file"), async (req: any, res) => {
  try {
    const user = req.user;
    const { sourceId } = req.params;
    const db = getAdminDb();

    const sourceSnap = await db.collection("rag_sources").doc(sourceId).get();
    if (!sourceSnap.exists) {
      return res.status(404).json({ ok: false, error: "Source not found." });
    }

    const srcData = sourceSnap.data()!;
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const privileged = user?.admin === true || roles.some((role: string) => ["admin", "content_editor", "ops"].includes(role));
    if (srcData.ownerUid !== user.uid && !privileged) {
      return res.status(403).json({ ok: false, error: "You do not have permission to reprocess this source." });
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
    return res.status(500).json({ ok: false, error: err.message });
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

function directQaHttpError(error: any) {
  const code = String(error?.code || error?.errorCode || "DIRECT_QA_BACKEND_FAILED");
  const sourceDownloadFailed = code === "DIRECT_QA_SOURCE_DOWNLOAD_FAILED";
  return {
    status: Number(error?.status) || (sourceDownloadFailed ? 424 : 500),
    body: {
      ok: false,
      found: false,
      errorCode: code,
      stage: error?.stage || (sourceDownloadFailed ? "SOURCE_DOWNLOAD" : "MODEL_CALL"),
      message: sourceDownloadFailed
        ? "PDF source එක direct read කරන්න බැරි වුණා. Source access/IAM settings පරීක්ෂා කර නැවත උත්සාහ කරන්න."
        : (error?.message || "Direct PDF QA failed"),
    },
  };
}

pdfRoutes.post("/direct-qa-file", requireNonAnonymousUser, upload.single("file"), async (req: any, res) => {
  try {
    const { sourceId, storagePath, downloadUrl, prompt, questionId, questionNo, questionType, subject, year, scanMode } = req.body;
    console.log(`[DirectPDFQA] Received request for sourceId: ${sourceId}, questionNo: ${questionNo}, scanMode: ${scanMode || "full_paper"}`);

    const idempotencyKey = `${req.user.uid}:${sourceId}:${questionType}:${questionNo}`;

    const cooldownUntil = failedDirectQaCooldown.get(idempotencyKey);
    if ((cooldownUntil && Date.now() < cooldownUntil) || isAiBillingCircuitOpen()) {
      return res.status(429).json({
        ok: false,
        found: false,
        errorCode: "AI_BILLING_EXHAUSTED",
        stage: "AI_UNAVAILABLE",
        message: "AI credits අවසන් නිසා Direct PDF QA run කරන්න බැහැ.",
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
        const mapped = directQaHttpError(e);
        return res.status(mapped.status).json(mapped.body);
      }
    }

    const requestPromise = async () => {
      let buffer: Buffer | null = null;
      let resolvedSource: any = null;
      if (req.file) {
        buffer = req.file.buffer;
        console.log(`[DirectPDFQA] File received via upload. Buffer size: ${req.file.buffer.length} bytes`);
      } else {
        const resolved = await resolveDirectQaSource(req.user, sourceId, storagePath, downloadUrl);
        resolvedSource = resolved.source || {};
        (resolvedSource as any).__resolvedStoragePath = resolved.path;
        (resolvedSource as any).__verifiedDownloadUrl = resolved.downloadUrl;
      }
      const effectivePrompt = prompt?.trim() || `${year || ""} ${subject || ""} ${questionType || "question"} ${questionNo} answer`;
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
        const allowOfficialAnswer = [
            resolvedSource?.resourceType,
            resolvedSource?.sourceType,
            resolvedSource?.sourceScope,
          ].some((value) => String(value || "").toLowerCase().includes("marking"))
            || /marking[ _-]*scheme/i.test(String(resolvedSource?.title || resolvedSource?.fileName || ""));

        console.log(`[DirectPDFQA] Using structured extraction for ${questionType} ${questionNo}`);
        const { askGeminiDirectPdfStructured, askIndexedPdfQuestionStructured } = await import("../ai-core/pdf/directPdfQa");
        const syllabusGrounding = await getSftSyllabusGroundingPdf(req.user.uid, subject);
        let result: any;

        const runFullPaperVisualScan = async () => {
          const sourceGcsUri = isVertexAiEnabled()
            ? storageGsUri(resolvedSource.__resolvedStoragePath)
            : "";

          if (sourceGcsUri) {
            return askGeminiDirectPdfStructured({
              uid: req.user.uid,
              sourceId,
              pdfGcsUri: sourceGcsUri,
              year: year || "unknown",
              subject: subject || "unknown",
              questionType,
              questionNo,
              prompt: effectivePrompt,
              allowOfficialAnswer,
              syllabusPdfBuffer: syllabusGrounding?.buffer,
              syllabusPdfGcsUri: syllabusGrounding?.gcsUri,
            });
          }

          const loaded = await loadPdfSourceBuffer({
            source: resolvedSource,
            storagePath: resolvedSource.__resolvedStoragePath,
            submittedDownloadUrl: resolvedSource.__verifiedDownloadUrl,
          });
          return askGeminiDirectPdfStructured({
            uid: req.user.uid,
            sourceId,
            pdfBuffer: loaded.buffer,
            year: year || "unknown",
            subject: subject || "unknown",
            questionType,
            questionNo,
            prompt: effectivePrompt,
            allowOfficialAnswer,
            syllabusPdfBuffer: syllabusGrounding?.buffer,
            syllabusPdfGcsUri: syllabusGrounding?.gcsUri,
          });
        };

        if (!req.file) {
          const indexed = await retrieveExactPaperQuestion({
            uid: req.user.uid,
            sourceId,
            subject,
            year,
            questionNo,
            questionType,
          });
          const fullPaperChunks = Array.isArray(indexed.allChunks) && indexed.allChunks.length > 0
            ? indexed.allChunks
            : indexed.chunks;
          const canTrustFullPaperIndex = !indexed.badTextQuality
            && !indexed.needsOcr
            && !indexed.needsLegacyConversion
            && fullPaperChunks.length > 0;

          if (canTrustFullPaperIndex) {
            result = await askIndexedPdfQuestionStructured({
              uid: req.user.uid,
              sourceId,
              chunks: fullPaperChunks,
              year: year || "unknown",
              subject: subject || "unknown",
              questionType,
              questionNo,
              allowOfficialAnswer,
              syllabusPdfBuffer: syllabusGrounding?.buffer,
              syllabusPdfGcsUri: syllabusGrounding?.gcsUri,
            });

            if (result?.errorCode === "FULL_PAPER_VISUAL_SCAN_REQUIRED") {
              console.log(`[DirectPDFQA] OCR index could not isolate Q${questionNo}; scanning the complete original PDF visually.`);
              result = await runFullPaperVisualScan();
            }
          } else {
            console.log(`[DirectPDFQA] Searchable full-paper index unavailable; scanning the complete original PDF visually.`);
            result = await runFullPaperVisualScan();
          }
        } else {
          result = await askGeminiDirectPdfStructured({
            uid: req.user.uid,
            sourceId: sourceId || "uploaded_temp",
            pdfBuffer: buffer as Buffer,
            year: year || "unknown",
            subject: subject || "unknown",
            questionType,
            questionNo,
            prompt: effectivePrompt,
            allowOfficialAnswer,
            syllabusPdfBuffer: syllabusGrounding?.buffer,
            syllabusPdfGcsUri: syllabusGrounding?.gcsUri,
          });
        }
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
              message: "AI credits අවසන් නිසා PDF scan/answer generation complete වුණේ නැහැ.",
              canRetry: false
            };
          }

          return {
            ok: false,
            status: result.errorCode === "PDF_REINDEX_REQUIRED" ? 409 : undefined,
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
      if (!buffer) {
        return {
          ok: false,
          status: 400,
          errorCode: "DIRECT_QA_MISSING_STRUCTURED_INTENT",
          message: "Select a question number before asking from a saved PDF.",
        };
      }
      const result = await askGeminiDirectPdf({
        sourceId: sourceId || "uploaded_temp",
        pdfBuffer: buffer as Buffer,
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
    const mapped = directQaHttpError(err);
    return res.status(mapped.status).json(mapped.body);
  }
});

// 6. Get Question Cache for a Source
pdfRoutes.get("/question-cache", requireFirebaseUser, async (req: any, res) => {
  try {
    const { sourceId } = req.query;
    if (!sourceId) return res.status(400).json({ ok: false, error: "Missing sourceId" });
    const db = getAdminDb();
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
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const canRepair = req.user?.admin === true
      || roles.some((role: string) => ["admin", "content_editor", "ops"].includes(role));
    if (!canRepair) {
      return res.status(403).json({ ok: false, code: "ADMIN_REQUIRED", message: "Admin or content-editor access is required." });
    }
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
