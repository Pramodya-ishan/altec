import { auth } from "../firebase";
import { stripRawVisualBlocks } from "./stripVisualBlocks";
import { normalizeStoragePath } from "./normalizeStoragePath";
import { getLargeEndpointUrl } from "../apiBase";
import type { VisualBlock } from "../visualBlocks";
import { formatDirectPdfAnswer } from "./directPdfAnswerFormatter";
import { apiFetch } from "../api";

export type DirectPdfQaResult = {
  ok: boolean;
  answer?: string;
  found?: boolean;
  cached?: boolean;
  model?: string;
  error?: string;
  message?: string;
  errorCode?: string;
  stage?: string;
  pageNumber?: number;
  questionNo?: string;
  questionType?: string;
  questionText?: string;
  officialAnswer?: string;
  estimatedAnswer?: string;
  explanationSinhala?: string;
  reason?: string;
  canRetry?: boolean;
  retryAfterMs?: number;
  sourceEvidence?: any;
  pending?: boolean;
  code?: string;
  status?: string;
  visualBlocks?: VisualBlock[];
  extractionMethod?: string;
  completed?: boolean;
  qualityReport?: any;
};

function asksForPdfVisual(value: unknown) {
  return /(?:image|picture|diagram|graph|chart|figure|visual|crop|රූප|පින්තූර|සටහන|ප්‍රස්තාර|වගුව)/iu.test(String(value || ""));
}

function makeDirectQaError(code: string, source: any, details: any = {}): Error {
  const err = new Error(details.message || `Direct PDF QA Stage Failed: ${code}`);
  (err as any).errorCode = code;
  (err as any).stage = code;
  (err as any).details = {
    sourceId: source.id || source.sourceId,
    storagePath: source.storagePath,
    endpoint: details.endpoint,
    status: details.status,
    statusText: details.statusText,
    ...details
  };
  return err;
}

