import { storage, auth } from "../firebase";
import { stripRawVisualBlocks } from "./stripVisualBlocks";
import { ref, getBlob, getDownloadURL } from "firebase/storage";
import { normalizeStoragePath } from "./normalizeStoragePath";

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
}): Promise<DirectPdfQaResult> {
  const { source, prompt, questionId, questionNo, questionType, subject, year } = params;

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
    
    // 2. Prepare FormData
    const formData = new FormData();
    
    if (normalized.kind === "downloadUrl" || normalized.path) {
      let downloadUrl = "";
      if (normalized.kind === "downloadUrl") {
         downloadUrl = normalized.url;
      } else {
         try {
             downloadUrl = await getDownloadURL(ref(storage, normalized.path));
         } catch(e) {
             console.error("Failed to get download URL", e);
             throw makeDirectQaError("DIRECT_QA_FIREBASE_FETCH_FAILED", source, {
                status: 500,
                statusText: "Storage rules / App Check / login check",
                message: "PDF source එක තියෙනවා, නමුත් Storage permission නිසා open/scan කරන්න බැහැ. Storage rules/App Check/login check කරන්න."
             });
         }
      }
      
      console.info("[DirectPDFQA] Fetching blob from client...");
      // Fetching from download URL
      const r = await fetch(downloadUrl);
      if (!r.ok) {
        throw makeDirectQaError("DIRECT_QA_FIREBASE_FETCH_FAILED", source, {
          status: r.status,
          statusText: r.statusText,
          url: downloadUrl
        });
      }
      const blob = await r.blob();
      formData.append("file", blob, source.fileName || `${source.id || source.sourceId}.pdf`);
    }

    formData.append("sourceId", source.id || source.sourceId);
    formData.append("prompt", prompt);
    if (questionId) formData.append("questionId", questionId);
    formData.append("questionNo", String(questionNo || ""));
    formData.append("questionType", questionType || "MCQ");
    if (subject || source.subject) formData.append("subject", subject || source.subject);
    if (year || source.year) formData.append("year", String(year || source.year));

    // 3. POST to backend
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const endpoint = `${apiBase}/api/pdf/direct-qa-file`;
    console.info("[DirectPDFQA] Posting to backend:", endpoint);

    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || ""}`,
      },
      body: formData,
    });

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

    const result = await response.json();
    console.info("[DirectPDFQA] Backend response received:", result.found ? "FOUND" : "NOT_FOUND");
    
    // Transform structured output to text if needed
    if (result.ok && result.answer && typeof result.answer === 'object') {
       const { officialAnswer, solvedAnswer, explanationSinhala } = result.answer;
       const { questionText, options } = result.sourceEvidence || {};
       
       let text = "";
       text += `📄 **Source evidence**\n`;
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
         answerStatus = "AI-solved from extracted question";
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

       text += `📌 **Answer status**\n${answerStatus}`;
       
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
