import { useState, useRef } from "react";
import { auth } from "../lib/firebase";
import { getAuthToken } from "../lib/api";
import { SSEParser } from "../lib/sseParser";
import { stripRawVisualBlocks } from "../lib/ai/stripVisualBlocks";
import { getUnclosedMathInfo, sanitizeMathMarkdown } from "../lib/mathSanitizer";
import { extractVisualBlocks } from "../lib/visualBlockExtractor";

const activeDirectQaKeys = new Set<string>();

export function useAIWorkflowStream() {
  const activeStreamRef = useRef(false);
  const activeDirectQaKeysRef = useRef(new Set<string>());
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [tools, setTools] = useState<Array<{ name: string; status: string; query?: string; urlCount?: number }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
  const [safeSummary, setSafeSummary] = useState<string[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [isRecoverableError, setIsRecoverableError] = useState(false);
  
  // Web Candidates & Import States
  const [webCandidates, setWebCandidates] = useState<any[]>([]);
  const [pendingImport, setPendingImport] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<any>(null);
  const [importComplete, setImportComplete] = useState<any>(null);

  const abortRef = useRef<AbortController | null>(null);

  async function sendAIMessage(params: {
    prompt?: string;
    activeSubject?: string;
    mode?: string;
    history?: any[];
    image?: { mimeType: string; data: string };
    isContinue?: boolean;
    originalPrompt?: string;
    previousAssistantText?: string;
    sources?: any[];
    chatId?: string;
    reason?: string;
    assistantMessageId?: string;
    onToken?: (text: string) => void;
    onSources?: (sources: any[]) => void;
    onSummary?: (items: string[]) => void;
    onStatus?: (status: any) => void;
    onTools?: (tools: any[]) => void;
    onWebCandidates?: (candidates: any[]) => void;
    onPendingImport?: (importData: any) => void;
    onImportStatus?: (statusData: any) => void;
    onImportComplete?: (completeData: any) => void;
    onError?: (err: { error: string; recoverable?: boolean }) => void;
    onDone?: (data: any) => void;
    onVisualBlocks?: (blocks: any[]) => void;
    onSuggestions?: (suggestions: string[]) => void;
  }) {
    const {
      prompt,
      activeSubject,
      mode = "auto",
      history = [],
      image,
      isContinue = false,
      originalPrompt,
      previousAssistantText,
      sources: inputSources = [],
      chatId,
      reason,
      assistantMessageId,
      onToken,
      onSources,
      onSummary,
      onStatus,
      onTools,
      onWebCandidates,
      onPendingImport,
      onImportStatus,
      onImportComplete,
      onError,
      onDone,
      onVisualBlocks,
      onSuggestions
    } = params;

    if (activeStreamRef.current) {
      console.warn("[Stream] Already streaming. Duplicate request ignored.");
      return;
    }
    activeStreamRef.current = true;
    let directPdfQaPending = false;

    setAnswer("");
    setError("");
    setIsRecoverableError(false);
    setSafeSummary([]);
    setSources([]);
    setTools([]);
    setTotalSeconds(null);
    setWebCandidates([]);
    setPendingImport(null);
    setImportStatus(null);
    setImportComplete(null);
    setIsStreaming(true);

    if (!navigator.onLine) {
      const errorMsg = "සම්බන්ධතාවය බිඳවැටී ඇත (Offline). Please check your internet connection and try again.";
      setError(errorMsg);
      setIsStreaming(false);
      setStatus({ stage: "error", label: "Offline" });
      onError?.({ error: errorMsg });
      onDone?.({ completed: false, reason: "OFFLINE" });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let response: Response | null = null;
      let attempt = 0;
      const maxAttempts = 3;
      let backoffDelay = 1000;

      const endpoint = isContinue ? "/api/ai/continue" : "/api/ai/respond-stream";
      const payload = isContinue
        ? { originalPrompt, previousAssistantText, sources: inputSources, chatId, reason }
        : { prompt, activeSubject, mode, history, image };

      while (attempt < maxAttempts) {
        try {
          const token = await getAuthToken();
          response = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token || ""}`,
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            break; // Success
          }
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || body.message || `AI failed ${response.status}`);
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          attempt++;
          if (attempt >= maxAttempts) {
            throw e;
          }
          console.warn(`AI stream request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${backoffDelay}ms...`, e);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          backoffDelay *= 2;
        }
      }

      if (!response || !response.body) {
        throw new Error("Failed to receive stream response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SSEParser();
      let doneReceived = false;
      let accumulatedFullText = "";
      let lastSentRenderedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunkStr = decoder.decode(value, { stream: true });
        const events = parser.parse(chunkStr);

        for (const { event: eventName, data: dataText } of events) {
          if (!eventName) continue;

          let data;
          try {
            data = JSON.parse(dataText);
          } catch(e) { 
            continue; 
          }

          if (eventName === "status") {
            setStatus(data);
            onStatus?.(data);
          }
          if (eventName === "tool") {
            let updatedTools: any[] = [];
            setTools(prev => {
              const exists = prev.findIndex(t => t.name === data.name);
              if (exists >= 0) {
                const copy = [...prev];
                copy[exists] = { ...copy[exists], ...data };
                updatedTools = copy;
                return copy;
              }
              updatedTools = [...prev, data];
              return updatedTools;
            });
            onTools?.(updatedTools);
          }
          if (eventName === "chunk" || eventName === "token") {
            const tokenText = data.text || "";
            accumulatedFullText += tokenText;
            
            const { cleanText, blocks } = extractVisualBlocks(accumulatedFullText);
            
            if (blocks.length > 0) {
                onVisualBlocks?.(blocks);
            }
            
            const unclosedInfo = getUnclosedMathInfo(cleanText);
            let textToRender = cleanText;
            
            if (unclosedInfo.hasUnclosed && (cleanText.length - unclosedInfo.index < 1500)) {
              textToRender = cleanText.substring(0, unclosedInfo.index);
            }
            
            setAnswer(textToRender);
            
            const delta = textToRender.substring(lastSentRenderedText.length);
            if (delta.length > 0) {
              onToken?.(delta);
              lastSentRenderedText = textToRender;
            }
          }
          if (eventName === "safe_summary") {
            const items = data.items || (data.summary ? [data.summary] : []);
            setSafeSummary(items);
            onSummary?.(items);
          }
          if (eventName === "web_candidates") {
            const candidates = data.candidates || [];
            setWebCandidates(candidates);
            onWebCandidates?.(candidates);
          }
          if (eventName === "pending_import") {
            setPendingImport(data);
            onPendingImport?.(data);
          }
          if (eventName === "import_status") {
            setImportStatus(data);
            onImportStatus?.(data);
          }
          if (eventName === "import_complete") {
            setImportComplete(data);
            onImportComplete?.(data);
          }
          if (eventName === "direct_pdf_handoff_required") {
            // Trigger direct PDF QA flow
            directPdfQaPending = true;
            console.info("[DirectPDFQA] Pending mode started. Keeping stream alive.");
            
            const { sourceId, storagePath, title, subject, year, reason, message } = data;
            const questionNo = data.questionNo || data.parsedIntent?.questionNo || data.question?.questionNo;
            const questionType = data.questionType || data.parsedIntent?.questionType || "MCQ";
            
            const qaKey = data.idempotencyKey || `${sourceId}:${questionType}:${questionNo}`;
            if (activeDirectQaKeysRef.current.has(qaKey)) {
              console.warn("[DirectPDFQA] Skipping duplicate call for key:", qaKey);
              return;
            }
            activeDirectQaKeysRef.current.add(qaKey);
            
            setStatus({ 
               stage: "processing", 
               label: "Reading PDF Directly", 
               message: "PDF source එක හම්බුණා. Direct scan සඳහා file prepare කරනවා..." 
            });
            
            import("../lib/ai/directPdfQa").then(async ({ askDirectPdfQa }) => {
              try {
                if (!storagePath) {
                   const errorMsg = "PDF source එක තියෙනවා, නමුත් Storage path නැති නිසා open/scan කරන්න බැහැ.";
                   console.error("[DirectPDFQA] Error:", errorMsg);
                   setStatus({ stage: "error", label: "Source Error", message: errorMsg });
                   onToken?.(errorMsg);
                   setIsStreaming(false);
                   doneReceived = true;
                   onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: "DIRECT_QA_SOURCE_MISSING_STORAGE_PATH", sources: [{ id: sourceId }] });
                   return;
                }
                
                const result = await askDirectPdfQa({ 
                  source: { id: sourceId, storagePath, title, subject, year, fileName: `${sourceId}.pdf` }, 
                  prompt: data.prompt || data.question || "", 
                  questionId: data.questionId, 
                  questionNo, 
                  questionType, 
                  subject, 
                  year 
                });
                
                if (result.ok && result.found === true && result.answer) {
                  console.info("[DirectPDFQA] Success! Displaying answer.");
                  onToken?.(result.answer);
                  
                  // Complete the stream
                  setIsStreaming(false);
                  doneReceived = true;
                  onDone?.({ 
                    ok: true, 
                    completed: true, 
                    finishReason: "direct_pdf_qa_complete",
                    answer: result.answer, 
                    sources: [{ id: sourceId, title, storagePath }], 
                    paperInfo: {
                      sourceId: sourceId,
                      questionNo,
                      questionType,
                      year,
                      subject,
                      extractionMethod: "gemini_direct_pdf_qa",
                      sourceEvidence: result.sourceEvidence
                    }
                  });
                } else {
                  console.error("[DirectPDFQA] Failed to get answer:", result);
                  let userMsg = "PDF source එක Firebase එකේ හම්බුණා. හැබැයි server-side PDF download එක fail වුණා, ඒ නිසා මම answer එක guess කරන්නේ නැහැ. Direct Scan/Reindex action එක run කළාම PDF එකෙන්ම answer දෙන්නම්.";
                  
                  const errorStr = String(result.error || "").toLowerCase();
                  const isBillingExhausted = result.errorCode === "AI_BILLING_EXHAUSTED" || 
                    errorStr.includes("depleted") || 
                    errorStr.includes("credits") || 
                    errorStr.includes("exhausted") || 
                    errorStr.includes("billing") || 
                    errorStr.includes("429") || 
                    errorStr.includes("resource_exhausted");

                  const isRuntimeError = result.errorCode === "AI_CLIENT_RUNTIME_ERROR";

                  if (isBillingExhausted) {
                     userMsg = "AI credits අවසන් වෙලා තියෙනවා. Billing/credits update කළාම නැවත PDF scan/AI answer දෙන්න පුළුවන්.";
                  } else if (isRuntimeError) {
                     userMsg = "AI client runtime configuration/import issue. Please check server console.";
                  } else if (result.found === false) {
                     userMsg = (result as any).message || result.reason || "PDF scan කළා. හැබැයි exact question text හම්බුණේ නැහැ. Reindex/OCR/page image අවශ්‍යයි.";
                  } else if (result.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED" || result.errorCode === "ADMIN_STORAGE_DEGRADED_USE_CLIENT_HANDOFF") {
                     userMsg = "PDF source එක තියෙනවා, නමුත් Storage permission නිසා open/scan කරන්න බැහැ. Storage rules/App Check/login check කරන්න.";
                  }
                  
                  setStatus({ 
                    stage: result.stage || "error", 
                    label: "Extraction Failed", 
                    message: isBillingExhausted ? "AI credits අවසන්" : (isRuntimeError ? "Runtime error" : (result.reason || "No answer found"))
                  });
                  onToken?.(userMsg);
                  onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }
              } catch (err: any) {
                console.error("[DirectPDFQA] Unexpected Error:", err);
                setIsStreaming(false);
                doneReceived = true;
                setError(err.message);
                setStatus({ stage: "error", label: "Fatal Error", message: err.message });
                onToken?.(`Direct PDF QA flow crashed: ${err.message}`);
                onError?.({ error: err.message });
                onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: "FATAL_ERROR", sources: [{ id: sourceId, title, storagePath }] });
              } finally {
                activeDirectQaKeysRef.current.delete(qaKey);
                activeStreamRef.current = false;
              }
            });
          }
          if (eventName === "sources") {
            const newSources = data.sources || data.chunks || [];
            let updatedSources: any[] = [];
            setSources(prev => {
              const combined = [...prev, ...newSources];
              const seen = new Set();
              updatedSources = combined.filter(c => {
                const key = c.title + (c.url || '');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              return updatedSources;
            });
            onSources?.(newSources);
          }
          if (eventName === "visual_blocks") {
            const blocks = data.blocks || [];
            onVisualBlocks?.(blocks);
          }
          if (eventName === "suggestions") {
            const suggestions = data.suggestions || [];
            onSuggestions?.(suggestions);
          }
          if (eventName === "error") {
            const errObj = { error: data.error || data.message || "AI error", recoverable: data.recoverable, code: data.code };
            setError(errObj.error);
            if (data.recoverable) setIsRecoverableError(true);
            if (data.code === "AI_BILLING_EXHAUSTED") {
               setIsRecoverableError(false); // Do not show retry button for this
               setStatus({ stage: "error", label: "Billing/credits exhausted", message: data.message });
            }
            onError?.(errObj);
          }
          if (eventName === "done") {
            if (data.finishReason === "pending_direct_pdf_qa" || data.pending === true || directPdfQaPending) {
              console.info("[DirectPDFQA] Ignoring parent stream done because Direct PDF QA is pending.");
              doneReceived = true;
              setStatus({
                stage: "processing",
                label: "Direct PDF QA running",
                message: "PDF එකෙන් exact question extract කරමින්..."
              });
              return;
            }

            const { cleanText } = extractVisualBlocks(accumulatedFullText);
            const finalRendered = sanitizeMathMarkdown(cleanText);
            
            if (lastSentRenderedText !== finalRendered) {
              const delta = finalRendered.substring(lastSentRenderedText.length);
              if (delta.length > 0) {
                onToken?.(delta);
              }
              setAnswer(finalRendered);
              lastSentRenderedText = finalRendered;
            }

            doneReceived = true;
            setIsStreaming(false);
            setTotalSeconds(data.totalSeconds);
            setStatus({
              stage: data.ok !== false ? "done" : "error",
              label: data.ok !== false ? "Thought" : "Stopped",
              startedAt: Date.now() - (data.totalMs || 0),
            });
            if (data.sources) {
              setSources(data.sources);
            }
            onDone?.(data);
          }
        }
      }

      if (lastSentRenderedText !== accumulatedFullText) {
        const delta = accumulatedFullText.substring(lastSentRenderedText.length);
        if (delta.length > 0) {
          onToken?.(delta);
        }
        setAnswer(accumulatedFullText);
        lastSentRenderedText = accumulatedFullText;
      }

      if (!doneReceived) {
        onDone?.({ completed: false, reason: "STREAM_CLOSED_BEFORE_DONE" });
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        const errorMsg = e.message || "Network error";
        setError(errorMsg);
        setIsStreaming(false);
        setStatus({ stage: "error", label: "Stopped" });
        onError?.({ error: errorMsg });
      } else {
        onError?.({ error: "Stream aborted" });
      }
      onDone?.({ completed: false, reason: "STREAM_CLOSED_BEFORE_DONE" });
    } finally {
      if (!directPdfQaPending) {
        activeStreamRef.current = false;
      }
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStatus({ stage: "error", label: "Stopped" });
  }

  return { 
    answer, 
    status, 
    tools, 
    isStreaming, 
    totalSeconds, 
    safeSummary, 
    sources, 
    error, 
    isRecoverableError, 
    webCandidates,
    pendingImport,
    importStatus,
    importComplete,
    sendAIMessage, 
    cancel 
  };
}
