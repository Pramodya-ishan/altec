import { getAdminDb, getAdminBucket } from "../firebase/admin";
import { extractPdfText } from "./extractText";
import { runCloudVisionPdfOcr } from "../ocr/cloudVisionOcr";
import { generateSinhalaTextPdf } from "./generateSinhalaTextPdf";
import { invalidateInventoryCache, computeIndexStatus } from "../sources/sourceInventoryService";
import { normalizeSubject, detectQuestionNo } from "../rag/routes";
import { detectLessonForChunk } from "./lessonDetector";
import { extractPdfPagesWithGemini, isGeminiPdfOcrConfigured } from "./geminiPdfOcr";
import { isSharedSourceScope } from "../utils/contentPermissions";
import { updateLessonResourceProcessing } from "../lessonResources/service";
import { failPdfProcessingJob, startPdfProcessingJob, updatePdfProcessingJob } from "./jobManager";
import { OcrCandidate, selectOcrEnsemble } from "./ocrEnsemble";
import { calculateDocumentQuality, calculateTextOnlyQuality, classifyDocumentMetadata } from "../platform/documentIntelligence";

export interface ProcessUploadedPdfParams {
  uid: string;
  sourceId: string;
  storagePath: string;
  fileName: string;
  title: string;
  subject: string;
  year?: string | null;
  resourceType: string;
  sourceType?: string | null;
  sourceScope: string;
  lesson?: string;
  buffer?: Buffer;
  forceOcr?: boolean;
}

