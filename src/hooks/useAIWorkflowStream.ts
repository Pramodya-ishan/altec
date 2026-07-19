import { useState, useRef } from "react";
import { auth } from "../lib/firebase";
import { apiFetch } from "../lib/api";
import { SSEParser } from "../lib/sseParser";
import { stripRawVisualBlocks } from "../lib/ai/stripVisualBlocks";
import { getUnclosedMathInfo, sanitizeMathMarkdown } from "../lib/mathSanitizer";
import { extractVisualBlocks } from "../lib/visualBlockExtractor";
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
  const [qualityReport, setQualityReport] = useState<any>(null);

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
    onAnswerReplace?: (text: string, reason?: string) => void;
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
    onQualityReport?: (report: any) => void;
    onAnswerStatus?: (status: { answerStatus?: string; sourceMode?: string; lockedSourceActive?: boolean; sourceTitle?: string | null; contradictions?: any[] }) => void;
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
      onAnswerReplace,
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
      onSuggestions,
      onQualityReport,
      onAnswerStatus,
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
    setQualityReport(null);
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
          response = await apiFetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
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
          if (eventName === "answer_replace") {
            const replacement = String(data.text || "");
            accumulatedFullText = replacement;
            const { cleanText, blocks } = extractVisualBlocks(replacement);
            if (blocks.length > 0) onVisualBlocks?.(blocks);
            const rendered = sanitizeMathMarkdown(stripRawVisualBlocks(cleanText));
            setAnswer(rendered);
            lastSentRenderedText = rendered;
            onAnswerReplace?.(rendered, data.reason);
          }
          if (eventName === "quality_report") {
            const report = data.report || null;
            setQualityReport(report);
            onQualityReport?.(report);
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
            if (import.meta.env.DEV) console.info("[DirectPDFQA] secure scan started");

            const { sourceId, storagePath, title, subject, year } = data;
            const questionNo = data.questionNo || data.parsedIntent?.questionNo || data.question?.questionNo;
            const questionType = data.questionType || data.parsedIntent?.questionType || "MCQ";
            const qaKey = data.idempotencyKey || `${sourceId}:${questionType}:${questionNo}`;

            if (activeDirectQaKeysRef.current.has(qaKey)) return;
            activeDirectQaKeysRef.current.add(qaKey);
            directPdfQaPending = true;
            setStatus({ stage: "processing", label: "Checking PDF", message: "Searching the selected PDF for the exact question…" });

            void (async () => {
              const waitForAbortableDelay = (delayMs: number) => new Promise<void>((resolve) => {
                const timer = window.setTimeout(resolve, delayMs);
                abortRef.current?.signal.addEventListener("abort", () => {
                  window.clearTimeout(timer);
                  resolve();
                }, { once: true });
              });

              const pollOcrUntilReady = async () => {
                let delayMs = 1_200;
                let retryStarted = false;
                for (let attempt = 1; attempt <= 24; attempt += 1) {
                  if (abortRef.current?.signal.aborted) return false;
                  setStatus({
                    stage: "processing",
                    label: "Processing scanned PDF",
                    message: `OCR is running. The question will retry automatically when the document is ready (${attempt}/24).`,
                  });
                  await waitForAbortableDelay(delayMs);
                  if (abortRef.current?.signal.aborted) return false;
                  const response = await apiFetch(`/api/pdf/ocr-status/${encodeURIComponent(sourceId)}`);
                  const payload = await response.json().catch(() => null);
                  if (!response.ok) throw new Error(payload?.message || payload?.error || "Could not check OCR status.");
                  const job = payload?.job;
                  setStatus({
                    stage: "processing",
                    label: job?.stage ? String(job.stage).replace(/_/g, " ") : "Processing scanned PDF",
                    message: `${job?.progress ?? 0}% complete · ${job?.warning || "Reading and indexing the document"}`,
                  });
                  if ((payload?.ocrStatus === "ready" && payload?.textIndexed === true) || (job?.status === "ready" && job?.progress === 100)) return true;
                  if (payload?.ocrStatus === "failed" || payload?.error) {
                    if (!retryStarted && job?.retryable !== false) {
                      retryStarted = true;
                      const retryResponse = await apiFetch(`/api/pdf/jobs/${encodeURIComponent(sourceId)}/retry`, { method: "POST" });
                      const retryPayload = await retryResponse.json().catch(() => null);
                      if (retryResponse.ok || retryResponse.status === 202) {
                        setStatus({ stage: "processing", label: "Retrying PDF", message: "The failed page pipeline was restarted automatically." });
                        delayMs = 1_200;
                        continue;
                      }
                      throw new Error(retryPayload?.message || "The scanned document retry could not be started.");
                    }
                    throw new Error(job?.errorMessage || "We could not process this scanned document after an automatic retry.");
                  }
                  delayMs = Math.min(10_000, Math.round(delayMs * 1.65));
                }
                return false;
              };

              try {
                if (!sourceId && !storagePath) {
                  const errorMsg = "The selected PDF does not have a valid source ID or storage path.";
                  setStatus({ stage: "error", label: "PDF source error", message: errorMsg });
                  onToken?.(errorMsg);
                  doneReceived = true;
                  onDone?.({ ok: false, completed: false, finishReason: "direct_pdf_qa_failed", errorCode: "DIRECT_QA_SOURCE_MISSING_STORAGE_PATH" });
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
                      setStatus({ stage: "processing", label: "Preparing PDF", message: "Opening the secure document source…" });
                    } else if (step === "uploading") {
                      setStatus({ stage: "processing", label: "Preparing PDF", message: payload?.isLarge ? "Preparing a large PDF for analysis…" : "Preparing the PDF for analysis…" });
                    } else if (step === "scanning") {
                      setStatus({ stage: "processing", label: "Searching the PDF", message: "Finding the exact question evidence…" });
                    } else if (step === "generating") {
                      setStatus({ stage: "processing", label: "Reasoning from evidence", message: "Connecting the verified question to the syllabus…" });
                    }
                  },
                });

                let result = await runDirectPdfQa();
                for (let attempt = 0; attempt < 4; attempt += 1) {
                  if (abortRef.current?.signal.aborted) break;
                  const isOcrQueued = result.errorCode === "OCR_QUEUED" || result.code === "OCR_QUEUED" || result.pending === true;
                  if (isOcrQueued) {
                    const ready = await pollOcrUntilReady();
                    if (!ready) {
                      result = { ok: false, errorCode: "OCR_PROCESSING_TIMEOUT", message: "The scanned document is still processing. Please try again shortly." };
                      break;
                    }
                    result = await runDirectPdfQa();
                    continue;
                  }

                  const isIndexing = result.errorCode === "PDF_INDEXING_STARTED" || result.errorCode === "PDF_INDEX_READY_RETRY";
                  if (!isIndexing) break;
                  const waitMs = Math.min(15_000, Math.max(800, Number(result.retryAfterMs || 4_000)));
                  setStatus({ stage: "processing", label: "Indexing PDF", message: `The question will retry automatically when indexing is complete (${attempt + 1}/4).` });
                  await waitForAbortableDelay(waitMs);
                  result = await runDirectPdfQa();
                }

                if (result.ok && result.found === true && result.answer) {
                  onToken?.(result.answer);
                  doneReceived = true;
                  const answerCompleted = result.completed !== false;
                  const directQualityReport = result.qualityReport || {
                    passed: answerCompleted,
                    confidence: answerCompleted ? 0.8 : 0.35,
                    coveragePercent: answerCompleted ? 100 : 0,
                    requestedSubparts: [],
                    missingRequirements: answerCompleted ? [] : ["The direct PDF answer did not pass its completeness check."],
                    factualRisks: [],
                    numericalChecks: [],
                    citationRisks: [],
                    strengths: answerCompleted ? ["Direct PDF answer coverage check passed."] : [],
                    reviewer: "deterministic",
                    repaired: false,
                  };
                  setQualityReport(directQualityReport);
                  onQualityReport?.(directQualityReport);
                  onAnswerStatus?.({ answerStatus: result.answerEvidenceStatus || "ai_solved", sourceMode: "locked_pdf", sourceTitle: title || null, contradictions: [] });
                  onDone?.({
                    ok: true,
                    completed: answerCompleted,
                    finishReason: answerCompleted ? "direct_pdf_qa_complete" : "direct_pdf_qa_incomplete",
                    evidenceComplete: answerCompleted,
                    answer: result.answer,
                    qualityReport: directQualityReport,
                    answerStatus: result.answerEvidenceStatus || "ai_solved",
                    sourceMode: "locked_pdf",
                    sources: [{ id: sourceId, title, storagePath }],
                    paperInfo: {
                      sourceId,
                      questionNo,
                      questionType,
                      year,
                      subject,
                      extractionMethod: result.extractionMethod || "gemini_direct_pdf_qa",
                      sourceEvidence: result.sourceEvidence,
                    },
                    visualBlocks: result.visualBlocks || [],
                  });
                } else {
                  const errorString = String(result.error || result.message || "").toLowerCase();
                  const billingExhausted = result.errorCode === "AI_BILLING_EXHAUSTED" || /depleted|credits|exhausted|billing|429|resource_exhausted/.test(errorString);
                  const parserFailure = result.errorCode === "PDF_PARSER_RUNTIME_ERROR" || result.errorCode === "PDF_PARSER_UNAVAILABLE";
                  const permissionFailure = result.errorCode === "DIRECT_QA_SOURCE_FORBIDDEN" || result.errorCode === "SOURCE_ACCESS_FORBIDDEN" || result.errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED";
                  const processing = result.errorCode === "OCR_QUEUED" || result.errorCode === "PDF_INDEXING_STARTED" || result.errorCode === "PDF_INDEX_READY_RETRY";

                  let userMessage = result.message || result.reason || "The PDF could not provide enough exact evidence for this question.";
                  if (billingExhausted) userMessage = "The AI service limit has been reached. Please try again after the service is restored.";
                  else if (parserFailure) userMessage = "The PDF parser encountered a server error. Please try again later.";
                  else if (permissionFailure) userMessage = "You do not have permission to read this PDF source.";
                  else if (result.errorCode === "OCR_PROCESSING_UNAVAILABLE" || result.errorCode === "OCR_PROCESSING_TIMEOUT") userMessage = "We could not process this scanned document. Please try again later.";
                  else if (result.found === false) userMessage = result.message || result.reason || "The exact question evidence was not found in this PDF. Add a clearer question image or select the correct paper.";

                  setStatus({
                    stage: processing ? "processing" : "error",
                    label: processing ? "Processing PDF" : "PDF answer unavailable",
                    message: userMessage,
                  });
                  onToken?.(userMessage);
                  doneReceived = true;
                  onDone?.({ ok: false, completed: false, finishReason: "direct_pdf_qa_failed", errorCode: result.errorCode, sources: [{ id: sourceId, title, storagePath }] });
                }
              } catch (err: any) {
                const errorCode = err.errorCode || "FATAL_ERROR";
                let userMessage = "The PDF answer could not be completed. Please try again.";
                if (errorCode === "DIRECT_QA_BACKEND_NON_JSON_RESPONSE") userMessage = "The PDF service returned an invalid response. Please try again after reprocessing the document.";
                else if (errorCode === "DIRECT_QA_FIREBASE_FETCH_FAILED") userMessage = "The PDF file could not be read from storage. Please sign in again and retry.";
                else if (String(err.message || "").includes("Failed to fetch")) userMessage = "The PDF service could not be reached. Check your connection and try again.";
                else if (err.message) userMessage = err.message;

                setError(err.message || userMessage);
                setStatus({ stage: "error", label: "PDF answer unavailable", message: userMessage });
                onToken?.(userMessage);
                onError?.({ error: err.message || userMessage });
                doneReceived = true;
                onDone?.({ ok: false, completed: false, finishReason: "direct_pdf_qa_failed", errorCode, sources: [{ id: sourceId, title, storagePath }] });
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
          if (eventName === "answer_status") {
            onAnswerStatus?.({
              answerStatus: data.answerStatus || data.status,
              sourceMode: data.sourceMode,
              lockedSourceActive: data.lockedSourceActive === true,
              sourceTitle: data.sourceTitle || null,
              contradictions: data.contradictions || [],
            });
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
                label: "Checking PDF",
                message: "Extracting the exact question from the selected PDF…"
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

      const { cleanText: finalCleanText, blocks: finalBlocks } = extractVisualBlocks(accumulatedFullText);
      if (finalBlocks.length > 0) onVisualBlocks?.(finalBlocks);
      const finalRenderedText = sanitizeMathMarkdown(stripRawVisualBlocks(finalCleanText));
      if (lastSentRenderedText !== finalRenderedText) {
        const delta = finalRenderedText.substring(lastSentRenderedText.length);
        if (delta.length > 0) {
          onToken?.(delta);
        }
        setAnswer(finalRenderedText);
        lastSentRenderedText = finalRenderedText;
      }

      if (!doneReceived) {
        let recovered = false;
        if (accumulatedFullText.trim().length >= 80 && !controller.signal.aborted) {
          try {
            const recoveryStatus = { stage: "processing", label: "Recovering answer", message: "The connection closed; continuing from the saved partial answer automatically…" };
            setStatus(recoveryStatus);
            onStatus?.(recoveryStatus);
            const recoveryResponse = await apiFetch("/api/ai/continue", {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                originalPrompt: isContinue ? originalPrompt : prompt,
                previousAssistantText: accumulatedFullText,
                sources: inputSources,
                reason: "STREAM_CLOSED_BEFORE_DONE",
                clientRequestId: `${clientRequestId}_transport_recovery`,
              }),
            });
            if (recoveryResponse.ok && recoveryResponse.body) {
              const recoveryReader = recoveryResponse.body.getReader();
              const recoveryDecoder = new TextDecoder();
              const recoveryParser = new SSEParser();
              let recoveryDone: any = null;
              while (true) {
                const { value, done } = await recoveryReader.read();
                if (done) break;
                for (const recoveryEvent of recoveryParser.parse(recoveryDecoder.decode(value, { stream: true }))) {
                  let recoveryData: any = null;
                  try { recoveryData = JSON.parse(recoveryEvent.data); } catch { continue; }
                  if (recoveryEvent.event === "token" || recoveryEvent.event === "chunk") {
                    accumulatedFullText += recoveryData.text || "";
                    const { cleanText } = extractVisualBlocks(accumulatedFullText);
                    const rendered = sanitizeMathMarkdown(stripRawVisualBlocks(cleanText));
                    const delta = rendered.substring(lastSentRenderedText.length);
                    if (delta) onToken?.(delta);
                    lastSentRenderedText = rendered;
                    setAnswer(rendered);
                  } else if (recoveryEvent.event === "status") {
                    setStatus(recoveryData);
                    onStatus?.(recoveryData);
                  } else if (recoveryEvent.event === "done") {
                    recoveryDone = recoveryData;
                  }
                }
              }
              if (recoveryDone?.completed === true) {
                recovered = true;
                doneReceived = true;
                setIsStreaming(false);
                setStatus({ stage: "done", label: "Complete" });
                onDone?.({ ...recoveryDone, transportRecovered: true });
              }
            }
          } catch (recoveryError) {
            if (import.meta.env.DEV) console.warn("[Stream] Automatic transport recovery failed", recoveryError);
          }
        }
        if (!recovered) {
          setIsStreaming(false);
          setIsRecoverableError(true);
          setStatus({ stage: "error", label: "Answer interrupted", message: "The connection closed before the answer was confirmed complete." });
          onDone?.({ completed: false, finishReason: "stream_closed_before_done", reason: "STREAM_CLOSED_BEFORE_DONE", canContinue: true });
        }
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
    qualityReport,
    webCandidates,
    pendingImport,
    importStatus,
    importComplete,
    sendAIMessage,
    cancel
  };
}
