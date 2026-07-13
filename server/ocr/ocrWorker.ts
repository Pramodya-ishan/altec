import { getAdminDb } from "../firebase/admin";
import { checkOcrJobStatus } from "./cloudVisionOcr";
import { finalizePipelineProcessing } from "../pdf/processingPipeline";

export function startOcrWorker(intervalMs = 60000) {
  if (process.env.NODE_ENV === "test") return;

  setInterval(async () => {
    try {
      const db = getAdminDb();
      const snapshot = await db.collection("ocr_jobs")
        .where("status", "==", "running")
        .limit(10)
        .get();

      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const sourceId = doc.id;
        try {
          const job = await checkOcrJobStatus(sourceId);
          if (job.status === "ready" && job.result) {
            console.log(`[OCR Worker] Background OCR job became ready. Running finalization for ${sourceId}`);
            
            const srcSnap = await db.collection("rag_sources").doc(sourceId).get();
            if (!srcSnap.exists) continue;
            const src = srcSnap.data()!;

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
            console.log(`[OCR Worker] Successfully finalized OCR for ${sourceId}`);
          } else if (job.status === "failed") {
            console.warn(`[OCR Worker] Job ${sourceId} failed.`);
          }
        } catch (err) {
          console.error(`[OCR Worker] Error processing job ${sourceId}:`, err);
        }
      }
    } catch (err) {
      console.error("[OCR Worker] Error in worker loop:", err);
    }
  }, intervalMs);
}
