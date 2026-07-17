import express, { Router } from "express";
import multer from "multer";
import { requireFirebaseUser } from "../firebase/authMiddleware";
import { getAdminDb, getAdminBucket } from "../firebase/admin";
import { processUploadedPdf, finalizePipelineProcessing } from "./processingPipeline";
import { checkOcrJobStatus } from "../ocr/cloudVisionOcr";
import { askGeminiDirectPdf } from "./directPdfQa";
import { stripRawVisualBlocks } from "../ai-core/answer/stripVisualBlocks";
import { extractPdfText } from "./extractText";

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

async function resolveDirectQaSource(user: any, sourceId: string, submittedPath: unknown) {
  const db = getAdminDb();
  const snapshots = await Promise.all([
    sourceId ? db.collection("rag_sources").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("past_papers").doc(sourceId).get() : Promise.resolve(null),
    sourceId ? db.collection("users").doc(user.uid).collection("syllabus_resources").doc(sourceId).get() : Promise.resolve(null),
  ]);
  const candidates = snapshots
    .filter((snapshot: any) => snapshot?.exists)
    .map((snapshot: any) => snapshot.data?.() || null)
    .filter(Boolean);
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
  const privileged = user?.admin === true || roles.some((role: string) => ["admin", "content_editor", "ops"].includes(role));
  const visible = ["public", "official", "shared"].includes(String(source?.visibility || ""));
  const owned = source?.ownerUid === user.uid || canUseStoragePath(user, path);
  if (!privileged && !visible && !owned) {
    throw Object.assign(new Error("You do not have access to this PDF source."), { status: 403, code: "DIRECT_QA_SOURCE_FORBIDDEN" });
  }
  return { source, path };
}

// 1. Process uploaded PDF immediately after upload
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
      sourceScope,
      lesson,
      deferProcessing,
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
    await db.collection("rag_sources").doc(sourceId).set({
      sourceId,
      ownerUid: user.uid,
      storagePath: normalizedStoragePath,
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
          message: "ප්‍රශ්න අංකය සහ ප්‍රශ්න වර්ගය සඳහන් කරන්න."
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
              title: String(resolvedSource.title || resolvedSource.fileName || "PDF ගොනුව"),
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
              errorCode: "PDF_INDEXING_STARTED",
              stage: "PDF_INDEXING",
              message: "PDF අකුරු හඳුනාගැනීම තවම ක්‍රියාත්මකයි. අවසන් වූ විගස මෙම ප්‍රශ්නය ස්වයංක්‍රීයව නැවත පරීක්ෂා කරනවා.",
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
              title: String(resolvedSource.title || resolvedSource.fileName || "PDF ගොනුව"),
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
              errorCode: indexingResult.status === "ready" ? "PDF_INDEX_READY_RETRY" : "PDF_INDEXING_STARTED",
              stage: "PDF_INDEXING",
              message: indexingResult.status === "ready"
                ? "PDF එක index කර අවසන්. එම ප්‍රශ්නය නැවත යවන්න."
                : "PDF එකේ අකුරු හඳුනාගැනීම ආරම්භ කළා. Index කිරීම අවසන් වූ පසු එම ප්‍රශ්නය නැවත යවන්න.",
              canRetry: true,
              retryAfterMs: indexingResult.status === "ready" ? 1000 : 12000,
            };
          }

          return {
            ok: false,
            status: 503,
            found: false,
            errorCode: "PDF_OCR_NOT_CONFIGURED",
            stage: "PDF_INDEXING",
            message: "මෙය scan කළ PDF එකක්. OCR_ENABLED=true සහ OCR_INPUT_BUCKET සකසා නැවත deploy කරන්න.",
            canRetry: false,
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
            message: "විශාල PDF එක මුලින් සුරකිමින් index කරන්න. එවිට ප්‍රශ්න ඉක්මනින් අහන්න පුළුවන්.",
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
              message: "AI credits අවසන් නිසා PDF scan/answer generation complete වුණේ නැහැ.",
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
