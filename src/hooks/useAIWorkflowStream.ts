import { useState, useRef } from "react";
import { auth } from "../lib/firebase";
import { getAuthToken } from "../lib/api";
import { SSEParser } from "../lib/sseParser";
import { stripRawVisualBlocks } from "../lib/ai/stripVisualBlocks";
import { getUnclosedMathInfo, sanitizeMathMarkdown } from "../lib/mathSanitizer";
import { extractVisualBlocks } from "../lib/visualBlockExtractor";
import { apiUrl } from "../lib/apiBase";
import { askDirectPdfQa } from "../lib/ai/directPdfQa";

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
  const currentRequestIdRef = useRef<string | null>(null);

  async function sendAIMessage(params: {
    prompt?: string;
    activeSubject?: string;
    mode?: string;
    history?: any[];
    image?: { mimeType: string; data: string };
    attachments?: { storagePath: string; mimeType: string; fileName: string }[];
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
      attachments,
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
      const errorMsg = "You are offline. Check your internet connection and try again.";
      setError(errorMsg);
      setIsStreaming(false);
      setStatus({ stage: "error", label: "Offline" });
      onError?.({ error: errorMsg });
      onDone?.({ completed: false, reason: "OFFLINE" });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let throttleTimer: any = null;

    try {
      let response: Response | null = null;
      let attempt = 0;
      const maxAttempts = 3;
      let backoffDelay = 1000;

      const clientRequestId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(7);
      currentRequestIdRef.current = clientRequestId;
      const endpoint = isContinue ? "/api/ai/continue" : "/api/ai/respond-stream";
      const payload: any = isContinue
        ? { originalPrompt, previousAssistantText, sources: inputSources, chatId, reason }
        : { prompt, activeSubject, mode, history, image, attachments };
      payload.clientRequestId = clientRequestId;

      while (attempt < maxAttempts) {
        try {
          const token = await getAuthToken();
          response = await fetch(apiUrl(endpoint), {
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
          const text = await response.text().catch(() => "");
          let body: any = {};
          try {
            body = text ? JSON.parse(text) : {};
          } catch (err) {
            body = { message: text || `AI failed ${response.status}` };
          }
          const errMsg = body.error || body.message || `AI failed ${response.status}`;
          const err: any = new Error(errMsg);
          if (response.status === 500) {
            err.stopRetry = true;
          }
          throw err;
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          if (e.stopRetry) {
            throw e;
          }
          attempt++;
          if (attempt >= maxAttempts) {
            throw e;
          }
          console.warn(`AI stream request failed (attempt ${attempt}/${maxAttempts}). Retrying in ${backoffDelay}ms...`, e);
          await new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, backoffDelay);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              resolve();
            });
          });
          if (controller.signal.aborted) throw new Error("USER_CANCELLED");
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
      throttleTimer = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const events = parser.parse(chunkStr);

        for (const { event: eventName, data: dataText } of events) {
          if (!eventName) continue;
          if (controller.signal.aborted) return;

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

            if (!throttleTimer) {
              throttleTimer = window.setTimeout(() => {
                throttleTimer = null;

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
              }, 80);
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
            if (import.meta.env.DEV) console.info("[DirectPDFQA] secure scan started");

            const { sourceId, storagePath, title, subject, year, reason, message } = data;
            const questionNo = data.questionNo || data.parsedIntent?.questionNo || data.question?.questionNo;
            const questionType = data.questionType || data.parsedIntent?.questionType || "MCQ";

            const qaKey = data.idempotencyKey || `${sourceId}:${questionType}:${questionNo}`;
            if (activeDirectQaKeysRef.current.has(qaKey)) {
              if (import.meta.env.DEV) console.warn("[DirectPDFQA] duplicate request skipped:", qaKey);
              return;
            }
            activeDirectQaKeysRef.current.add(qaKey);
            directPdfQaPending = true;

            setStatus({
               stage: "processing",
               label: "Checking the PDF",
               message: "Searching the selected PDF source for the requested question…"
            });

            void (async () => {
              try {
                if (!sourceId && !storagePath) {
                   const errorMsg = "The PDF source is missing its source ID or storage path.";
                   if (import.meta.env.DEV) console.error("[DirectPDFQA]", errorMsg);
                   setStatus({ stage: "error", label: "Source error", message: errorMsg });
                   onToken?.(errorMsg);
                   setIsStreaming(false);
                   doneReceived = true;
                   onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: "DIRECT_QA_SOURCE_MISSING_STORAGE_PATH", sources: [{ id: sourceId }] });
                   return;
                }

                const runDirectPdfQa = () => askDirectPdfQa({
                  source: { id: sourceId, storagePath, title, subject, year, fileName: `${sourceId}.pdf` },
                  prompt: data.prompt || data.question || "",
                  questionId: data.questionId,
                  questionNo,
                   signal: abortRef.current?.signal,
                  questionType,
                  subject,
                  year,
                  onProgress: (step, payload) => {
                    if (step === "fetching") {
                      setStatus({
                        stage: "processing",
                        label: "Preparing the PDF",
                        message: "Opening the secure source…"
                      });
                    } else if (step === "uploading") {
                      const sizeWarn = payload?.isLarge ? " This PDF is larger than 15 MB, so scanning may take longer. Indexing it first is recommended." : "";
                      setStatus({
                        stage: "processing",
                        label: "Preparing the PDF",
                        message: `Preparing the file for analysis…${sizeWarn}`
                      });
                    } else if (step === "scanning") {
                      setStatus({
                        stage: "processing",
                        label: "Finding the question",
                        message: "Scanning the PDF for the relevant pages…"
                      });
                    } else if (step === "generating") {
                      setStatus({
                        stage: "processing",
                        label: "Preparing the answer",
                        message: "Building an answer from the source evidence…"
                      });
                    }
                  }
                });

                let result = await runDirectPdfQa();
                // Scan-only lesson PDFs may need one indexing pass before the
                // requested question becomes searchable. Keep the same source
                // and question context and retry automatically, so a student
                // does not have to send “q1” again after OCR finishes.
                for (let attempt = 0; attempt < 3; attempt += 1) {
                  const waitingForIndex = result.errorCode === "PDF_INDEXING_STARTED"
                    || result.errorCode === "PDF_INDEX_READY_RETRY";
                  if (!waitingForIndex || abortRef.current?.signal.aborted) break;
                  const waitMs = Math.min(15_000, Math.max(800, Number(result.retryAfterMs || 4_000)));
                  setStatus({
                    stage: "processing",
                    label: "Indexing the PDF",
                    message: `The question will be checked again as soon as the source is ready… (${attempt + 1}/3)`,
                  });
                  await new Promise<void>((resolve) => {
                    const timer = window.setTimeout(resolve, waitMs);
                    abortRef.current?.signal.addEventListener("abort", () => {
                      window.clearTimeout(timer);
                      resolve();
                    }, { once: true });
                  });
                  if (abortRef.current?.signal.aborted) break;
                  result = await runDirectPdfQa();
                }

                if (result.ok && result.found === true && result.answer) {
                  if (import.meta.env.DEV) console.info("[DirectPDFQA] answer ready");
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
                  if (import.meta.env.DEV) console.error("[DirectPDFQA]", result);
                  let userMsg = "The PDF source was found, but the secure server could not read it. I will not guess an answer. Index the PDF and try again.";

                  const errorStr = String(result.error || "").toLowerCase();
                  const isBillingExhausted = result.errorCode === "AI_BILLING_EXHAUSTED" ||
                    errorStr.includes("depleted") ||
                    errorStr.includes("credits") ||
                    errorStr.includes("exhausted") ||
                    errorStr.includes("billing") ||
                    errorStr.includes("429") ||
                    errorStr.includes("resource_exhausted");

                  const isRuntimeError = result.errorCode === "AI_CLIENT_RUNTIME_ERROR";
                  const isIndexing = result.errorCode === "PDF_INDEXING_STARTED" || result.errorCode === "PDF_INDEX_READY_RETRY";

                  if (isIndexing) {
                     userMsg = (result as any).message || "The PDF is being indexed. Please try the question again when processing is complete.";
                  } else if (result.errorCode === "PDF_OCR_NOT_CONFIGURED") {
                     userMsg = (result as any).message || "OCR must be configured before this scanned PDF can be read.";
                  } else if (isBillingExhausted) {
                     userMsg = "The AI service limit has been reached. Try again after the service plan is available.";
                  } else if (isRuntimeError) {
                     userMsg = "The AI service is not configured correctly. Please try again shortly.";
                  } else if (result.found === false) {
                     userMsg = (result as any).message || result.reason || "The PDF was checked, but no exact evidence for this question was found. Reindex the PDF or attach an image of the question and try again.";
                  } else if (result.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED" || result.errorCode === "ADMIN_STORAGE_DEGRADED_USE_CLIENT_HANDOFF") {
                     userMsg = "The PDF source was found, but access was denied. Sign in again and retry.";
                  }

                  setStatus({
                    stage: isIndexing ? "processing" : (result.stage || "error"),
                    label: isIndexing
                      ? "Preparing the PDF"
                      : "Unable to answer from this PDF",
                    message: isIndexing
                      ? ((result as any).message || "Indexing in progress")
                      : (isBillingExhausted ? "Service limit reached" : (isRuntimeError ? "Service configuration error" : (result.reason || "No relevant evidence was found")))
                  });
                  onToken?.(userMsg);
                  doneReceived = true;
                  onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }
              } catch (err: any) {
                if (import.meta.env.DEV) console.error("[DirectPDFQA]", err);
                setIsStreaming(false);
                doneReceived = true;

                let userFriendlyMsg = `Unable to answer from the PDF: ${err.message}`;
                let friendlyStage = "error";
                let friendlyLabel = "Unable to answer from this PDF";
                let errorCode = err.errorCode || "FATAL_ERROR";

                if (err.errorCode === "DIRECT_QA_BACKEND_NON_JSON_RESPONSE") {
                  userFriendlyMsg = "The PDF scan timed out or returned an invalid server response. Index this PDF first, then try again.";
                  friendlyLabel = "PDF scan timed out";
                } else if (err.errorCode === "DIRECT_QA_BACKEND_ERROR") {
                  userFriendlyMsg = `The PDF service returned an error: ${err.details?.message || err.message}`;
                  friendlyLabel = "PDF service error";
                } else if (err.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED") {
                  userFriendlyMsg = `The PDF could not be read from secure storage: ${err.details?.message || err.message}\nCheck your sign-in session and storage permissions.`;
                  friendlyLabel = "File access error";
                } else if (err.message && err.message.includes("Failed to fetch")) {
                  userFriendlyMsg = "The PDF service could not be reached. Check your connection and try again.";
                  friendlyLabel = "Connection error";
                }

                setError(err.message);
                setStatus({ stage: friendlyStage, label: friendlyLabel, message: err.message });
                onToken?.(userFriendlyMsg);
                onError?.({ error: err.message });
                doneReceived = true;
                onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode, sources: [{ id: sourceId, title, storagePath }] });
              } finally {
                activeDirectQaKeysRef.current.delete(qaKey);
                setIsStreaming(false);
                directPdfQaPending = false;
                activeStreamRef.current = false;
              }
            })();
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
               setStatus({ stage: "error", label: "AI service limit reached", message: data.message });
            }
            onError?.(errObj);
          }
          if (eventName === "done") {
            if (data.finishReason === "pending_direct_pdf_qa" || data.pending === true || directPdfQaPending) {
              if (import.meta.env.DEV) console.info("[DirectPDFQA] waiting for secure scan");
              doneReceived = true;
              setStatus({
                stage: "processing",
                label: "Checking the PDF",
                message: "Extracting the exact question from the source…"
              });
              return;
            }

            if (throttleTimer) {
              clearTimeout(throttleTimer);
              throttleTimer = null;
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
              label: data.ok !== false ? "Complete" : "Stopped",
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
      if (e.name !== 'AbortError' && e.message !== 'USER_CANCELLED') {
        const errorMsg = e.message || "Network error";
        setError(errorMsg);
        setIsStreaming(false);
        setStatus({ stage: "error", label: "Stopped" });
        onError?.({ error: errorMsg });
      } else {
        onError?.({ error: "Stream aborted" });
      }
      const isUserCancel = e?.message === "USER_CANCELLED" || e?.name === "AbortError";
      onDone?.({ completed: false, reason: isUserCancel ? "USER_CANCELLED" : "STREAM_CLOSED_BEFORE_DONE" });
    } finally {
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      if (!directPdfQaPending) {
        activeStreamRef.current = false;
      }
    }
  }

  function cancel() {
    if (abortRef.current) {
      abortRef.current.abort(new Error("USER_CANCELLED"));
    }
    if (currentRequestIdRef.current) {
      import("../lib/api").then(({ apiFetch }) => {
        apiFetch(`/api/ai/requests/${currentRequestIdRef.current}/cancel`, { method: "POST" }).catch(() => {});
      });
    }
    setIsStreaming(false);
    activeStreamRef.current = false;
    setStatus({ stage: "error", label: "Stopped", message: "User cancelled." });
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