export async function processUploadedPdf(params: ProcessUploadedPdfParams): Promise<{
  ok: boolean;
  status: "ready" | "queued" | "failed" | "needs_ocr" | "needs_legacy_conversion" | "legacy_converted";
  message: string;
  chunkCount: number;
  needsOcr: boolean;
  extractionMethod: string;
  error?: string;
}> {
  let {
    uid,
    sourceId,
    storagePath,
    fileName,
    title,
    subject,
    year,
    resourceType,
    sourceType,
    sourceScope,
    lesson,
    buffer,
    forceOcr = false,
  } = params;

  console.log(`Starting PDF processing pipeline for sourceId: ${sourceId}, title: "${title}", forceOcr: ${forceOcr}`);
  await startPdfProcessingJob({ sourceId, uid, maxAttempts: 3, forceRestart: forceOcr });

  const db = getAdminDb();
  const sourceRef = db.collection("rag_sources").doc(sourceId);

  try {
    if (!buffer) {
      if (!storagePath) {
        throw new Error("Either buffer or storagePath must be provided.");
      }
      console.log(`Downloading PDF from ${storagePath} for sourceId: ${sourceId}`);
      await updatePdfProcessingJob(sourceId, "downloading");
      const bucket = getAdminBucket();
      const file = bucket.file(storagePath);
      const [downloaded] = await file.download();
      buffer = downloaded;
    }

    let pages: any[] = [];
    let fullText = "";
    let needsOcr = false;
    let needsLegacyConversion = false;
    let textEncoding = "unknown";
    let extractionMethod = "pdf_text";
    let ocrConfidence = 1.0;

    // --- STEP A & B: Text Extraction & Quality Detection ---
    await updatePdfProcessingJob(sourceId, "extracting_text");
    const extraction = await extractPdfText(buffer as Buffer);
    if (extraction.status === "PDF_PARSER_UNAVAILABLE" || extraction.status === "PDF_PARSER_RUNTIME_ERROR") {
      const parserError = new Error(extraction.message || "PDF parser failed.");
      (parserError as any).code = extraction.status;
      throw parserError;
    }
    
    pages = extraction.pages || [];
    const textLayerCandidates: OcrCandidate[] = pages.map((page: any) => ({
      pageNumber: page.pageNumber,
      text: String(page.text || page.rawText || ""),
      provider: String(page.textEncoding || "").startsWith("legacy_") ? "legacy_converter" : "pdf_text",
      confidence: Number(page.conversionConfidence || (page.pageQuality === "native_unicode" || page.pageQuality === "native_english" ? 0.98 : 0.45)),
    }));
    fullText = extraction.text || "";
    needsOcr = extraction.needsOcr;
    needsLegacyConversion = extraction.needsLegacyConversion;
    textEncoding = extraction.textEncoding;
    await updatePdfProcessingJob(sourceId, "repairing_sinhala", {
      pageCount: pages.length,
      textEncoding,
      extractionMethod,
      warning: extraction.message || null,
    });

    // Calculate quality metrics
    const textLength = fullText.length;
    const unicodeMatches = fullText.match(/[\u0D80-\u0DFF]/g);
    const unicodeCount = unicodeMatches ? unicodeMatches.length : 0;
    const unicodeSinhalaRatio = textLength > 0 ? (unicodeCount / textLength) : 0;

    const replacementMatches = fullText.match(/\uFFFD/g);
    const replacementCount = replacementMatches ? replacementMatches.length : 0;
    const replacementCharRatio = textLength > 0 ? (replacementCount / textLength) : 0;

    // Detect old Sinhala legacy patterns
    const legacyPatterns = [
      "LKavdxl", "cHd", "ñ", "ú", "Y%", "m%", "fuu", "fyd", "iS", "wxl", "m%Yak", "ms<s;=re", "fnda", ";dlaIK"
    ];
    let legacyPatternScore = 0;
    legacyPatterns.forEach(pat => {
      const regex = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = fullText.match(regex);
      if (matches) {
        legacyPatternScore += matches.length;
      }
    });

    const isScanned = textLength < 40 || pages.length === 0;
    const hasHighReplacement = replacementCharRatio > 0.05;

    console.log(`PDF Quality Metrics for ${sourceId}:`, {
      textLength,
      unicodeSinhalaRatio: unicodeSinhalaRatio.toFixed(3),
      replacementCharRatio: replacementCharRatio.toFixed(3),
      legacyPatternScore,
      isScanned,
      hasHighReplacement,
      needsOcr,
      needsLegacyConversion,
    });

    // --- STEP C & D: Legacy Font Conversion & OCR Fallback ---
    let triggerOcr = forceOcr || isScanned || hasHighReplacement;

    const legacyDetected = textEncoding.startsWith("legacy_") || legacyPatternScore > 5;
    const legacyCandidatePages = pages.filter((page: any) =>
      String(page?.textEncoding || "").startsWith("legacy_")
      && String(page?.rawText || page?.text || "").trim().length >= 40,
    );
    const trustedLegacyPages = legacyCandidatePages.filter((page: any) =>
      page?.pageQuality === "legacy_convertible"
      && Number(page?.conversionConfidence || 0) >= 0.62
      && String(page?.text || "").trim().length >= 20,
    );
    const untrustedLegacyPages = legacyCandidatePages.filter((page: any) =>
      page?.pageQuality !== "legacy_convertible"
      || Number(page?.conversionConfidence || 0) < 0.62
      || String(page?.text || "").trim().length < 20,
    );
    const trustedLegacyTextLength = trustedLegacyPages.reduce(
      (total: number, page: any) => total + String(page?.text || "").trim().length,
      0,
    );

    if (
      legacyDetected
      && trustedLegacyPages.length > 0
      && untrustedLegacyPages.length === 0
      && trustedLegacyTextLength >= 40
      && fullText.trim().length >= 40
    ) {
      extractionMethod = "legacy_text_layer";
      textEncoding = "legacy_converted_sinhala";
      needsOcr = false;
      needsLegacyConversion = false;
      // Only trusted Unicode conversion may enter RAG directly. A selectable
      // legacy text layer is not enough by itself: low-confidence conversion
      // would otherwise index unreadable FM-Abhaya glyph codes as facts.
      triggerOcr = Boolean(forceOcr);
      console.log(
        `Trusted legacy Sinhala conversion detected. Keeping ${trustedLegacyTextLength} converted characters without OCR.`,
      );
    } else if (legacyDetected) {
      extractionMethod = "legacy_text_untrusted";
      needsOcr = true;
      needsLegacyConversion = true;
      triggerOcr = true;
      console.warn(
        `Legacy Sinhala text was detected, but conversion confidence was too low (${trustedLegacyPages.length} trusted, ${untrustedLegacyPages.length} untrusted pages). Falling back to OCR/document vision.`,
      );
    }

    if (triggerOcr) {
      needsOcr = true;
      // Older deployments expose the switch as OCR_ENABLED while newer ones
      // use ENABLE_CLOUD_VISION_OCR. Accept both names so a correctly
      // configured production project does not silently fall through to a
      // slow whole-PDF model call.
      const isCloudVisionEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true"
        || process.env.OCR_ENABLED === "true";
      const ocrErrors: string[] = [];

      if (isCloudVisionEnabled) {
        console.log(`Triggering Cloud Vision OCR fallback for sourceId: ${sourceId}...`);
        await updatePdfProcessingJob(sourceId, "ocr_running", { extractionMethod: "cloud_vision_ocr" });
        try {
          const ocrResponse = await runCloudVisionPdfOcr({
            sourceId,
            uid,
            buffer: buffer as Buffer,
            languageHints: ["si", "en"],
          });

          if (ocrResponse.queued) {
            await updatePdfProcessingJob(sourceId, "ocr_queued", { extractionMethod: "cloud_vision_ocr" });
            const metaUpdate = {
              ocrStatus: "running",
              indexStatus: "needs_ocr",
              needsOcr: true,
              chunkCount: 0,
              textIndexed: false,
              updatedAt: new Date().toISOString(),
            };
            await sourceRef.set({
              sourceId,
              ownerUid: uid,
              storagePath,
              fileName,
              title,
              subject: normalizeSubject(subject || ""),
              resourceType,
              sourceType: sourceType || resourceType,
              sourceScope,
              ...metaUpdate,
            }, { merge: true });
            if (sourceScope === "past_paper") {
              await db.collection("past_papers").doc(sourceId).set({
                id: sourceId,
                sourceId,
                ownerUid: uid,
                sourceScope,
                ...metaUpdate,
              }, { merge: true }).catch(() => {});
            }
            return {
              ok: true,
              status: "queued",
              message: "OCR processing has been queued.",
              chunkCount: 0,
              needsOcr: true,
              extractionMethod: "cloud_vision_ocr",
            };
          }

          if (ocrResponse.result) {
            const cloudCandidates: OcrCandidate[] = ocrResponse.result.pages.map((page) => ({
              pageNumber: page.pageNumber,
              text: page.text,
              provider: "cloud_vision",
              confidence: page.confidence,
            }));
            const ensemble = selectOcrEnsemble([...textLayerCandidates, ...cloudCandidates]);
            pages = ensemble.pages.map((page) => ({
              pageNumber: page.pageNumber,
              text: page.text,
              rawText: page.text,
              textEncoding: "unicode_sinhala",
              conversionApplied: false,
              conversionConfidence: page.qualityScore,
            }));
            fullText = pages.map((page: any) => page.text).join("\n\n");
            extractionMethod = ensemble.providers.length > 1 ? "ocr_ensemble" : "cloud_vision_ocr";
            textEncoding = "unicode_sinhala";
            ocrConfidence = ensemble.averageQuality || ocrResponse.result.confidence;
            needsOcr = false;
            needsLegacyConversion = false;
            await updatePdfProcessingJob(sourceId, "repairing_sinhala", {
              extractionMethod,
              pageCount: pages.length,
              warning: ensemble.warnings.join(" | ") || null,
            });
          }
        } catch (ocrErr: any) {
          console.error("Cloud Vision OCR operation failed; trying Gemini PDF OCR:", ocrErr);
          ocrErrors.push(`Cloud Vision: ${ocrErr?.message || String(ocrErr)}`);
        }
      }

      if (needsOcr && isGeminiPdfOcrConfigured()) {
        await updatePdfProcessingJob(sourceId, "ocr_running", { extractionMethod: "gemini_pdf_ocr" });
        try {
          const geminiPages = await extractPdfPagesWithGemini(buffer as Buffer);
          const geminiCandidates: OcrCandidate[] = geminiPages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text,
            provider: "gemini_pdf_vision",
            confidence: 0.85,
          }));
          const ensemble = selectOcrEnsemble([...textLayerCandidates, ...geminiCandidates]);
          pages = ensemble.pages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text,
            rawText: page.text,
            textEncoding: "unicode_sinhala",
            conversionApplied: false,
            conversionConfidence: page.qualityScore,
          }));
          fullText = pages.map((page: any) => page.text).join("\n\n");
          extractionMethod = ensemble.providers.length > 1 ? "ocr_ensemble" : "gemini_pdf_ocr";
          textEncoding = "unicode_sinhala";
          ocrConfidence = ensemble.averageQuality || 0.85;
          needsOcr = false;
          needsLegacyConversion = false;
          console.log(`Gemini PDF OCR completed successfully. Extracted ${pages.length} pages.`);
          await updatePdfProcessingJob(sourceId, "repairing_sinhala", {
            extractionMethod,
            pageCount: pages.length,
            warning: ensemble.warnings.join(" | ") || null,
          });
        } catch (ocrErr: any) {
          console.error("Gemini PDF OCR operation failed:", ocrErr);
          ocrErrors.push(`Gemini: ${ocrErr?.message || String(ocrErr)}`);
        }
      }

      if (needsOcr) {
        const errorMsg = ocrErrors.length > 0
          ? `OCR failed. ${ocrErrors.join(" | ")}`
          : "OCR is required, but neither Cloud Vision nor Gemini PDF OCR is configured.";
        await finalizeFailedProcessing({
          sourceId,
          sourceScope,
          uid,
          errorMsg,
          needsOcr: true,
          needsLegacyConversion: false,
          status: "needs_ocr",
        });
        await failPdfProcessingJob(sourceId, { code: "OCR_PROCESSING_UNAVAILABLE", message: errorMsg }, { retryable: true });
        return {
          ok: false,
          status: "needs_ocr",
          message: errorMsg,
          chunkCount: 0,
          needsOcr: true,
          extractionMethod: "none",
          error: errorMsg,
        };
      }
    }

    // --- STEP E, F & G: Post-Clean, Chunk, generate PDF companion & Finalize ---
    if (pages.length === 0) {
      const errorMsg = "No pages could be extracted or OCR'd.";
      await finalizeFailedProcessing({
        sourceId,
        sourceScope,
        uid,
        errorMsg,
        needsOcr: true,
        needsLegacyConversion: false,
        status: "needs_ocr"
      });
      return {
        ok: false,
        status: "needs_ocr",
        message: errorMsg,
        chunkCount: 0,
        needsOcr: true,
        extractionMethod: "none"
      };
    }

    await updatePdfProcessingJob(sourceId, "indexing", {
      extractionMethod,
      pageCount: pages.length,
      textEncoding,
    });
    const finalizeResult = await finalizePipelineProcessing({
      uid,
      sourceId,
      storagePath,
      fileName,
      title,
      subject,
      year,
      resourceType,
      sourceType,
      sourceScope,
      lesson,
      pages,
      extractionMethod,
      textEncoding,
      ocrConfidence,
      needsOcr,
      needsLegacyConversion,
      buffer: buffer as Buffer,
    });
    await updatePdfProcessingJob(sourceId, "ready", {
      extractionMethod,
      pageCount: pages.length,
      chunkCount: finalizeResult.chunkCount,
      textEncoding,
    });

    return {
      ok: true,
      status: finalizeResult.indexStatus,
      message: `PDF processed successfully with ${finalizeResult.chunkCount} chunks.`,
      chunkCount: finalizeResult.chunkCount,
      needsOcr: finalizeResult.needsOcr,
      extractionMethod
    };

  } catch (err: any) {
    console.error(`Unhandled error in processUploadedPdf pipeline for ${sourceId}:`, err);
    await finalizeFailedProcessing({
      sourceId,
      sourceScope,
      uid,
      errorMsg: err.message,
      needsOcr: true,
      needsLegacyConversion: false,
      status: "failed"
    });
    await failPdfProcessingJob(sourceId, err, { retryable: true });
    return {
      ok: false,
      status: "failed",
      message: "The operation failed. Please try again.",
      chunkCount: 0,
      needsOcr: true,
      extractionMethod: "none",
      error: "Internal operation failed."
    };
  }
}

