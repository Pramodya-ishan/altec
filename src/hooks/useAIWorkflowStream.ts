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
               label: "PDF එක පරීක්ෂා කරමින්",
               message: "තෝරාගත් PDF මූලාශ්‍රයෙන් අදාළ ප්‍රශ්නය සොයමින්…"
            });

            void (async () => {
              try {
                if (!sourceId && !storagePath) {
                   const errorMsg = "PDF මූලාශ්‍රය හඳුනාගැනීමට අවශ්‍ය source ID හෝ storage path එකක් ලැබී නැහැ.";
                   if (import.meta.env.DEV) console.error("[DirectPDFQA]", errorMsg);
                   setStatus({ stage: "error", label: "මූලාශ්‍ර දෝෂයක්", message: errorMsg });
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
                        label: "PDF එක සූදානම් කරමින්",
                        message: "ආරක්ෂිත මූලාශ්‍රය විවෘත කරමින්…"
                      });
                    } else if (step === "uploading") {
                      const sizeWarn = payload?.isLarge ? " ⚠️ PDF එක 15MB වලට වඩා විශාල බැවින් scan කිරීමට වැඩි වේලාවක් ගතවිය හැක. Indexing/Reindex භාවිත කරන්න." : "";
                      setStatus({
                        stage: "processing",
                        label: "PDF එක සූදානම් කරමින්",
                        message: `PDF ගොනුව විශ්ලේෂණයට සූදානම් කරමින්…${sizeWarn}`
                      });
                    } else if (step === "scanning") {
                      setStatus({
                        stage: "processing",
                        label: "ප්‍රශ්නය සොයමින්",
                        message: "ප්‍රශ්නයට අදාළ කොටස් PDF ගොනුවෙන් scan කරමින් පවතී..."
                      });
                    } else if (step === "generating") {
                      setStatus({
                        stage: "processing",
                        label: "පිළිතුර සකස් කරමින්",
                        message: "ප්‍රශ්නයට පිළිතුර සකස් කරමින් පවතී..."
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
                    label: "PDF අකුරු සකසමින්",
                    message: `මූලාශ්‍රය සූදානම් වූ විගස ප්‍රශ්නය ස්වයංක්‍රීයව නැවත පරීක්ෂා කරනවා… (${attempt + 1}/3)`,
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
                  const isIndexing = result.errorCode === "PDF_INDEXING_STARTED" || result.errorCode === "PDF_INDEX_READY_RETRY";

                  if (isIndexing) {
                     userMsg = (result as any).message || "PDF එක index කරමින් පවතී. අවසන් වූ පසු ප්‍රශ්නය නැවත යවන්න.";
                  } else if (result.errorCode === "PDF_OCR_NOT_CONFIGURED") {
                     userMsg = (result as any).message || "මෙම scan කළ PDF එක කියවීමට OCR සැකසුම් අවශ්‍යයි.";
                  } else if (isBillingExhausted) {
                     userMsg = "AI සේවා සීමාව අවසන් වී තිබෙනවා. සේවා සැලැස්ම යාවත්කාලීන කළ පසු PDF පිළිතුර නැවත ලබාගත හැක.";
                  } else if (isRuntimeError) {
                     userMsg = "AI සේවාවේ සැකසුම් දෝෂයක් ඇති වුණා. මොහොතකින් නැවත උත්සාහ කරන්න.";
                  } else if (result.found === false) {
                     userMsg = (result as any).message || result.reason || "PDF එක පරීක්ෂා කළා. නමුත් ප්‍රශ්නයට අදාළ නිශ්චිත පෙළ හමු නොවුණි. PDF එක නැවත සකස් කර හෝ ප්‍රශ්නයේ රූපයක් එක් කර උත්සාහ කරන්න.";
                  } else if (result.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED" || result.errorCode === "ADMIN_STORAGE_DEGRADED_USE_CLIENT_HANDOFF") {
                     userMsg = "PDF මූලාශ්‍රය හමු වුණත් එය කියවීමට අවසර ලැබී නැහැ. නැවත පිවිසී උත්සාහ කරන්න.";
                  }

                  setStatus({
                    stage: isIndexing ? "processing" : (result.stage || "error"),
                    label: isIndexing
                      ? "PDF එක සූදානම් කරමින්"
                      : "PDF පිළිතුර ලබාගත නොහැක",
                    message: isIndexing
                      ? ((result as any).message || "Index කරමින් පවතී")
                      : (isBillingExhausted ? "සේවා සීමාව අවසන්" : (isRuntimeError ? "සේවා සැකසුම් දෝෂයක්" : (result.reason || "අදාළ සාක්ෂිය හමු නොවුණි")))
                  });
                  onToken?.(userMsg);
                  doneReceived = true;
                  onDone?.({ ok: false, completed: true, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }
              } catch (err: any) {
                if (import.meta.env.DEV) console.error("[DirectPDFQA]", err);
                setIsStreaming(false);
                doneReceived = true;

                let userFriendlyMsg = `PDF එකෙන් පිළිතුර ලබාගැනීම අසාර්ථක වුණා: ${err.message}`;
                let friendlyStage = "error";
                let friendlyLabel = "PDF පිළිතුර ලබාගත නොහැක";
                let errorCode = err.errorCode || "FATAL_ERROR";

                if (err.errorCode === "DIRECT_QA_BACKEND_NON_JSON_RESPONSE") {
                  userFriendlyMsg = "⚠️ PDF scan endpoint එකෙන් non-JSON response එකක් ලැබුණා (උදා: gateway/proxy timeout හෝ backend crash වීමක්). විශාල PDF එකක් නිසා scan කිරීමට වැඩි වේලාවක් ගතවුණා විය හැක. කරුණාකර මෙම PDF එක Reindex/Process කර නැවත උත්සාහ කරන්න.";
                  friendlyLabel = "PDF පරීක්ෂාව කල් ඉකුත් වුණා";
                } else if (err.errorCode === "DIRECT_QA_BACKEND_ERROR") {
                  userFriendlyMsg = `⚠️ PDF scan backend එකේ දෝෂයක් ඇති විය: ${err.details?.message || err.message}`;
                  friendlyLabel = "සේවා දෝෂයක්";
                } else if (err.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED") {
                  userFriendlyMsg = `⚠️ PDF ගොනුව Firebase Storage එකෙන් බාගත කර ගැනීමට නොහැකි විය: ${err.details?.message || err.message}\nකරුණාකර Storage rules/login status පරීක්ෂා කරන්න.`;
                  friendlyLabel = "ගොනු අවසර දෝෂයක්";
                } else if (err.message && err.message.includes("Failed to fetch")) {
                  userFriendlyMsg = "⚠️ Backend සේවාදායකය සමඟ සම්බන්ධ වීමට නොහැකි විය (Network Connection / CORS Error). කරුණාකර ඔබගේ අන්තර්ජාල සම්බන්ධතාවය පරීක්ෂා කර නැවත උත්සාහ කරන්න.";
                  friendlyLabel = "සම්බන්ධතා දෝෂයක්";
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
               setStatus({ stage: "error", label: "AI සේවා සීමාව අවසන්", message: data.message });
            }
            onError?.(errObj);
          }
          if (eventName === "done") {
            if (data.finishReason === "pending_direct_pdf_qa" || data.pending === true || directPdfQaPending) {
              if (import.meta.env.DEV) console.info("[DirectPDFQA] waiting for secure scan");
              doneReceived = true;
              setStatus({
                stage: "processing",
                label: "PDF එක පරීක්ෂා කරමින්",
                message: "PDF එකෙන් exact question extract කරමින්..."
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
              label: data.ok !== false ? "සම්පූර්ණයි" : "නවතා ඇත",
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
