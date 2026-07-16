import { stripRawVisualBlocks } from "./stripVisualBlocks";
import { normalizeStoragePath } from "./normalizeStoragePath";
import { getLargeEndpointUrl } from "../apiBase";
import { apiFetch } from "../api";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";
import { cleanAssistantResponse, normalizeSinhalaUnicode } from "../../../shared/text/assistantText";

export type DirectPdfQaResult = {
  ok: boolean;
  answer?: string;
  found?: boolean;
  cached?: boolean;
  model?: string;
  error?: string;
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
  sourceEvidence?: any;
};

function looksLikeLegacySinhalaGarbage(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return false;
  const sinhala = (text.match(/[\u0D80-\u0DFF]/g) || []).length;
  const signals = (text.match(/[ñú;=<>]|\b(?:fuu|iy|iys|l=|fkdie|mß|wd;;)\b/g) || []).length;
  return sinhala === 0 && signals >= 2;
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

  if (!source.storagePath) {
    return {
      ok: false,
      errorCode: "DIRECT_QA_SOURCE_MISSING_STORAGE_PATH",
      error: "Source missing storagePath for direct PDF reading."
    };
  }

  try {
    // 1. Normalize PDF path
    const normalized = normalizeStoragePath(source.storagePath);

    // 2. Send the verified source identity plus a short-lived/persistent
    // Firebase download URL. The browser does not download the PDF (so Storage
    // CORS is not involved); it only obtains the URL through the signed-in
    // Firebase SDK. The backend validates that the URL points at the exact
    // resolved source object before reading it.
    const formData = new FormData();
    onProgress?.("fetching", { resolvingSource: true });
    formData.append("storagePath", normalized.kind === "path" ? normalized.path : normalized.url);

    let downloadUrl = source.downloadUrl || source.url || (normalized.kind === "downloadUrl" ? normalized.url : "");
    if (!downloadUrl && normalized.kind === "path") {
      try {
        downloadUrl = await getDownloadURL(ref(storage, normalized.path));
      } catch (error) {
        // Admin Storage remains a server fallback. Do not fail the request just
        // because client rules do not expose a download token.
        if (import.meta.env.DEV) console.warn("[DirectPDFQA] Firebase URL hand-off unavailable", error);
      }
    }
    if (downloadUrl) formData.append("downloadUrl", downloadUrl);

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

    const postQuestion = async () => {
      const backendController = new AbortController();
      const abort = () => backendController.abort(new Error("USER_CANCELLED"));
      signal?.addEventListener("abort", abort, { once: true });
      const backendTimeout = window.setTimeout(() => backendController.abort(), 80_000);
      try {
        return await apiFetch(endpoint, {
          method: "POST",
          body: formData,
          signal: backendController.signal,
        });
      } catch (error: any) {
        throw makeDirectQaError("DIRECT_QA_BACKEND_ERROR", source, {
          message: error?.name === "AbortError"
            ? "PDF answer request timed out. The source will be reindexed before the next retry."
            : String(error?.message || error),
        });
      } finally {
        window.clearTimeout(backendTimeout);
        signal?.removeEventListener("abort", abort);
      }
    };

    let response = await postQuestion();

    // A saved PDF is never scanned as one giant serverless request. If its
    // text index is missing, rebuild that index once and retry the exact query.
    if (response.status === 409) {
      const reindexHint = await response.clone().json().catch(() => ({}));
      const reindexBody = new FormData();
      reindexBody.append("sourceId", String(source.id || source.sourceId));
      reindexBody.append("mode", reindexHint.needsOcr ? "ocr" : "auto");
      if (downloadUrl) reindexBody.append("downloadUrl", downloadUrl);
      onProgress?.("scanning", { reindexing: true, needsOcr: Boolean(reindexHint.needsOcr) });

      const reindexController = new AbortController();
      const abortReindex = () => reindexController.abort(new Error("USER_CANCELLED"));
      signal?.addEventListener("abort", abortReindex, { once: true });
      const reindexTimeout = window.setTimeout(() => reindexController.abort(), reindexHint.needsOcr ? 170_000 : 90_000);
      try {
        const reindexResponse = await apiFetch("/api/rag/reindex-uploaded", {
          method: "POST",
          body: reindexBody,
          signal: reindexController.signal,
        });
        const reindexResult = await reindexResponse.json().catch(() => ({}));
        if (!reindexResponse.ok || Number(reindexResult.chunkCount || 0) === 0) {
          throw makeDirectQaError("PDF_REINDEX_FAILED", source, {
            status: reindexResponse.status,
            message: reindexResult.message || reindexResult.error || "The PDF text index could not be rebuilt.",
          });
        }
      } finally {
        window.clearTimeout(reindexTimeout);
        signal?.removeEventListener("abort", abortReindex);
      }
      response = await postQuestion();
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
      const errorData = await response.json().catch(() => ({}));
      throw makeDirectQaError("DIRECT_QA_BACKEND_ERROR", source, {
        endpoint,
        status: response.status,
        message: errorData.error || errorData.message || `Backend error: ${response.status}`
      });
    }

    onProgress?.("generating");
    const result = await response.json();
    // Transform structured output to text if needed
    if (result.ok && result.answer && typeof result.answer === 'object') {
       const { officialAnswer, solvedAnswer, explanationSinhala } = result.answer;
       const { questionText, options } = result.sourceEvidence || {};
       const readableEvidence = !looksLikeLegacySinhalaGarbage(questionText)
         && !(Array.isArray(options) && options.some(looksLikeLegacySinhalaGarbage));

       let text = "";

       let finalAnswerText = "";
       let answerStatus = "Unknown";
       let explanation = explanationSinhala;
       let whyOthersWrong = [];

       if (officialAnswer) {
         finalAnswerText = officialAnswer;
         answerStatus = "Official marking scheme verified";
       } else if (solvedAnswer) {
         const optNo = solvedAnswer.optionNo ? `(${solvedAnswer.optionNo}) ` : "";
         finalAnswerText = `${optNo}${solvedAnswer.optionText || ""}`;
         answerStatus = "AI-derived from exact PDF evidence";
         explanation = solvedAnswer.explanationSinhala || explanation;
         whyOthersWrong = solvedAnswer.whyOthersWrong || [];
       } else {
         return {
           ok: false,
           found: false,
           errorCode: "MCQ_SOLVER_EMPTY",
           stage: "ANSWER_VALIDATION",
           error: readableEvidence
             ? "The question was located, but no validated answer option was returned."
             : "The PDF visual could not be transcribed safely.",
         };
       }

       if (finalAnswerText) {
         text += `**පිළිතුර:** ${stripRawVisualBlocks(finalAnswerText)}\n\n`;
       }

       if (explanation) {
         text += `${stripRawVisualBlocks(explanation)}\n\n`;
       }

       if (whyOthersWrong && whyOthersWrong.length > 0) {
         text += `**අනෙක් විකල්ප නොගැළපෙන්නේ ඇයි?**\n\n`;
         text += whyOthersWrong.map((reason: string) => `- ${stripRawVisualBlocks(reason)}`).join('\n') + "\n\n";
       }

       if (answerStatus === "Official marking scheme verified") text += `_Marking scheme එකෙන් තහවුරු කළ පිළිතුර._\n`;

       result.answer = cleanAssistantResponse(text);
    }

    if (typeof result.answer === "string") result.answer = cleanAssistantResponse(result.answer);
    if (typeof result.questionText === "string") result.questionText = normalizeSinhalaUnicode(result.questionText);
    if (typeof result.explanationSinhala === "string") result.explanationSinhala = cleanAssistantResponse(result.explanationSinhala);
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