interface FinalizeParams {
  uid: string;
  sourceId: string;
  storagePath: string;
  fileName: string;
  title: string;
  subject: string;
  year?: string | null;
  resourceType: string;
  sourceType?: string | null;
  sourceScope: string;
  lesson?: string;
  pages: {
    pageNumber: number;
    text: string;
    rawText?: string;
    textEncoding?: string;
    conversionApplied?: boolean;
    conversionConfidence?: number;
  }[];
  extractionMethod: string;
  textEncoding: string;
  ocrConfidence: number;
  needsOcr: boolean;
  needsLegacyConversion: boolean;
  buffer?: Buffer;
}

export async function finalizePipelineProcessing(params: FinalizeParams): Promise<{
  chunkCount: number;
  indexStatus: "ready" | "legacy_converted" | "needs_ocr" | "needs_legacy_conversion";
  needsOcr: boolean;
}> {
  const {
    uid,
    sourceId,
    storagePath,
    fileName,
    title,
    subject,
    year,
    resourceType,
    sourceType,
    sourceScope,
    lesson,
    pages,
    extractionMethod,
    textEncoding,
    ocrConfidence,
    needsOcr,
    needsLegacyConversion,
    buffer,
  } = params;

  const db = getAdminDb();
  const bulkWriter = db.bulkWriter();

  // 1. Delete old chunks from rag_chunks
  const rag_chunksSnap = await db.collection("rag_chunks").where("sourceId", "==", sourceId).get();
  rag_chunksSnap.docs.forEach((d: any) => {
    bulkWriter.delete(d.ref);
  });

  // Delete old syllabus chunks if owner_syllabus
  if (sourceScope === "owner_syllabus") {
    const sylChunksSnap = await db.collection("users").doc(uid).collection("syllabus_chunks").where("sourceId", "==", sourceId).get();
    sylChunksSnap.docs.forEach((d: any) => {
      bulkWriter.delete(d.ref);
    });
  }

  // 2. Clean and Chunk pages
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

  let chunkCount = 0;
  const normalizedSubjectKey = normalizeSubject(subject || "");

  for (const p of pages) {
    const pageText = (p.text || "").trim();
    if (!pageText) continue;

    const pageNum = Number(p.pageNumber || 1);
    const subChunks = chunkText(pageText, 1000, 150);

    for (let j = 0; j < subChunks.length; j++) {
      const chunkTextContent = subChunks[j];
      const questionNo = detectQuestionNo(chunkTextContent);
      const detectedLesson = lesson?.trim() || detectLessonForChunk(chunkTextContent, normalizedSubjectKey);
      const chunkId = `chunk_${sourceId}_${chunkCount}`;

      const rawPreview = p.rawText 
        ? p.rawText.slice(0, 200) 
        : chunkTextContent.slice(0, 200);

      // Clean the OCR text block lightly
      const cleanedChunkText = chunkTextContent
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // remove control chars
        .trim();

      const chunkDoc = {
        sourceId,
        pageNumber: pageNum,
        questionNo: questionNo || null,
        ownerUid: uid,
        text: cleanedChunkText,
        rawTextPreview: rawPreview,
        textEncoding,
        extractionMethod,
        conversionApplied: p.conversionApplied || false,
        ocrConfidence,
        chunkIndex: chunkCount++,
        title,
        fileName,
        subject: normalizedSubjectKey,
        lesson: detectedLesson,
        resourceType,
        sourceType: sourceType || resourceType,
        year: year ? String(year) : null,
        medium: "Sinhala",
        tags: [title, subject].filter(Boolean),
        sourceScope,
        visibility: sourceScope === "official" || sourceScope === "past_paper" ? "official" : (isSharedSourceScope(sourceScope) ? "class" : "private"),
        embeddingStatus: "none",
        createdAt: new Date().toISOString()
      };

      bulkWriter.set(db.collection("rag_chunks").doc(chunkId), chunkDoc);

      if (sourceScope === "owner_syllabus") {
        const sylChunkRef = db.collection("users").doc(uid).collection("syllabus_chunks").doc(chunkId);
        bulkWriter.set(sylChunkRef, { id: chunkId, ...chunkDoc });
      }
    }
  }

  // 3. Generate separate Sinhala text HTML/PDF companion
  console.log(`Generating separate readable Sinhala text PDF (HTML companion) for sourceId: ${sourceId}...`);
  const textPdfResponse = await generateSinhalaTextPdf({
    uid,
    sourceId,
    fileName,
    title,
    subject: normalizedSubjectKey,
    year,
    extractionMethod,
    pages: pages.map(p => ({ pageNumber: p.pageNumber, text: p.text }))
  });

  // 4. Compute index status
  const finalIndexStatus = computeIndexStatus({
    chunkCount,
    needsOcr,
    needsLegacyConversion,
    textEncoding,
    indexStatus: chunkCount > 0 ? "ready" : "not_indexed"
  });

  const textIndexed = chunkCount > 0 && !needsOcr;
  const combinedText = pages.map((page) => String(page.text || "")).join("\n\n");
  const documentQuality = buffer?.length
    ? calculateDocumentQuality({ buffer, text: combinedText, pages, ocrConfidence })
    : calculateTextOnlyQuality({ text: combinedText, pages, ocrConfidence, fingerprintSeed: `${sourceId}:${storagePath}` });
  const detectedMetadata = classifyDocumentMetadata({
    fileName,
    title,
    subject,
    year,
    resourceType,
    text: combinedText.slice(0, 25_000),
  });
  let duplicateOfSourceId: string | null = null;
  try {
    const duplicates = await db.collection("rag_sources").where("fileFingerprint", "==", documentQuality.fileFingerprint).limit(3).get();
    duplicateOfSourceId = duplicates.docs.map((document: any) => document.id).find((id: string) => id !== sourceId) || null;
  } catch {
    // Duplicate detection is advisory and must not block indexing.
  }

  const metaUpdate = {
    chunkCount,
    needsOcr,
    textIndexed,
    indexStatus: finalIndexStatus,
    needsLegacyConversion,
    textEncoding,
    extractionMethod,
    ocrConfidence,
    ocrStatus: "ready",
    ocrProvider: extractionMethod,
    ocrTextPdfStoragePath: textPdfResponse.ocrTextPdfStoragePath,
    ocrTextStoragePath: textPdfResponse.ocrTextStoragePath,
    ocrTextPdfStatus: textPdfResponse.ocrTextPdfStatus,
    lesson: lesson?.trim() || null,
    documentQuality,
    detectedMetadata,
    fileFingerprint: documentQuality.fileFingerprint,
    duplicateOfSourceId,
    needsTextReview: documentQuality.needsHumanReview,
    lowConfidencePages: documentQuality.lowConfidencePages,
    processedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Write chunks batch
  await bulkWriter.close();
  console.log(`Committed ${chunkCount} chunks to Firestore for source: ${sourceId}`);

  // Processing may outlive the request that registered this source. Use an
  // idempotent upsert so a retry or a missing metadata document cannot turn a
  // successfully uploaded PDF into a Firestore NOT_FOUND response.
  await db.collection("rag_sources").doc(sourceId).set({
    sourceId,
    ownerUid: uid,
    storagePath,
    fileName,
    title,
    subject: normalizedSubjectKey,
    year: year ? String(year) : null,
    resourceType,
    sourceType: sourceType || resourceType,
    sourceScope,
    visibility: sourceScope === "official" || sourceScope === "past_paper" ? "official" : (isSharedSourceScope(sourceScope) ? "class" : "private"),
    ...metaUpdate,
  }, { merge: true });

  if (sourceScope === "past_paper") {
    await db.collection("past_papers").doc(sourceId).set({
      id: sourceId,
      sourceId,
      ownerUid: uid,
      storagePath,
      fileName,
      title,
      subject: normalizedSubjectKey,
      year: year ? String(year) : null,
      resourceType,
      sourceType: sourceType || resourceType,
      sourceScope,
      ...metaUpdate,
    }, { merge: true }).catch(() => {});
  } else if (sourceScope === "owner_syllabus") {
    await db.collection("users").doc(uid).collection("syllabus_resources").doc(sourceId).set({
      id: sourceId,
      sourceId,
      ownerUid: uid,
      storagePath,
      fileName,
      title,
      subject: normalizedSubjectKey,
      year: year ? String(year) : null,
      resourceType,
      sourceType: sourceType || resourceType,
      sourceScope,
      status: finalIndexStatus,
      ...metaUpdate
    }, { merge: true }).catch(() => {});
  }

  if (isSharedSourceScope(sourceScope)) {
    await updateLessonResourceProcessing(sourceId, {
      processingStatus: finalIndexStatus,
      needsOcr,
      textIndexed,
    }).catch(() => undefined);
  }

  invalidateInventoryCache(uid);

  await updatePdfProcessingJob(sourceId, "ready", {
    extractionMethod,
    pageCount: pages.length,
    chunkCount,
    textEncoding,
  });

  return {
    chunkCount,
    indexStatus: finalIndexStatus as any,
    needsOcr
  };
}

async function finalizeFailedProcessing(params: {
  sourceId: string;
  sourceScope: string;
  uid: string;
  errorMsg: string;
  needsOcr: boolean;
  needsLegacyConversion: boolean;
  status: "failed" | "needs_ocr" | "needs_legacy_conversion";
}) {
  const { sourceId, sourceScope, uid, errorMsg, needsOcr, needsLegacyConversion, status } = params;
  const db = getAdminDb();

  const metaUpdate = {
    chunkCount: 0,
    needsOcr,
    textIndexed: false,
    indexStatus: status,
    ocrStatus: "failed",
    ocrError: errorMsg,
    needsLegacyConversion,
    updatedAt: new Date().toISOString()
  };

  await db.collection("rag_sources").doc(sourceId).set({
    sourceId,
    ownerUid: uid,
    sourceScope,
    ...metaUpdate,
  }, { merge: true }).catch(() => {});
  await failPdfProcessingJob(sourceId, { code: status.toUpperCase(), message: errorMsg }, { retryable: true });
  if (sourceScope === "past_paper") {
    await db.collection("past_papers").doc(sourceId).set({
      id: sourceId,
      sourceId,
      ownerUid: uid,
      sourceScope,
      ...metaUpdate,
    }, { merge: true }).catch(() => {});
  } else if (sourceScope === "owner_syllabus") {
    await db.collection("users").doc(uid).collection("syllabus_resources").doc(sourceId).set({
      id: sourceId,
      sourceId,
      ownerUid: uid,
      sourceScope,
      status,
      ...metaUpdate
    }, { merge: true }).catch(() => {});
  }

  if (isSharedSourceScope(sourceScope)) {
    await updateLessonResourceProcessing(sourceId, {
      processingStatus: status,
      needsOcr,
      textIndexed: false,
    }).catch(() => undefined);
  }

  invalidateInventoryCache(uid);
}
