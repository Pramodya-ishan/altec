import { useState, useRef } from "react";
import { auth } from "../lib/firebase";
import { getAuthToken } from "../lib/api";
import { SSEParser } from "../lib/sseParser";
import { stripRawVisualBlocks } from "../lib/ai/stripVisualBlocks";
import { getUnclosedMathInfo, sanitizeMathMarkdown } from "../lib/mathSanitizer";
import { extractVisualBlocks } from "../lib/visualBlockExtractor";
import { apiUrl } from "../lib/apiBase";
import { askDirectPdfQa } from "../lib/ai/directPdfQa";
import { cleanAssistantResponse, normalizeSinhalaUnicode } from "../../shared/text/assistantText";

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
    onReplace?: (text: string) => void;
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
      onReplace,
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

                const { cleanText, blocks } = extractVisualBlocks(normalizeSinhalaUnicode(accumulatedFullText));

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
            if (import.meta.env.DEV) console.info("[DirectPDFQA] Pending mode started. Keeping stream alive.");

            const { sourceId, storagePath, downloadUrl, title, subject, year } = data;
            const questionNo = data.questionNo || data.parsedIntent?.questionNo || data.question?.questionNo;
            const questionType = data.questionType || data.parsedIntent?.questionType || "MCQ";

            const qaKey = data.idempotencyKey || `${sourceId}:${questionType}:${questionNo}`;
            if (activeDirectQaKeysRef.current.has(qaKey)) {
              if (import.meta.env.DEV) console.warn("[DirectPDFQA] Skipping duplicate call for key:", qaKey);
              return;
            }
            activeDirectQaKeysRef.current.add(qaKey);
            directPdfQaPending = true;

            // The server may have streamed a tentative answer before locating the
            // exact PDF. Direct QA is authoritative, so clear the placeholder
            // instead of appending a second answer underneath it.
            accumulatedFullText = "";
            lastSentRenderedText = "";
            setAnswer("");
            onReplace?.("");

            setStatus({
               stage: "processing",
               label: "Reading PDF Directly",
               message: "PDF source එක හම්බුණා. Direct scan සඳහා file prepare කරනවා..."
            });

            void (async () => {
              try {
                if (!storagePath) {
                   const errorMsg = "PDF source එක තියෙනවා, නමුත් Storage path නැති නිසා open/scan කරන්න බැහැ.";
                   if (import.meta.env.DEV) console.error("[DirectPDFQA] Error:", errorMsg);
                   setStatus({ stage: "error", label: "Source Error", message: errorMsg });
                   setAnswer(errorMsg);
                   onReplace?.(errorMsg);
                   setIsStreaming(false);
                   doneReceived = true;
                   onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: "DIRECT_QA_SOURCE_MISSING_STORAGE_PATH", sources: [{ id: sourceId }] });
                   return;
                }

                const result = await askDirectPdfQa({
                  source: { id: sourceId, storagePath, downloadUrl, title, subject, year, fileName: `${sourceId}.pdf` },
                  prompt: data.prompt || data.question || "",
                  questionId: data.questionId,
                  questionNo,
                   signal: abortRef.current?.signal,
                  questionType,
                  subject,
                  year,
                  scanMode: data.scanMode === "targeted" ? "targeted" : "full_paper",
                  onProgress: (step, payload) => {
                    if (step === "fetching") {
                      setStatus({
                        stage: "processing",
                        label: "Fetching PDF",
                        message: "PDF source එක Firebase Storage එකෙන් download කරගනිමින් පවතී..."
                      });
                    } else if (step === "uploading") {
                      const sizeWarn = payload?.isLarge ? " ⚠️ PDF එක 15MB වලට වඩා විශාල බැවින් scan කිරීමට වැඩි වේලාවක් ගතවිය හැක. Indexing/Reindex භාවිත කරන්න." : "";
                      setStatus({
                        stage: "processing",
                        label: "Uploading to AI",
                        message: `AI backend එක වෙත PDF ගොනුව upload කරමින් පවතී...${sizeWarn}`
                      });
                    } else if (step === "scanning") {
                      setStatus({
                        stage: "processing",
                        label: "Scanning Full Paper",
                        message: "සම්පූර්ණ paper එක OCR/text scan කර නිවැරදි ප්‍රශ්නය වෙන් කරමින් පවතී..."
                      });
                    } else if (step === "generating") {
                      setStatus({
                        stage: "processing",
                        label: "Generating Answer",
                        message: "ප්‍රශ්නයට පිළිතුර සකස් කරමින් පවතී..."
                      });
                    }
                  }
                });

                if (result.ok && result.found === true && result.answer) {
                  if (import.meta.env.DEV) console.info("[DirectPDFQA] Success! Displaying answer.");
                  const finalAnswer = cleanAssistantResponse(result.answer);
                  setAnswer(finalAnswer);
                  onReplace?.(finalAnswer);

                  // Complete the stream
                  setIsStreaming(false);
                  doneReceived = true;
                  onDone?.({
                    ok: true,
                    completed: true,
                    finishReason: "direct_pdf_qa_complete",
                    answer: finalAnswer,
                    sources: [{ id: sourceId, title, storagePath, pageNumber: result.pageNumber || result.sourceEvidence?.pageNumber }],
                    paperInfo: {
                      sourceId: sourceId,
                      pageNumber: result.pageNumber || result.sourceEvidence?.pageNumber,
                      questionNo,
                      questionType,
                      year,
                      subject,
                      extractionMethod: "gemini_direct_pdf_qa",
                      sourceEvidence: result.sourceEvidence
                    }
                  });
                } else {
                  if (import.meta.env.DEV) console.error("[DirectPDFQA] Failed to get answer:", result);
                  let userMsg = "මේ වතාවේ PDF එකෙන් පිළිතුර තහවුරු කරගන්න බැරි වුණා. තත්පර කිහිපයකින් එම ප්‍රශ්නය නැවත අහන්න.";

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
                  } else if (result.errorCode === "MCQ_SOLVER_EMPTY") {
                     userMsg = "ප්‍රශ්නය හමු වුණා, නමුත් නිවැරදි විකල්පය තහවුරු වුණේ නැහැ. මම raw OCR text එක පෙන්වන්නේ නැහැ; එම MCQ එක නැවත අහන්න.";
                  } else if (result.errorCode === "QUESTION_NUMBER_MISMATCH") {
                     userMsg = "PDF එකෙන් ලැබුණු ප්‍රශ්න අංකය ඔබ ඉල්ලූ අංකයට නොගැළපුණා. වැරදි ප්‍රශ්නයක් පෙන්වන්නේ නැතිව පිළිතුර නවතා ඇත.";
                  } else if (result.found === false) {
                     userMsg = "PDF එකෙන් එම ප්‍රශ්නය පැහැදිලිව හඳුනාගන්න බැරි වුණා. ප්‍රශ්න අංකය සමඟ නැවත අහන්න.";
                  } else if (["DIRECT_QA_FIREBASE_FETCH_FAILED", "ADMIN_STORAGE_DEGRADED_USE_CLIENT_HANDOFF", "DIRECT_QA_SOURCE_DOWNLOAD_FAILED"].includes(String(result.errorCode || ""))) {
                     userMsg = "PDF access session එක refresh කරගන්න බැරි වුණා. නැවත sign in කර එම ප්‍රශ්නය අහන්න.";
                  }

                  setStatus({
                    stage: result.stage || "error",
                    label: "Extraction Failed",
                    message: isBillingExhausted ? "AI credits අවසන්" : (isRuntimeError ? "Runtime error" : (result.reason || "No answer found"))
                  });
                  setAnswer(userMsg);
                  onReplace?.(userMsg);
                  doneReceived = true;
                  onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }
              } catch (err: any) {
                if (import.meta.env.DEV) console.error("[DirectPDFQA] Unexpected Error:", err);
                setIsStreaming(false);
                doneReceived = true;

                let userFriendlyMsg = `Direct PDF QA flow failed: ${err.message}`;
                let friendlyStage = "error";
                let friendlyLabel = "Extraction Failed";
                let errorCode = err.errorCode || "FATAL_ERROR";

                if (err.errorCode === "DIRECT_QA_BACKEND_NON_JSON_RESPONSE") {
                  userFriendlyMsg = "PDF answer service එක තාවකාලිකව ප්‍රතිචාර නොදුන්නා. තත්පර කිහිපයකින් නැවත උත්සාහ කරන්න.";
                  friendlyLabel = "Scan Timeout / Error";
                } else if (err.errorCode === "DIRECT_QA_BACKEND_ERROR") {
                  userFriendlyMsg = "PDF answer service එක තාවකාලිකව unavailable. නැවත උත්සාහ කරන්න.";
                  friendlyLabel = "Backend Error";
                } else if (err.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED") {
                  userFriendlyMsg = "PDF access session එක refresh කරගන්න බැරි වුණා. නැවත sign in කර උත්සාහ කරන්න.";
                  friendlyLabel = "Storage Error";
                } else if (err.message && err.message.includes("Failed to fetch")) {
                  userFriendlyMsg = "⚠️ Backend සේවාදායකය සමඟ සම්බන්ධ වීමට නොහැකි විය (Network Connection / CORS Error). කරුණාකර ඔබගේ අන්තර්ජාල සම්බන්ධතාවය පරීක්ෂා කර නැවත උත්සාහ කරන්න.";
                  friendlyLabel = "Connection Error";
                }

                setError(err.message);
                setStatus({ stage: friendlyStage, label: friendlyLabel, message: err.message });
                setAnswer(userFriendlyMsg);
                onReplace?.(userFriendlyMsg);
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
               setStatus({ stage: "error", label: "Billing/credits exhausted", message: data.message });
            }
            onError?.(errObj);
          }
          if (eventName === "done") {
            if (data.finishReason === "pending_direct_pdf_qa" || data.pending === true || directPdfQaPending) {
              if (import.meta.env.DEV) console.info("[DirectPDFQA] Ignoring parent stream done because Direct PDF QA is pending.");
              doneReceived = true;
              setStatus({
                stage: "processing",
                label: "Direct PDF QA running",
                message: "PDF එකෙන් exact question extract කරමින්..."
              });
              return;
            }

            if (throttleTimer) {
              clearTimeout(throttleTimer);
              throttleTimer = null;
            }

            const { cleanText } = extractVisualBlocks(normalizeSinhalaUnicode(accumulatedFullText));
            const finalRendered = cleanAssistantResponse(sanitizeMathMarkdown(cleanText));

            if (lastSentRenderedText !== finalRendered) {
              setAnswer(finalRendered);
              onReplace?.(finalRendered);
              lastSentRenderedText = finalRendered;
            }
            data.answer = finalRendered;

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

      const closedStreamText = cleanAssistantResponse(sanitizeMathMarkdown(normalizeSinhalaUnicode(accumulatedFullText)));
      if (lastSentRenderedText !== closedStreamText) {
        setAnswer(closedStreamText);
        onReplace?.(closedStreamText);
        lastSentRenderedText = closedStreamText;
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
