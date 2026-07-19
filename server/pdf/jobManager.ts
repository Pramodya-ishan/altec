import { getAdminDb } from "../firebase/admin";

export type PdfJobStage =
  | "registered"
  | "downloading"
  | "extracting_text"
  | "repairing_sinhala"
  | "ocr_queued"
  | "ocr_running"
  | "indexing"
  | "building_visuals"
  | "ready"
  | "failed";

export type PdfProcessingJob = {
  sourceId: string;
  uid: string;
  stage: PdfJobStage;
  status: "queued" | "running" | "ready" | "failed";
  progress: number;
  attempt: number;
  maxAttempts: number;
  extractionMethod?: string | null;
  pageCount?: number | null;
  chunkCount?: number | null;
  textEncoding?: string | null;
  warning?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryable: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

const STAGE_PROGRESS: Record<PdfJobStage, number> = {
  registered: 2,
  downloading: 8,
  extracting_text: 20,
  repairing_sinhala: 35,
  ocr_queued: 45,
  ocr_running: 60,
  indexing: 78,
  building_visuals: 90,
  ready: 100,
  failed: 100,
};

function cleanError(value: unknown) {
  return String(value || "").replace(/\s+/gu, " ").trim().slice(0, 1200) || null;
}

async function bestEffortSet(sourceId: string, payload: Record<string, unknown>) {
  try {
    await getAdminDb().collection("pdf_processing_jobs").doc(sourceId).set(payload, { merge: true });
  } catch (error) {
    console.warn("[PDF_JOB] State write skipped", { sourceId, error: String(error) });
  }
}

export async function startPdfProcessingJob(params: {
  sourceId: string;
  uid: string;
  maxAttempts?: number;
  forceRestart?: boolean;
}) {
  const now = new Date().toISOString();
  let attempt = 1;
  try {
    const snapshot = await getAdminDb().collection("pdf_processing_jobs").doc(params.sourceId).get();
    if (snapshot.exists) attempt = Math.max(1, Number(snapshot.data()?.attempt || 0) + 1);
  } catch {
    // Firestore job telemetry is best effort; the processing pipeline remains authoritative.
  }
  const job: PdfProcessingJob = {
    sourceId: params.sourceId,
    uid: params.uid,
    stage: "registered",
    status: "queued",
    progress: STAGE_PROGRESS.registered,
    attempt,
    maxAttempts: Math.max(1, Number(params.maxAttempts || 3)),
    retryable: true,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    warning: null,
  };
  await bestEffortSet(params.sourceId, job);
  return job;
}

export async function updatePdfProcessingJob(sourceId: string, stage: PdfJobStage, details: Partial<PdfProcessingJob> = {}) {
  const status = stage === "ready" ? "ready" : stage === "failed" ? "failed" : stage === "registered" || stage === "ocr_queued" ? "queued" : "running";
  const payload: Partial<PdfProcessingJob> = {
    ...details,
    sourceId,
    stage,
    status,
    progress: Math.max(STAGE_PROGRESS[stage], Number(details.progress || 0)),
    retryable: stage === "failed" ? details.retryable !== false : true,
    updatedAt: new Date().toISOString(),
    completedAt: stage === "ready" || stage === "failed" ? new Date().toISOString() : null,
  };
  await bestEffortSet(sourceId, payload as Record<string, unknown>);
}

export async function failPdfProcessingJob(sourceId: string, error: unknown, details: Partial<PdfProcessingJob> = {}) {
  const errorValue: any = error;
  await updatePdfProcessingJob(sourceId, "failed", {
    ...details,
    errorCode: cleanError(errorValue?.code || details.errorCode || "PDF_PROCESSING_FAILED"),
    errorMessage: cleanError(errorValue?.message || error || details.errorMessage),
    retryable: details.retryable !== false,
  });
}

export async function getPdfProcessingJob(sourceId: string): Promise<PdfProcessingJob | null> {
  const snapshot = await getAdminDb().collection("pdf_processing_jobs").doc(sourceId).get();
  return snapshot.exists ? snapshot.data() as PdfProcessingJob : null;
}

export function publicPdfJob(job: PdfProcessingJob | null) {
  if (!job) return null;
  return {
    sourceId: job.sourceId,
    stage: job.stage,
    status: job.status,
    progress: job.progress,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    extractionMethod: job.extractionMethod || null,
    pageCount: job.pageCount || 0,
    chunkCount: job.chunkCount || 0,
    textEncoding: job.textEncoding || null,
    warning: job.warning || null,
    errorCode: job.errorCode || null,
    errorMessage: job.errorMessage || null,
    retryable: job.retryable,
    updatedAt: job.updatedAt,
  };
}