export async function askDirectPdfQa(params: {
  source: any;
  prompt: string;
  questionId?: string;
  questionNo?: string;
  questionType?: string;
  subject?: string;
  year?: string;
  signal?: AbortSignal;
  onProgress?: (step: "fetching" | "uploading" | "scanning" | "generating", payload?: any) => void;
}): Promise<DirectPdfQaResult> {
  const { source, prompt, questionId, questionNo, questionType, subject, year, onProgress, signal } = params;

  if (!source.storagePath && !(source.id || source.sourceId)) {
    return {
      ok: false,
      errorCode: "DIRECT_QA_SOURCE_MISSING_ID",
      error: "The selected PDF source does not have a valid identifier."
    };
  }

  try {
    // 1. Normalize PDF path
    const normalized = source.storagePath ? normalizeStoragePath(source.storagePath) : null;

    // 2. Send only the source identity to our authenticated backend. The server
    // reads the object with Firebase Admin after verifying source ownership.
    // Browser-side download URLs are intentionally not fetched here: Firebase
    // Storage CORS rules are not an authorization boundary and were causing the
    // DirectPDFQA flow to fail before it reached the backend.
    const formData = new FormData();
    onProgress?.("fetching", { serverSide: true });
    if (normalized) {
      formData.append("storagePath", normalized.kind === "path" ? normalized.path : normalized.url);
    }
    formData.append("sourceId", source.id || source.sourceId);
    formData.append("prompt", prompt);
    if (questionId) formData.append("questionId", questionId);
    formData.append("questionNo", String(questionNo || ""));
    formData.append("questionType", questionType || "MCQ");
    if (subject || source.subject) formData.append("subject", subject || source.subject);
    if (year || source.year) formData.append("year", String(year || source.year));

    // 3. POST to backend
    const endpoint = getLargeEndpointUrl("/api/pdf/direct-qa-file");
    onProgress?.("scanning", { serverSide: true });

    const backendController = new AbortController();
    if (signal) {
      signal.addEventListener("abort", () => backendController.abort(new Error("USER_CANCELLED")));
    }
    const backendTimeout = window.setTimeout(() => backendController.abort(), 150000);

    const postDirectQa = (url: string) => apiFetch(url, {
      method: "POST",
      body: formData,
      signal: backendController.signal,
    });

    let response;
    try {
      response = await postDirectQa(endpoint);
      // Older Vercel routing configurations could deliver the request to the
      // Express catch-all as /api/index and return API_NOT_FOUND. The direct
      // /api function alias carries the original path explicitly, so one safe
      // retry reaches the same authenticated route without uploading twice to
      // Storage or invoking a different backend.
      if (response.status === 404 || response.status === 503) {
        const routeError = await response.clone().json().catch(() => null) as any;
        if (routeError?.code === "API_NOT_FOUND") {
          const fallbackEndpoint = getLargeEndpointUrl("/api?__path=pdf%2Fdirect-qa-file");
          response = await postDirectQa(fallbackEndpoint);
        }
      }
    } catch (e: any) {
      throw makeDirectQaError("DIRECT_QA_BACKEND_ERROR", source, { message: e.name === "AbortError" ? "The PDF request timed out. Reprocess the document and try again." : e.message });
    } finally {
      clearTimeout(backendTimeout);
    }

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw makeDirectQaError("DIRECT_QA_BACKEND_NON_JSON_RESPONSE", source, {
          endpoint,
          status: response.status,
          textPreview: text.slice(0, 300)
        });
      }
      const errorData = await response.json().catch(() => ({})) as DirectPdfQaResult;
      // Keep the server's typed failure intact. The UI can then distinguish a
      // missing OCR configuration, an indexing job, an expired login, and a
      // genuine backend failure instead of presenting all of them as the same
      // generic timeout.
      return {
        ...errorData,
        ok: false,
        errorCode: errorData.errorCode || "DIRECT_QA_BACKEND_ERROR",
        stage: errorData.stage || "DIRECT_QA_BACKEND_ERROR",
        error: errorData.error || errorData.message || `Backend error: ${response.status}`,
      };
    }

    onProgress?.("generating");
    const result = await response.json();
    const evidence = result?.sourceEvidence;
    if (
      result?.ok
      && evidence?.pageNumber
      && (evidence?.hasRelevantImage === true || asksForPdfVisual(prompt))
      && (source.id || source.sourceId)
    ) {
      try {
        const previewResponse = await apiFetch(getLargeEndpointUrl("/api/pdf/question-preview"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: source.id || source.sourceId,
            storagePath: normalized ? (normalized.kind === "path" ? normalized.path : normalized.url) : source.storagePath,
            pageNumber: evidence.pageNumber,
            crop: evidence.imageRegion || null,
            title: source.title || source.fileName,
          }),
        });
        const preview = await previewResponse.json().catch(() => null);
        if (previewResponse.ok && preview?.imageUrl) {
          result.sourceEvidence.imagePreviewUrl = preview.imageUrl;
          result.sourceEvidence.imagePreviewStoragePath = preview.storagePath;
        }
      } catch (previewError) {
        if (import.meta.env.DEV) console.warn("[DirectPDFQA] PDF image preview unavailable", previewError);
      }
    }
    // Transform the evidence-first JSON into clean Markdown plus structured
    // visual aids. The model never emits raw visual JSON into the answer text.
    if (result.ok && result.answer && typeof result.answer === "object") {
      const formatted = formatDirectPdfAnswer({
        source,
        year,
        questionNo,
        questionType,
        result,
      });
      result.answer = formatted.markdown;
      result.visualBlocks = formatted.visualBlocks;
    }

    return result;
  } catch (err: any) {
    if (import.meta.env.DEV) console.error("[DirectPDFQA]", err);
    return {
      ok: false,
      errorCode: err.errorCode || "DIRECT_QA_UNKNOWN_ERROR",
      stage: err.stage,
      error: err.message
    };
  }
}
