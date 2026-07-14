import { auth } from "../firebase";
import { stripRawVisualBlocks } from "./stripVisualBlocks";
import { normalizeStoragePath } from "./normalizeStoragePath";
import { getLargeEndpointUrl } from "../apiBase";

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

  console.info("[DirectPDFQA] Starting for source:", {
    id: source.id || source.sourceId,
    title: source.title,
    storagePath: source.storagePath
  });

  if (!source.storagePath) {
    console.error("[DirectPDFQA] Error: Missing storagePath");
    return {
      ok: false,
      errorCode: "DIRECT_QA_SOURCE_MISSING_STORAGE_PATH",
      error: "Source missing storagePath for direct PDF reading."
    };
  }

  try {
    console.info("[DirectPDFQA] Parsed question", {
      year,
      subject,
      questionType,
      questionNo
    });

    // 1. Normalize PDF path
    const normalized = normalizeStoragePath(source.storagePath);
    console.info("[DirectPDFQA] Normalized path:", normalized);

    // 2. Send only the source identity to our authenticated backend. The server
    // reads the object with Firebase Admin after verifying source ownership.
    // Browser-side download URLs are intentionally not fetched here: Firebase
    // Storage CORS rules are not an authorization boundary and were causing the
    // DirectPDFQA flow to fail before it reached the backend.
    const formData = new FormData();
    onProgress?.("fetching", { serverSide: true });
    formData.append("storagePath", normalized.kind === "path" ? normalized.path : normalized.url);

    formData.append("sourceId", source.id || source.sourceId);
    formData.append("prompt", prompt);
    if (questionId) formData.append("questionId", questionId);
    formData.append("questionNo", String(questionNo || ""));
    formData.append("questionType", questionType || "MCQ");
    if (subject || source.subject) formData.append("subject", subject || source.subject);
    if (year || source.year) formData.append("year", String(year || source.year));

    // 3. POST to backend
    const endpoint = getLargeEndpointUrl("/api/pdf/direct-qa-file");
    console.info("[DirectPDFQA] Posting to backend:", endpoint);
    onProgress?.("scanning", { serverSide: true });

    const token = await auth.currentUser?.getIdToken();
    const backendController = new AbortController();
    if (signal) {
      signal.addEventListener("abort", () => backendController.abort(new Error("USER_CANCELLED")));
    }
    const backendTimeout = setTimeout(() => backendController.abort(), 180000);

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
        body: formData,
        signal: backendController.signal,
      });
    } catch (e: any) {
      throw makeDirectQaError("DIRECT_QA_BACKEND_ERROR", source, { message: e.name === "AbortError" ? "Backend scan timed out (180s). Large PDF direct scan may take time. Reindex first for faster answers." : e.message });
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
      const errorData = await response.json().catch(() => ({}));
      throw makeDirectQaError("DIRECT_QA_BACKEND_ERROR", source, {
        endpoint,
        status: response.status,
        message: errorData.error || errorData.message || `Backend error: ${response.status}`
      });
    }

    onProgress?.("generating");
    const result = await response.json();
    console.info("[DirectPDFQA] Backend response received:", result.found ? "FOUND" : "NOT_FOUND");

    // Transform structured output to text if needed
    if (result.ok && result.answer && typeof result.answer === 'object') {
       const { officialAnswer, solvedAnswer, explanationSinhala } = result.answer;
       const { questionText, options } = result.sourceEvidence || {};

       let text = "";
       text += `<details><summary>📄 **Source evidence**</summary>\n\n`;
       text += `- PDF: ${source.title || "Paper"}\n`;
       text += `- Year: ${year || source.year || "N/A"}\n`;
       text += `- Subject: ${subject || source.subject || "N/A"}\n`;
       text += `- Question: ${questionType || "MCQ"} ${questionNo || ""}\n`;
       text += `- Evidence status: ${result.found ? "Verified from exact PDF" : "Missing"}\n\n`;

       if (questionText) text += `❓ **Question**\n${stripRawVisualBlocks(questionText)}\n\n`;

       if (options && options.length) {
         text += `🔘 **Options**\n${options.map((o: string, i: number) => `(${i+1}) ${stripRawVisualBlocks(o)}`).join('\n')}\n\n`;
       }

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
         answerStatus = "Reasoning";
         explanation = solvedAnswer.explanationSinhala || explanation;
         whyOthersWrong = solvedAnswer.whyOthersWrong || [];
       } else {
         finalAnswerText = "Exact question එක extract වුණා, නමුත් answer එක auto-solve කරන්න බැරි වුණා. Marking scheme/Admin verification අවශ්යයි.";
       }

       if (finalAnswerText) {
         text += `✅ **Answer**\n${stripRawVisualBlocks(finalAnswerText)}\n\n`;
       }

       if (explanation) {
         text += `🧠 **Explanation**\n${stripRawVisualBlocks(explanation)}\n\n`;
       }

       if (whyOthersWrong && whyOthersWrong.length > 0) {
         text += `❌ **Why other options are not correct**\n`;
         text += whyOthersWrong.map((reason: string) => `- ${stripRawVisualBlocks(reason)}`).join('\n') + "\n\n";
       }

       text += `📌 **Answer status**\n${answerStatus}\n</details>\n`;

       result.answer = text;
    }

    return result;
  } catch (err: any) {
    console.error("[DirectPDFQA] Critical Error:", err);
    return {
      ok: false,
      errorCode: err.errorCode || "DIRECT_QA_UNKNOWN_ERROR",
      stage: err.stage,
      error: err.message
    };
  }
}
