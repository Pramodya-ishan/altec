import { getAIClient, AI_MODELS, getModelFallbackChain } from "./client";
import { classifyAiError } from "./aiErrorClassifier";
import { getCloraSystemPrompt } from "./prompts";
import { stripRawVisualBlocks } from "../ai-core/answer/stripVisualBlocks";
import { loadUserAIContext } from "../firebase/userContext";
import { getAdminDb, getAdminBucket } from "../firebase/admin";
import { AI_WORKFLOW_STAGES } from "./workflow";
import { extractStableMemoryIfUseful } from "./memoryExtractor";

// New tools
import { routeKnowledgeRequest } from "../knowledge/knowledgeRouter";
import { searchPastPapers } from "../pastPapers/searchPastPapers";
import { retrieveRelevantKnowledge, retrieveUploadedPdfQuestion } from "../knowledge/retrieve";
import { readUrlsWithGemini } from "./tools/urlContext";
import { groundedSearch } from "./tools/googleSearchGrounding";
import { ExamResolutionResult } from "./examResourceResolver";
import { askGeminiDirectPdfStream } from "../pdf/directPdfQa";
import { getConversationState, updateConversationState } from "../knowledge/conversationState";
import { retrieveEvidence } from "../knowledge/evidenceRetrieval";
import { generateContentStreamWithFallback, callGeminiWithFallback, AITask } from "./modelRouter";
import { resolveAnswerPolicy } from "./answerPolicy";
import { scoreSource } from "../sources/sourceScoring";
import { isLessonEvidenceMode } from "../knowledge/lessonResolver";
import { parseSelectedPdfQuestionFollowup } from "./selectedPdfFollowup";

interface StreamTrace {
  requestId: string;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
  doneSent: boolean;
  clientClosed: boolean;
  errorCode?: string;
  errorMessage?: string;
  tokenCount: number;
  totalChars: number;
  lastEvent?: string;
  chatSaved: boolean;
  messageId?: string;
}

export const lastStreamTraces: StreamTrace[] = [];

export function addStreamTrace(trace: StreamTrace) {
  lastStreamTraces.unshift(trace);
  if (lastStreamTraces.length > 20) {
    lastStreamTraces.pop();
  }
}

function emitSse(res: any, event: string, data?: any) {
  try {
    res.write(`event: ${event}\n`);
    const json = JSON.stringify(data ?? {});
    for (const line of json.split("\n")) {
      res.write(`data: ${line}\n`);
    }
    res.write("\n");
    if (typeof res.flush === "function") res.flush();
  } catch (e) {
    // Client disconnected
  }
}

async function safeCall<T>(name: string, fn: () => Promise<T>, fallback: T, res: any): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[STREAM_SAFE_CALL_FAILED] name=${name}`, err);
    try {
      emitSse(res, "status", {
        step: "warning",
        message: `${name} warning: continuing with available data`
      });
    } catch (e) {
      // ignore
    }
    return fallback;
  }
}

function getTemperature(mode: string) {
  switch (mode) {
    case 'today_plan': return 0.25;
    case 'study_plan': return 0.25;
    case 'tutor_explanation': return 0.35;
    case 'notes_generation': return 0.3;
    case 'quiz_generation': return 0.35;
    case 'past_paper_search': return 0.2;
    default: return 0.4;
  }
}

function getMaxTokens(mode: string) {
  if (mode === "uploaded_pdf_question_qa" || mode === "uploaded_pdf_qa" || mode === "rag_qa" || mode === "paper_question_qa") {
    return 8192;
  }
  return 2000;
}

function chooseModel(mode: string) {
  return AI_MODELS.default;
}

export type SaveChatResult = {
  chatSaved: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

export async function saveFinalChat(params: {uid: string, email?: string, userText: string, assistantText: string, mode: string, subject?: string, sources?: any[]}): Promise<SaveChatResult> {
  // Always strip visual blocks before saving to history
  params.assistantText = stripRawVisualBlocks(params.assistantText);

  try {
    const db = getAdminDb();
    const batch = db.batch();

    const timestamp = new Date().toISOString();
    const requestId = Date.now().toString() + Math.random().toString(36).substring(7);

    const { removeUndefinedDeep } = await import("../ai-core/memory/chatSanitizer");
    const chatData = removeUndefinedDeep({
      requestId,
      userPrompt: params.userText,
      assistantAnswer: params.assistantText,
      mode: params.mode,
      subject: params.subject || null,
      sources: (params.sources || []).map(s => ({
        id: s.id || s.sourceId,
        title: s.title,
        url: s.url || null,
        storagePath: s.storagePath || null,
        badge: s.badge || null
      })).filter(s => s.id || s.title),
      createdAt: timestamp,
      chatSaved: true
    });

    const historyRef = db.collection("users").doc(params.uid).collection("chat_history").doc(requestId);
    batch.set(historyRef, chatData);

    if (params.email) {
      const emailRef = db.collection("users").doc(params.email.toLowerCase()).collection("chat_history").doc(requestId);
      batch.set(emailRef, chatData);
    }

    await batch.commit();
    return { chatSaved: true, messageId: requestId };
  } catch (e: any) {
    console.warn("CHAT_SAVE_SKIPPED", e.message || e);
    return { chatSaved: false, errorCode: "SAVE_FAILED", errorMessage: e.message || String(e) };
  }
}

import { registerRequest, unregisterRequest, cancelRequest } from "./cancellation";
export async function aiRespondStream(req: any, res: any) {
  const startedAt = Date.now();
  const requestId = req.body?.clientRequestId || "req_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  const trace: StreamTrace = {
    requestId,
    startedAt: new Date().toISOString(),
    completed: false,
    doneSent: false,
    clientClosed: false,
    tokenCount: 0,
    totalChars: 0,
    chatSaved: false
  };
  addStreamTrace(trace);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const abortController = registerRequest(requestId);
  const signal = abortController.signal;
  const heartbeatInterval = setInterval(() => {
    try {
      emitSse(res, "heartbeat", { ok: true, requestId, ts: Date.now() });
      trace.lastEvent = "heartbeat";
    } catch (e) {
      // ignore
    }
  }, 10000);
  req.on("close", () => {
    cancelRequest(requestId);
    console.log(`[STREAM] STREAM_CLIENT_CLOSED requestId=${requestId}`);
    trace.clientClosed = true;
    trace.endedAt = new Date().toISOString();
  });

  try {
    const { prompt, activeSubject, mode: requestedMode = "auto", history = [], image, attachments } = req.body;
    const user = req.user;

    // Check Daily Safety Limit Guardrails (REMOVED)
    const { trackAIUsage } = await import("../cost/usageTracker");

    let allSources: any[] = [];

    emitSse(res, "status", { step: "started", message: "Starting stream..." });
    emitSse(res, "status", { label: "Thinking" });

    // 1. Route Request
    const { detectOfficialPaperCandidate } = await import("../ai-core/intent/paperQuestionParser");
    const paperIntent = detectOfficialPaperCandidate(prompt, activeSubject);

    // Check if it's an official paper candidate but subject is missing
    if (paperIntent.isOfficialPaperCandidate && paperIntent.needsSubjectClarification) {
      const msg = `මේ ${paperIntent.year} paper එකේ subject එක මොකක්ද? (SFT / ET / ICT)`;
      emitSse(res, "token", { text: msg });
      trace.lastEvent = "token";
      let chatRes = await saveFinalChat({
          uid: user.uid, email: user.email, userText: prompt, assistantText: msg, mode: "paper_question_qa", subject: activeSubject
      });
      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      return;
    }

    const route = await safeCall("routeKnowledgeRequest", () => routeKnowledgeRequest({
      prompt,
      uid: user.uid,
      email: user.email,
      activeSubject: paperIntent.subject || activeSubject,
      conversationHistory: history,
    }), {
      mode: paperIntent.isOfficialPaperCandidate ? "paper_question_qa" : "normal_chat",
      answerHints: { mustUseRag: true, mustUseGoogleSearch: false, mustUseUrlContext: false, mustAskClarification: false },
      entities: {
        year: paperIntent.year,
        subject: paperIntent.subject,
        questionNo: paperIntent.questionNo,
        questionType: paperIntent.questionType
      }
    } as any, res);

    // [FIX 1] Force paper intent over LLM router if it looks like a paper question
    if (paperIntent.isOfficialPaperCandidate) {
      console.log(`[OFFICIAL_PAPER_GATE] year=${paperIntent.year} subject=${paperIntent.subject} questionNo=${paperIntent.questionNo} type=${paperIntent.questionType}`);
      console.log(`[AI_RESPOND_STREAM] Forcing paper_question_qa mode`);
      route.mode = "paper_question_qa";
      route.entities.year = paperIntent.year || route.entities.year;
      route.entities.subject = paperIntent.subject || route.entities.subject;
      route.entities.questionNo = paperIntent.questionNo || route.entities.questionNo;
      route.entities.questionType = paperIntent.questionType || route.entities.questionType;
      route.answerHints.mustUseRag = true;
    }

    // [FIX 3] Add hard invariant: official question cannot enter normal_chat
    if (paperIntent.isOfficialPaperCandidate && route.mode === "normal_chat") {
      console.log(`[OFFICIAL_PAPER_GATE] Converted normal_chat -> paper_question_qa`);
      route.mode = "paper_question_qa";
    }

    const policy = resolveAnswerPolicy(prompt, route, activeSubject, attachments);
    const activeConversationState = await getConversationState(user.uid);
    const evidence = await retrieveEvidence(user.uid, prompt, route, policy, activeConversationState);
    // REMOVED: Early evidence apology block (Finding 026)
    if (evidence.selectedSource) {
       route.entities.activeSourceId = evidence.selectedSource.id;
       route.entities.year = evidence.selectedSource.year || route.entities.year;
    }
    await updateConversationState(user.uid, {
      activeSubject: evidence.subject || activeConversationState.activeSubject,
      activeLessonIds: evidence.lessonIds.length > 0 ? evidence.lessonIds : activeConversationState.activeLessonIds,
      activeSourceIds: evidence.allowedSourceIds.length > 0 ? evidence.allowedSourceIds : activeConversationState.activeSourceIds,
      lastIntent: evidence.intent
    });
    if (policy.intent === "blocked_or_unsafe") {
        emitSse(res, "token", { text: policy.blockingMessage });
        trace.completed = true;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: null, chatSaved: false, sources: [] });
        return;
    }

    // Disable unused routes based on policy
    if (!policy.allowSources) {
      route.answerHints.mustUseRag = false;
      route.answerHints.mustUseGoogleSearch = false;
      route.answerHints.mustUseUrlContext = false;
    }

    // [FIX 8] Correction Phrase Detection (e.g., "oka fake")
    const lowerPrompt = prompt.toLowerCase();
    const correctionPhrases = ["oka fake", "werdi", "weradi", "oka newe", "වැරදියි", "ඕක බොරු", "oka boru", "not correct", "fake", "wrong", "boru", "boru kiynn epa", "boru dewal", "බොරු", "මේක බොරු", "නෑ", "not this"];
    const isCorrection = correctionPhrases.some(p => lowerPrompt.includes(p));


    // Check previous message context for correction
    const lastMsg = (history && history.length > 0) ? history[history.length - 1] : null;
    const lastPaperInfo = lastMsg?.metadata?.paperInfo || lastMsg?.paperInfo;

    if (isCorrection && lastPaperInfo?.sourceId && lastPaperInfo?.questionNo) {
      console.log(`[AI_RESPOND_STREAM] Correction phrase detected for ${lastPaperInfo.sourceId} Q${lastPaperInfo.questionNo}`);
      emitSse(res, "status", { step: "correction", message: "Processing correction feedback..." });

      const { handleWrongAnswerFeedback } = await import("../ai-core/feedback/wrongAnswerHandler");
      await handleWrongAnswerFeedback({
        uid: user.uid,
        sourceId: lastPaperInfo.sourceId,
        questionType: lastPaperInfo.questionType || "MCQ",
        questionNo: lastPaperInfo.questionNo,
        reason: prompt,
        originalPrompt: prompt,
        badAnswer: lastMsg?.content || lastMsg?.text || "",
        mode: "paper_question_qa",
        year: lastPaperInfo.year,
        subject: lastPaperInfo.subject
      });

      const correctionMsg = "⚠️ **Feedback Received:** ස්තූතියි! මම එම පිළිතුර වැරදි ලෙස සලකුණු කර Admin review එකට යොමු කළා. මම නැවත වතාවක් Direct PDF QA හරහා source එක පරීක්ෂා කර සත්‍යාපනය කරන්නම්.";
      emitSse(res, "token", { text: correctionMsg });

      // Force direct PDF QA path for the correction
      route.mode = "paper_question_qa";
      route.entities.year = lastPaperInfo.year;
      route.entities.subject = lastPaperInfo.subject;
      route.entities.questionNo = lastPaperInfo.questionNo;
      route.entities.questionType = lastPaperInfo.questionType || "MCQ";
    }

    // If it asks for clarification
    if (route.answerHints.mustAskClarification && route.entities.clarificationQuestion) {
      emitSse(res, "token", { text: route.entities.clarificationQuestion });
      trace.lastEvent = "token";
      let chatRes: any = { chatSaved: false };
      try {
        chatRes = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: route.entities.clarificationQuestion,
          mode: route.mode,
          subject: activeSubject
        });
      } catch (err: any) {
        console.warn("CHAT_SAVE_SKIPPED", err);
        chatRes = { chatSaved: false, errorCode: "SAVE_THROWN", errorMessage: err?.message || "Chat save failed" };
      }
      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }

    // A short follow-up such as "1", "q1", or "1st mcq" must stay locked
    // to the PDF selected in the previous turn. Previously the lesson lookup
    // returned before persisting selectedSourceId, so this fell through to the
    // generic model and could fabricate a question.
    const selectedPdfQuestion = parseSelectedPdfQuestionFollowup(prompt);
    if (activeConversationState.selectedSourceId && selectedPdfQuestion) {
      const { getSourceInventory } = await import("../sources/sourceInventoryService");
      const selectedSubject = evidence.subject || activeConversationState.activeSubject || activeSubject || "SFT";
      const isAdminUser = user.roles?.includes("admin") || user.admin === true;
      const inventory = await getSourceInventory({ uid: user.uid, subject: selectedSubject, isAdmin: isAdminUser });
      const availableSources = [
        ...inventory.groups.pastPapers,
        ...inventory.groups.markingSchemes,
        ...inventory.groups.syllabus,
        ...inventory.groups.uploadedPdfs,
        ...inventory.groups.paperStructure,
      ];
      const selectedSource = availableSources.find((source: any) => {
        const id = String(source.sourceId || source.id || "");
        return id === String(activeConversationState.selectedSourceId);
      });

      if (selectedSource) {
        const sourceId = selectedSource.sourceId || selectedSource.id;
        const sourcePayload = {
          ...selectedSource,
          id: sourceId,
          sourceId,
          url: selectedSource.url || `/api/rag/sources/${sourceId}/download`,
          usedInAnswer: true,
        };
        await updateConversationState(user.uid, {
          activeSubject: selectedSubject,
          activeSourceIds: [sourceId],
          selectedSourceId: sourceId,
          selectedQuestionId: selectedPdfQuestion.questionNo,
          currentQuestionIndex: Number(selectedPdfQuestion.questionNo),
          evidenceMode: "strict",
          allowGeneratedContent: false,
          lastIntent: "selected_resource_discussion",
        });

        emitSse(res, "sources", { sources: [sourcePayload] });
        emitSse(res, "direct_pdf_handoff_required", {
          sourceId,
          storagePath: selectedSource.storagePath,
          downloadUrl: selectedSource.downloadUrl || selectedSource.url,
          title: selectedSource.title,
          subject: selectedSubject,
          year: selectedSource.year,
          questionNo: selectedPdfQuestion.questionNo,
          questionType: selectedPdfQuestion.questionType,
          prompt,
          reason: "SELECTED_PDF_QUESTION_FOLLOWUP",
          message: "Selected PDF එකෙන් exact question evidence එක සොයමින් පවතී.",
        });
        emitSse(res, "done", {
          ok: true,
          completed: false,
          pending: true,
          requestId,
          finishReason: "pending_direct_pdf_qa",
          reason: "SELECTED_PDF_QUESTION_FOLLOWUP",
          canContinue: true,
          sources: [sourcePayload],
          paperInfo: {
            sourceId,
            questionNo: selectedPdfQuestion.questionNo,
            year: selectedSource.year,
            subject: selectedSubject,
            questionType: selectedPdfQuestion.questionType,
            prompt,
            extractionMethod: "pending_direct_pdf_qa",
          },
        });
        trace.doneSent = true;
        trace.completed = false;
        return;
      }
    }

    // A lesson PDF lookup is an inventory operation, not a generative answer.
    // Return exact Firebase matches so the model cannot invent a web source.
    if (route.mode === "lesson_pdf_search") {
      const lessonName = route.entities.lesson || evidence.lessonIds[0] || "requested lesson";
      const lessonSources = (evidence.candidates || []).map((source: any) => {
        const id = source.sourceId || source.id;
        return {
          ...source,
          id,
          sourceId: id,
          url: source.url || `/api/rag/sources/${id}/download`,
          badge: "Lesson PDF",
          usedInAnswer: true,
        };
      });
      const answer = lessonSources.length > 0
        ? [
            `**${lessonName}** lesson එකට match වෙන saved PDF resource${lessonSources.length === 1 ? " එක" : "s"}:`,
            "",
            ...lessonSources.map((source: any, index: number) => `${index + 1}. **${source.title}**`),
            "",
            "PDF එක open කරන්න authenticated source card එකේ **Open PDF** භාවිත කරන්න. මෙය saved lesson resources වල exact result එකයි; source එකේ නැති exam details add කරන්නේ නැහැ.",
          ].join("\n")
        : `**${lessonName}** lesson එකට match වෙන saved PDF resource එකක් හමු වුණේ නැහැ. Lesson resource එක නිවැරදි lesson name එක යටතේ upload කර index කරන්න.`;

      if (lessonSources.length > 0) {
        const selected = lessonSources[0];
        await updateConversationState(user.uid, {
          activeSubject: route.entities.subject || activeSubject || activeConversationState.activeSubject,
          activeLessonIds: evidence.lessonIds.length > 0 ? evidence.lessonIds : activeConversationState.activeLessonIds,
          activeSourceIds: lessonSources.map((source: any) => source.sourceId || source.id).filter(Boolean),
          selectedSourceId: selected.sourceId || selected.id,
          selectedQuestionId: null,
          currentQuestionIndex: null,
          evidenceMode: "strict",
          allowGeneratedContent: false,
          lastIntent: "lesson_pdf_search",
        });
        emitSse(res, "sources", { sources: lessonSources });
      }
      emitSse(res, "token", { text: answer });
      const chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: route.mode,
        subject: route.entities.subject || activeSubject,
        sources: lessonSources,
      });
      if (chatRes?.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", {
        ok: lessonSources.length > 0,
        completed: true,
        requestId,
        messageId: chatRes?.messageId || null,
        chatSaved: trace.chatSaved,
        sources: lessonSources,
        finishReason: lessonSources.length > 0 ? "lesson_sources_found" : "lesson_sources_missing",
      });
      trace.doneSent = true;
      return;
    }

    emitSse(res, "status", { step: "profile", status: "reading" });

    const userContext = await safeCall("loadUserAIContext", () => loadUserAIContext(user.uid, user.email), { activeSubject } as any, res);
    userContext.activeSubject = activeSubject;

    // A. DETERMINISTIC Z-SCORE INTENT
    if (route.mode === "zscore_prediction") {
       const zctx = userContext?.zScoreContext || {};
          emitSse(res, "status", { step: "zscore_db", status: "reading" });
          const formatMetric = (value: unknown, digits = 4) =>
            typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "N/A";
          let fastAns = `### Exam Score Predictor Z estimate\n\nඔයාගේ syllabus progress එකෙන් Exam Score Predictor ගණනය කළ planning estimate එක: **${formatMetric(zctx.latestOverallZScore)}**.\n`;
          fastAns += zctx.targetZScore !== undefined
            ? `Target Z-score එක: **${zctx.targetZScore}**.\n`
            : `Target Z-score එක තවම Profile එකේ set කරලා නැහැ.\n`;
          if (zctx.gapToTarget !== undefined) fastAns += `Target gap එක: **${formatMetric(zctx.gapToTarget)}**.\n`;
          if (zctx.rankEstimate?.districtRank) fastAns += `Estimated district rank: **≈ ${Number(zctx.rankEstimate.districtRank).toLocaleString()}**.\n`;
          if (zctx.rankEstimate?.islandRank) fastAns += `Estimated island rank: **≈ ${Number(zctx.rankEstimate.islandRank).toLocaleString()}**.\n\n`;

          fastAns += `**Projected marks / subject estimates:**\n`;
          for (const subject of ["sft", "et", "ict"]) {
            const label = subject.toUpperCase();
            const mark = zctx.rawPaperAverages?.[subject];
            const estimate = zctx.subjectZScores?.[subject];
            fastAns += `- ${label}: ${typeof mark === "number" ? `${mark.toFixed(1)}%` : "N/A"} · Z ${formatMetric(estimate)}\n`;
          }
          fastAns += `\n`;

          if (zctx.latestUpdatedAt) fastAns += `*Last updated: ${new Date(zctx.latestUpdatedAt).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}*\n\n`;
          fastAns += `> මේවා Exam Score Predictor planning estimates. Official exam Z-score හෝ official district/island rank නොවේ.`;

          emitSse(res, "token", { text: fastAns });
          trace.lastEvent = "token";
          let chatRes = await saveFinalChat({
             uid: user.uid, email: user.email, userText: prompt, assistantText: fastAns, mode: "zscore_prediction", subject: activeSubject
          });
          if (chatRes && chatRes.chatSaved) {
            trace.chatSaved = true;
            trace.messageId = chatRes.messageId;
          }
          trace.completed = true;
          emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
          trace.doneSent = true;
          trace.lastEvent = "done";
          return;
    }

    // B. LESSON MARKS & WEIGHTING INTENT
    if (route.mode === "lesson_marks_intent") {
      emitSse(res, "status", { step: "syllabus_db", status: "searching" });
      const requestedSubject = route.entities.subject || activeSubject || "SFT";
      const lessonQuery = route.entities.lesson || prompt;

      const { resolveExamResources } = await import("./examResourceResolver");
      const resData = await safeCall("resolveExamResources", () => resolveExamResources({
        prompt: lessonQuery,
        uid: user.uid,
        subject: requestedSubject,
      }), {
        ok: false,
        sources: [],
        bestTextBlocks: [],
        needsWebSearch: true,
        hasExactQuestionText: false,
        hasPdfSource: false,
        hasMarkingScheme: false,
        hasSyllabus: false,
        hasPaperStructure: false
      } as ExamResolutionResult, res);

      // Find best syllabus static details or DB structure
      const staticSyllabus = resData.sources.find(s => s.badge === "Static Syllabus");
      let ansText = `### 📊 ${requestedSubject} Lesson Weights (Paper Structure DB & fallback)\n\n`;
      if (staticSyllabus) {
        ansText += `**Syllabus Weighting Fallback අනුව:**\n\n`;
        ansText += `${staticSyllabus.text}\n\n`;
      } else {
        ansText += `විෂය නිර්දේශයට අනුව MCQ, structured, සහ essay කොටස්වල ලකුණු බෙදීම හඳුනාගත නොහැකි විය.`;
      }
      ansText += `\n*Z-score impact priority:* High priority.`;

      emitSse(res, "token", { text: stripRawVisualBlocks(ansText) });
      trace.lastEvent = "token";
      let chatRes = await saveFinalChat({
         uid: user.uid, email: user.email, userText: prompt, assistantText: ansText, mode: "lesson_marks_intent", subject: requestedSubject
      });
      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: [] });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }

    // D. PDF INVENTORY REQUEST
    if (route.mode === "pdf_inventory_request") {
      emitSse(res, "status", { step: "sources_db", status: "searching" });
      const requestedSubject = route.entities.subject || activeSubject || undefined;

      const uid = user.uid;
      const userEmail = (user.email || "").toLowerCase();
      const isAdmin = user.roles?.includes("admin") || user.admin === true;

      const { getSourceInventory } = await import("../sources/sourceInventoryService");
      const inventory = await getSourceInventory({
        uid,
        subject: requestedSubject,
        isAdmin
      });

      const allSources: any[] = [];
      const groups = inventory.groups;
      allSources.push(
        ...groups.pastPapers,
        ...groups.markingSchemes,
        ...groups.syllabus,
        ...groups.paperStructure,
        ...groups.uploadedPdfs,
        ...groups.images
      );

      const pastPapers = groups.pastPapers;
      const markingSchemes = groups.markingSchemes;
      const syllabusList = groups.syllabus;
      const paperStructureList = groups.paperStructure;
      const imagesList = groups.images;
      const uploadedList = groups.uploadedPdfs;

      const sseSources = allSources.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url || `/api/rag/sources/${s.id}/download`,
        storagePath: s.storagePath,
        badge: s.resourceType === "past_paper" ? "Past Paper" : s.resourceType === "marking_scheme" ? "Marking Scheme" : "PDF Store",
        confidence: 1.0,
        sourceType: s.resourceType,
        sourceScope: s.sourceScope
      }));

      emitSse(res, "sources", { sources: sseSources });

      let answer = `📚 **මම සොයාගත් PDF සහ ප්‍රභවයන් (Sources) මෙන්න:**\n\n`;
      let count = 1;

      if (pastPapers.length > 0) {
        answer += `🏛️ **Past Papers**\n`;
        pastPapers.forEach((p: any) => {
          answer += `${count++}. **${p.title}** (${p.year || "Year N/A"}) - [Open](${p.url || `/api/rag/sources/${p.id}/download`})\n`;
        });
        answer += `\n`;
      }

      if (markingSchemes.length > 0) {
        answer += `📝 **Marking Schemes**\n`;
        markingSchemes.forEach((p: any) => {
          answer += `${count++}. **${p.title}** (${p.year || "Year N/A"}) - [Open](${p.url || `/api/rag/sources/${p.id}/download`})\n`;
        });
        answer += `\n`;
      }

      if (syllabusList.length > 0) {
        answer += `📖 **Syllabus Library**\n`;
        syllabusList.forEach((p: any) => {
          answer += `${count++}. **${p.title}** - [Open](${p.url || `/api/rag/sources/${p.id}/download`})\n`;
        });
        answer += `\n`;
      }

      if (paperStructureList.length > 0) {
        answer += `📐 **Paper Structure**\n`;
        paperStructureList.forEach((p: any) => {
          answer += `${count++}. **${p.title}** - [Open](${p.url || `/api/rag/sources/${p.id}/download`})\n`;
        });
        answer += `\n`;
      }

      if (uploadedList.length > 0) {
        answer += `📤 **Uploaded PDFs**\n`;
        uploadedList.forEach((p: any) => {
          answer += `${count++}. **${p.title}** - [Open](${p.url || `/api/rag/sources/${p.id}/download`})\n`;
        });
        answer += `\n`;
      }

      if (imagesList.length > 0) {
        answer += `🖼️ **Images**\n`;
        imagesList.forEach((p: any) => {
          answer += `${count++}. **${p.title}** - [Open](${p.url || `/api/rag/sources/${p.id}/download`})\n`;
        });
        answer += `\n`;
      }

      if (allSources.length === 0) {
        answer = `❌ Firebase එකේ PDFs තවම හම්බුණේ නැහැ. Upload කළා නම් index/reload කරන්න.`;
      } else {
        answer += `💡 මෙම ඕනෑම PDF එකක් මත ක්ලික් කර එය කියවිය හැක. එමෙන්ම එම ප්‍රශ්න පත්‍රවලින් ඕනෑම ප්‍රශ්නයක් මගෙන් විමසන්න!`;
      }

      emitSse(res, "token", { text: stripRawVisualBlocks(answer) });
      trace.lastEvent = "token";

      let chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: "pdf_inventory_request",
        subject: requestedSubject,
        sources: sseSources,
      });

      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: sseSources });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }

    // C. PAST PAPER QUESTION QA or MARKING SCHEME REQUEST or PDF LINK REQUEST
    const hasUploadedPdf = prompt.includes("[Uploaded PDF:");
    const isPaperQa = !hasUploadedPdf && (route.mode === "paper_question_qa" || route.mode === "marking_scheme_request" || route.mode === "pdf_link_request");
    if (isPaperQa) {
      const requestedSubject = route.entities.subject || activeSubject || "SFT";
      const requestedYear = route.entities.year;
      const requestedQuestionNo = route.entities.questionNo;

      if (requestedSubject && requestedYear) {
        emitSse(res, "status", { step: "exam_db", status: "searching" });

        let paperSource: any = null;
        let resolution: any = { sources: [], paperSource: null };

        const { resolveStrictSource } = await import("../ai-core/sources/sourceResolver");
        const { getSourceInventory } = await import("../sources/sourceInventoryService");

        const isAdminUser = user.roles?.includes("admin") || user.admin === true;
        const inventory = await getSourceInventory({ uid: user.uid, subject: requestedSubject, isAdmin: isAdminUser });
        const allAvailableSources = [...inventory.groups.pastPapers, ...inventory.groups.markingSchemes, ...inventory.groups.syllabus, ...inventory.groups.uploadedPdfs];

        const strictRes = resolveStrictSource(allAvailableSources, {
          year: requestedYear,
          subject: requestedSubject,
          activeSourceId: null,
          prompt
        });

        if (strictRes.sourceLocked && strictRes.selectedSource) {
           console.log(`[AI_CORE] Source Locked: ${strictRes.selectedSource.title}`);
           paperSource = strictRes.selectedSource;
           // CLEAR ALL OTHER SOURCES if locked
           allSources = [{
             sourceId: paperSource.id || paperSource.sourceId,
             title: paperSource.title,
             url: paperSource.url || null,
             storagePath: paperSource.storagePath || null,
             badge: "Official Source",
             year: paperSource.year,
             subject: paperSource.subject,
             resourceType: paperSource.resourceType
           }];
        } else {
           // [FIX 11] For official paper questions, stop if source lock fails. Do not fallback to legacy.
           if (paperIntent.isOfficialPaperCandidate || route.mode === "paper_question_qa") {
             const msg = `${requestedYear || ""} ${requestedSubject || ""} ${paperIntent.questionType || "MCQ"} ${requestedQuestionNo || ""} සඳහා exact official paper source lock වෙලා නැහැ. ඒ නිසා answer guess කරන්න බැහැ.`;
             emitSse(res, "evidence_missing", {
               reason: "STRICT_SOURCE_LOCK_FAILED",
               message: msg
             });
             emitSse(res, "token", { text: msg });
             emitSse(res, "done", {
               ok: false,
               completed: true,
               requestId,
               finishReason: "blocked_no_source_lock"
             });
             trace.doneSent = true;
             return;
           }

           // Fallback to legacy resolver if not strictly locked
           const { resolveExamResources } = await import("./examResourceResolver");
           const resolution = await safeCall("resolveExamResources", () => resolveExamResources({
             prompt,
             uid: user.uid,
             subject: requestedSubject,
             year: requestedYear,
             resourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
             questionNo: requestedQuestionNo,
           }), { sources: [] } as any, res);
           paperSource = resolution.paperSource;
           resolution.sources.forEach((s: any) => {
             allSources.push({ id: s.id, title: s.title, url: s.url, storagePath: s.storagePath, badge: s.badge || "Verified" });
           });
        }

        if (paperSource) {
          if (!allSources.find((s: any) => s.id === paperSource.id)) {
            allSources.push({ sourceId: paperSource.id, title: paperSource.title, url: paperSource.url, storagePath: paperSource.storagePath, badge: "Locked Source" });
          }
          emitSse(res, "sources", { sources: allSources });
        }
        const hasPaperSource = !!paperSource;
        const questionId = (paperSource?.id && requestedQuestionNo) ? `${paperSource.id}_${paperIntent.questionType || 'MCQ'}_${requestedQuestionNo}`.replace(/\//g, "_") : null;

        if (hasPaperSource && route.mode !== "pdf_link_request") {
          const db = getAdminDb();
          const { retrieveEvidenceForPaperQuestion } = await import("../ai-core/evidence/evidenceRetriever");

          // 1.1 Check Evidence first!
          if (questionId) {
            emitSse(res, "status", { step: "evidence_check", message: "Searching for verified evidence..." });
            const evidenceResult = await retrieveEvidenceForPaperQuestion({
              sourceId: paperSource.id,
              questionType: paperIntent.questionType || "MCQ",
              questionNo: requestedQuestionNo!,
              year: requestedYear!,
              subject: requestedSubject!
            });

            if (evidenceResult.ok && evidenceResult.evidence?.answer) {
              const evidence = evidenceResult.evidence;
              console.log(`[AI_RESPOND_STREAM] Evidence Found for ${questionId}`);

              const methodLabel = evidence.extractionMethod === "manual_verified" ? "Verified by Teacher" : "Found in PDF";
              emitSse(res, "status", { step: "evidence", message: `${methodLabel}...` });

              let finalAnswer: string = String(evidence.answer || evidence.officialAnswer || evidence.estimatedAnswer || "Answer extracted from PDF.");
              if (evidence.explanationSinhala) {
                finalAnswer += `\n\n🧠 **Explanation:**\n${evidence.explanationSinhala}`;
              }

              emitSse(res, "token", { text: stripRawVisualBlocks(finalAnswer) });
              trace.lastEvent = "token";

              const chatRes = await saveFinalChat({
                uid: user.uid, email: user.email, userText: prompt, assistantText: finalAnswer,
                mode: route.mode, subject: requestedSubject, sources: allSources
              });

              emitSse(res, "done", {
                ok: true,
                completed: true,
                requestId,
                messageId: chatRes?.messageId || null,
                chatSaved: chatRes.chatSaved,
                sources: allSources,
                paperInfo: {
                  sourceId: paperSource.id,
                  questionNo: requestedQuestionNo,
                  year: requestedYear,
                  subject: requestedSubject,
                  questionType: paperIntent.questionType || "MCQ",
              prompt: prompt,
                  extractionMethod: evidence.extractionMethod
                }
              });
              trace.doneSent = true;
              return;
            }
          }

          // 1.2 Check if Chunks are healthy
          let needsOcr = paperSource?.needsOcr === true || paperSource?.indexStatus === "needs_ocr";
          let noChunks = Number(paperSource?.chunkCount || 0) === 0;
          let badTextQuality = false;
          let healthyChunks: any[] = [];

          if (paperSource.id && !noChunks) {
            try {
              const { retrieveExactPaperQuestion } = await import("../knowledge/retrieve");
              const exactResult = await retrieveExactPaperQuestion({
                uid: user.uid,
                sourceId: paperSource.id,
                subject: requestedSubject,
                year: requestedYear,
                questionNo: requestedQuestionNo,
              });
              if (exactResult) {
                if (exactResult.needsOcr || exactResult.chunks.length === 0) {
                  noChunks = true;
                }
                if (exactResult.badTextQuality) {
                  badTextQuality = true;
                }
                healthyChunks = exactResult.chunks;

                // --- EVIDENCE GATE CHECK ---
                if (requestedQuestionNo && paperIntent.isOfficialPaperCandidate) {
                   const chunkText = (healthyChunks || []).map((c: any) => c.text).join("\n");

                   // [FIX 10] Stricter Chunk Quality Check
                   const qNoMarker = new RegExp(`\\b${requestedQuestionNo}\\b`);
                   const hasQuestionMarker = qNoMarker.test(chunkText);
                   const hasOptions = /1\)|2\)|3\)|4\)|5\)/.test(chunkText) || /\(1\)|\(2\)|\(3\)|\(4\)|\(5\)/.test(chunkText);

                   const isHealthy = hasQuestionMarker && (paperIntent.questionType === "MCQ" ? hasOptions : true);

                   if (!isHealthy || chunkText.length < 50) {
                      console.log(`[AI_CORE] Evidence Gate Failed for Chunks: ${paperSource.id} Q${requestedQuestionNo}`);
                      badTextQuality = true; // Force Direct PDF QA or OCR
                   }
                }
              }
            } catch (err) {
              console.warn("Failed to retrieve exact paper question for quality checks:", err);
            }
          }

          // 1.3 If chunks are missing or bad, trigger the authenticated Direct
          // PDF QA handoff. The frontend sends the source identity; the backend
          // performs the verified Firebase Admin read.
          if (noChunks || badTextQuality || needsOcr) {
            console.log(`[AI_RESPOND_STREAM] Direct PDF QA required for ${paperSource.id}. Emitting event...`);

            emitSse(res, "direct_pdf_handoff_required", {
              sourceId: paperSource.id || paperSource.sourceId,
              storagePath: paperSource.storagePath,
              downloadUrl: paperSource.downloadUrl || paperSource.url,
              title: paperSource.title,
              subject: requestedSubject,
              year: requestedYear,
              questionNo: requestedQuestionNo,
              questionType: paperIntent.questionType || "MCQ",
              prompt: prompt,
              reason: "DIRECT_PDF_QA_SERVER_SCAN_REQUIRED",
              message: "PDF source එක secure server scan එකකට යොමු කරනවා."
            });

            // [FIX 1] Emit explicit done event for pending Direct PDF QA
            emitSse(res, "done", {
              ok: true,
              completed: false,
              pending: true,
              requestId,
              finishReason: "pending_direct_pdf_qa",
              reason: "DIRECT_PDF_SERVER_SCAN_REQUIRED",
              canContinue: true,
              needsClientFile: false,
              sources: allSources.length > 0 ? allSources : [paperSource],
              paperInfo: {
                sourceId: paperSource.id || paperSource.sourceId,
                questionNo: requestedQuestionNo,
                year: requestedYear,
                subject: requestedSubject,
                questionType: paperIntent.questionType || "MCQ",
              prompt: prompt,
                extractionMethod: "pending_direct_pdf_qa"
              }
            });

            // The frontend starts the follow-up request and can hand over a
            // Firebase download URL obtained through the signed-in SDK. The
            // browser never fetches the PDF cross-origin.
            trace.doneSent = true;
            trace.completed = false;
            return;
          } else if (strictRes && strictRes.sourceLocked) {
            // 1.4 If chunks are healthy and we bypassed legacy resolver, populate resolution!
            resolution.hasExactQuestionText = true;
            resolution.bestTextBlocks = healthyChunks.map((c: any) => c.text);
            resolution.paperSource = paperSource;
          }
        }

        // Case 2: Exact resource is resolved locally!
        if (resolution.hasExactQuestionText || (route.mode === "pdf_link_request" && resolution.hasPdfSource)) {
          emitSse(res, "status", { step: "standard_answer", message: "Composing Standard Exam Answer..." });

          let composedAnswer = "";
          if (route.mode === "pdf_link_request") {
            const pSrc = resolution.paperSource;
            composedAnswer = `**${pSrc?.title || "PDF source"}** හමු වුණා.\n\n- Subject: ${requestedSubject}\n- Year: ${requestedYear}\n- Source: verified saved resource\n\nපහළ source card එකේ **Open PDF** භාවිත කරන්න. එය ඔබගේ Firebase session token එක සමඟ secure ලෙස file එක විවෘත කරනවා.`;
          } else {
            const { composeMarkingSchemeAnswer } = await import("./markingSchemeResolver");
            composedAnswer = composeMarkingSchemeAnswer({
              subject: requestedSubject,
              year: requestedYear,
              questionNo: requestedQuestionNo || "Q1",
              paperSource: resolution.paperSource,
              markingSchemeSource: resolution.markingSchemeSource,
              syllabusSource: resolution.syllabusSource,
              paperStructureSource: resolution.paperStructureSource,
              questionText: `G.C.E. A/L ${requestedYear} ${requestedSubject} විභාගයේ ${requestedQuestionNo || "Q1"} ප්‍රශ්නයට අදාළ පිළිතුර මෙසේය.`,
              officialAnswer: resolution.bestTextBlocks.join("\n\n") || "නිල ලකුණු දීමේ පටිපාටියට අනුකූල පිළිතුර.",
              isEstimated: !resolution.markingSchemeSource,
            });
          }

          if (resolution.paperSource && resolution.paperSource.ocrTextPdfStoragePath) {
            composedAnswer = `💡 *Sinhala text PDF එකත් generate වෙලා තියෙනවා. එතනින් indexed text භාවිතා කරනවා.*\n\n` + composedAnswer;
          }

          emitSse(res, "token", { text: stripRawVisualBlocks(composedAnswer) });
          trace.lastEvent = "token";

          let chatRes = await saveFinalChat({
            uid: user.uid,
            email: user.email,
            userText: prompt,
            assistantText: composedAnswer,
            mode: route.mode,
            subject: requestedSubject,
            sources: allSources,
          });
          if (chatRes && chatRes.chatSaved) {
            trace.chatSaved = true;
            trace.messageId = chatRes.messageId;
          }
          trace.completed = true;
          emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: allSources });
          trace.doneSent = true;
          trace.lastEvent = "done";
          return;
        }

        // Case 3: Local source missing -> Search Web for Candidate PDFs!
        if (resolution.needsWebSearch) {
          emitSse(res, "status", { step: "web_search", message: "Searching web..." });
          const { searchWebPdfCandidates } = await import("./webPdfSearch");
          const candidates = await safeCall("searchWebPdfCandidates", () => searchWebPdfCandidates({
            subject: requestedSubject,
            year: requestedYear,
            resourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
            questionNo: requestedQuestionNo,
          }), [], res);

          if (candidates.length > 0) {
            // Send candidate list and trigger confirmation UI
            emitSse(res, "web_candidates", { candidates });
            emitSse(res, "pending_import", {
              candidates,
              subject: requestedSubject,
              year: requestedYear,
              resourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : "past_paper",
              questionNo: requestedQuestionNo,
              originalPrompt: prompt,
            });

            const candidatePromptText = `🔍 **${requestedYear} ${requestedSubject}** සඳහා confirmed local source එකක් හම්බුණේ නැහැ.\n\nනමුත් Web search එක හරහා මෙම candidate ප්‍රභවයන් හමු වුණා. කරුණාකර නිවැරදි PDF එක තහවුරු කරන්න:\n\n` +
              candidates.map((cand, idx) => `${idx + 1}. **${cand.title}**\n   🔗 [Open PDF](${cand.url})`).join("\n\n") +
              `\n\n**ක්‍රියාමාර්ගය:**\nඉහත සඳහන් candidate ලැයිස්තුවෙන් නිවැරදි එක තහවුරු කිරීමට අදාළ **Confirm & Save** බොත්තම ක්ලික් කරන්න. එවිට එය auto-import වී text index කිරීමෙන් අනතුරුව ඔබට පිළිතුර ලබා දෙනු ඇත.`;

            emitSse(res, "token", { text: candidatePromptText });
            trace.lastEvent = "token";

            let chatRes = await saveFinalChat({
              uid: user.uid,
              email: user.email,
              userText: prompt,
              assistantText: candidatePromptText,
              mode: route.mode,
              subject: requestedSubject,
              sources: candidates,
            });
            if (chatRes && chatRes.chatSaved) {
              trace.chatSaved = true;
              trace.messageId = chatRes.messageId;
            }
            trace.completed = true;
            emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: candidates });
            trace.doneSent = true;
            trace.lastEvent = "done";
            return;
          }
        }

        // Case 4: Complete failure / No Candidates
        const failMsg = `⚠️ මට **${requestedYear} ${requestedSubject}** සඳහා confirmed PDF එකක් හෝ candidate එකක් සොයා ගැනීමට හැකි වුණේ නැහැ. කරුණාකර ප්‍රශ්නය ටයිප් කරන්න, නැතහොත් PDF එකක් අප්ලෝඩ් කරන්න.`;
        emitSse(res, "token", { text: failMsg });
        trace.lastEvent = "token";

        let chatRes = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: failMsg,
          mode: route.mode,
          subject: requestedSubject,
        });
        if (chatRes && chatRes.chatSaved) {
          trace.chatSaved = true;
          trace.messageId = chatRes.messageId;
        }
        trace.completed = true;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: allSources });
        trace.doneSent = true;
        trace.lastEvent = "done";
        return;
      }
    }

    let contextBlocksText = "";
    let hasExactQuestionText = false;
    let needsOcr = false;

    // 2.5 Targeted Uploaded PDF QA Flow
    if (route.mode === "uploaded_pdf_question_qa") {
      emitSse(res, "status", { step: "rag", status: "searching" });
      const retrieveResult = await safeCall("retrieveUploadedPdfQuestion", () => retrieveUploadedPdfQuestion({
        uid: user.uid,
        uploadedFileName: route.entities.uploadedFileName,
        questionNo: route.entities.questionNo,
        query: prompt,
        limit: 8
      }), { chunks: [], source: null, hasExactQuestionText: false, needsOcr: false }, res);

      hasExactQuestionText = retrieveResult.hasExactQuestionText;
      needsOcr = retrieveResult.needsOcr;

      if (retrieveResult.source) {
        allSources.push({
          sourceId: retrieveResult.source.id,
          title: retrieveResult.source.title,
          fileName: retrieveResult.source.fileName,
          storagePath: retrieveResult.source.storagePath,
          badge: "Uploaded",
          confidence: 1.0
        });
        emitSse(res, "sources", { sources: allSources });
        trace.lastEvent = "sources";
      }

      if (needsOcr) {
        const ocrWarning = "PDF එක save වෙලා තියෙනවා, නමුත් එහි searchable lesson text තවම සූදානම් නැහැ. ටික වේලාවකින් නැවත උත්සාහ කරන්න.";
        emitSse(res, "token", { text: ocrWarning });
        trace.lastEvent = "token";

        let chatRes = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: ocrWarning,
          mode: route.mode,
          subject: activeSubject,
          sources: allSources,
        });
        if (chatRes && chatRes.chatSaved) {
          trace.chatSaved = true;
          trace.messageId = chatRes.messageId;
        }
        trace.completed = true;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: allSources });
        trace.doneSent = true;
        trace.lastEvent = "done";
        return;
      }

      if (retrieveResult.chunks.length > 0) {
        retrieveResult.chunks.forEach((c: any, i: number) => {
          contextBlocksText += `\n[Uploaded PDF Chunk ${i+1}] Page ${c.pageNumber || 'N/A'}:\n${c.text}\n`;
        });
      }
    }

    // 3. RAG Search
    if (requestedMode === "deep_search" || (route.mode !== "uploaded_pdf_question_qa" && (route.answerHints.mustUseRag || route.mode === "normal_chat" || hasUploadedPdf))) {
      emitSse(res, "status", { step: "rag", status: "searching" });
      const retrieveResult: any = await safeCall("retrieveRelevantKnowledge", () => retrieveRelevantKnowledge({
        query: prompt,
        uid: user.uid,
        subject: route.entities.subject || activeSubject,
        limit: isLessonEvidenceMode(route.mode) ? 24 : 5,
        lesson: route.entities.lesson || evidence.lessonIds[0],
        strictLesson: isLessonEvidenceMode(route.mode),
        allowedSourceIds: evidence.allowedSourceIds,
      }) as Promise<any>, { chunks: [] } as any, res);
      const chunksList = Array.isArray(retrieveResult) ? retrieveResult : (retrieveResult?.chunks || []);
      if (isLessonEvidenceMode(route.mode) && Array.isArray(retrieveResult?.sources)) {
        for (const source of retrieveResult.sources) {
          if (source.usedInAnswer === false) continue;
          if (!allSources.some((existing: any) => (existing.sourceId || existing.id) === (source.sourceId || source.id))) {
            allSources.push({ ...source, badge: "Lesson PDF" });
          }
        }
      }
      if (chunksList.length > 0) {
        chunksList.forEach((c: any, i: number) => {
          const score = scoreSource(c, {
            subject: route.entities.subject || activeSubject,
            year: route.entities.year,
            resourceType: route.entities.resourceType || route.entities.paperType ? "past_paper" : undefined,
            paperType: route.entities.questionType,
            keywords: prompt.split(" ")
          });

          if (policy.intent === "official_paper_question" && score < 75) return;
          if (policy.intent === "syllabus_lesson_explanation" && score < 55) return;

          if (!isLessonEvidenceMode(route.mode)) {
            allSources.push({ title: c.title, sourceId: c.sourceId || c.id, pageNumber: c.metadata?.pageNumber || c.page, sourceType: c.sourceType || 'rag', sourceScope: c.sourceScope || 'personal', confidence: c.confidence, badge: "RAG" });
          }
          contextBlocksText += `\n[RAG SOURCE ${i+1}] ${c.title}:\n${c.text.substring(0, 1000)}\n`;
        });
      }
    }

    if (isLessonEvidenceMode(route.mode) && contextBlocksText.trim().length === 0) {
      const lessonName = route.entities.lesson || evidence.lessonIds[0] || "requested lesson";
      const statusMessage = evidence.evidenceStatus === "ocr_required"
        ? `**${lessonName}** lesson PDF එක save වෙලා තියෙනවා. Searchable lesson text සූදානම් වූ විගස ඒ PDF evidence එකෙන් ප්‍රශ්න සහ පිළිතුරු දෙන්නම්.`
        : `**${lessonName}** lesson එකට searchable PDF evidence එකක් තවම හමු වුණේ නැහැ. PDF එක lesson එක යටතේ upload කළ පසු එහි content එකෙන් පිළිතුරු දෙන්නම්.`;
      emitSse(res, "evidence_missing", {
        reason: evidence.evidenceStatus,
        lesson: lessonName,
        message: statusMessage,
      });
      emitSse(res, "token", { text: statusMessage });
      emitSse(res, "done", {
        ok: false,
        completed: true,
        requestId,
        finishReason: "blocked_no_lesson_evidence",
        sources: evidence.candidates,
      });
      trace.doneSent = true;
      trace.completed = true;
      return;
    }

    // 4. Web Search
    if (requestedMode === "web_search" || requestedMode === "deep_search" || (route.mode !== "uploaded_pdf_question_qa" && !isLessonEvidenceMode(route.mode) && route.answerHints.mustUseGoogleSearch)) {
      emitSse(res, "status", { step: "web_search", status: "searching", query: prompt });
      const web: any = await safeCall("groundedSearch", () => groundedSearch(prompt, { language: "si" }) as Promise<any>, { sources: [], summary: "" } as any, res);
      if (web.sources.length > 0) {
        web.sources.forEach((s: any, i: number) => {
          allSources.push({ title: s.title, url: s.url, confidence: s.confidence, badge: requestedMode === "web_search" || requestedMode === "deep_search" ? "Web Search" : "Candidate" });
          contextBlocksText += `\n[WEB SOURCE ${i+1}] ${s.title} (${s.url}):\n${s.snippet}\n`;
        });
      }
    }

    // 5. URL Context
    if (route.mode !== "uploaded_pdf_question_qa" && route.answerHints.mustUseUrlContext && route.entities.urls && route.entities.urls.length > 0) {
      emitSse(res, "status", { step: "url_context", status: "reading", urlCount: route.entities.urls.length });
      const uRes: any = await safeCall("readUrlsWithGemini", () => readUrlsWithGemini({
        urls: route.entities.urls,
        question: prompt,
        subject: route.entities.subject || activeSubject
      }) as Promise<any>, { sources: [], answer: "" } as any, res);
      uRes.sources.forEach((s: any) => {
        allSources.push({ title: s.title || s.url, url: s.url, confidence: 1, badge: "Uploaded" });
      });
      contextBlocksText += `\n[URL CONTEXT]:\n${uRes.answer}\n`;
    }

    if (allSources.length > 0) {
      emitSse(res, "sources", { sources: allSources });
      trace.lastEvent = "sources";
    }

    emitSse(res, "status", { step: "assistant", status: "Writing answer" });

    // Inject exact matching indicators into userContext for prompts
    const modifiedUserContext = {
      ...userContext,
      hasExactQuestionText,
      needsOcr
    };

    // Final prompt setup
    const ai = getAIClient();
    let aiTask: AITask = "normal_chat";
    if (["paper_question_qa", "marking_scheme_request", "lesson_marks_intent", "zscore_prediction", "uploaded_pdf_question_qa", "tutor_explanation"].includes(route.mode) || image) {
      aiTask = image ? "image_understanding" : "final_answer";
    }

    // [FIX 5] Mandatory Evidence Gate before final LLM
    if (paperIntent.isOfficialPaperCandidate && route.mode === "paper_question_qa" && !hasExactQuestionText) {
            let msg = "සමාවෙන්න, මට මේ ප්‍රශ්නයට අදාළ නිල මූලාශ්‍රයක් (past paper/scheme/PDF) සොයාගන්න බැරි වුණා.";
      if (route.mode === "paper_question_qa") {
        msg = "මෙම ප්‍රශ්නය සඳහා නිල Past Paper එක හෝ Marking Scheme එක සොයාගැනීමට නොහැකි විය.";
      }

      console.log("[AI_RESPOND_STREAM] Answer blocked: Missing evidence for official paper question.");
      emitSse(res, "evidence_missing", {
        reason: "NO_VALID_EVIDENCE_FOUND",
        message: msg
      });
      emitSse(res, "token", { text: msg });
      emitSse(res, "done", {
        ok: false,
        completed: true,
        requestId,
        finishReason: "blocked_no_evidence"
      });
      trace.doneSent = true;
      return;
    }

    const sysInstruction = getCloraSystemPrompt(modifiedUserContext, route.mode);
    let finalSysInstruction = sysInstruction;
    if (evidence.allowModelQuestionGeneration) {
      finalSysInstruction += "\n\n[STRICT INSTRUCTION]: The user has explicitly requested a MODEL/PRACTICE question. You MUST prefix your question exactly with: '⚠️ AI-generated model question — official past-paper question නොවේ' and NEVER claim it is from a real past paper.";
    } else if (policy.requireEvidence) {
      finalSysInstruction += "\n\n[STRICT INSTRUCTION]: The user is asking for a real paper question or syllabus discussion. You MUST base your answer strictly on the provided evidence. DO NOT invent or hallucinate any questions, equations, or past-paper details. If the evidence lacks the specific question, reply that you cannot find it.";
    }

    // Build the parts array for the contents object
    const mistakeImageSources: any[] = [];
    const contentsParts: any[] = [
      {
        text: `Context Blocks:\n${contextBlocksText}\n\nPrevious Chat History:\n${history?.length ? JSON.stringify(history) : 'None'}\n\nCurrent User Request:\n${prompt}\nAnswer in Sinhala-first style if appropriate.`
      }
    ];

    const asksAboutMistakes = /mistake|error log|wrong answer|වැරදි|වරද|quiz me on my recent/i.test(prompt);
    if (asksAboutMistakes && Array.isArray(modifiedUserContext.recentMistakes)) {
      const recentMistakes = modifiedUserContext.recentMistakes.slice(0, 8);
      contentsParts[0].text += `\n\nRecent Mistake Notebook records (real saved data):\n${JSON.stringify(recentMistakes.map((mistake: any) => ({
        subject: mistake.subject,
        lesson: mistake.lesson,
        errorText: mistake.errorText || mistake.questionText,
        createdAt: mistake.createdAt,
        hasImage: Boolean(mistake.imageStoragePath),
      })))}\nUse these records for diagnosis, revision, or a grounded quiz. If a saved image is attached below, inspect that actual image. Do not ask the user to upload it again. Never replace unreadable or missing details with generic likely mistakes; say exactly what cannot be read.`;
      const bucket = getAdminBucket();
      const bucketName = bucket.name;
      for (const mistake of recentMistakes.slice(0, 3)) {
        if (!mistake.imageStoragePath || !mistake.imageMimeType) continue;
        contentsParts.push({
          fileData: {
            fileUri: `gs://${bucketName}/${mistake.imageStoragePath}`,
            mimeType: mistake.imageMimeType,
          },
        });
        contentsParts.push({ text: `Mistake Notebook image for ${mistake.subject || "subject"} / ${mistake.lesson || "lesson"}. Analyze only when relevant.` });
        try {
          const [imageUrl] = await bucket.file(mistake.imageStoragePath).getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
          const source = {
            id: mistake.id,
            sourceId: mistake.id,
            title: mistake.imageFileName || `${mistake.subject || "Subject"} - ${mistake.lesson || "lesson"}`,
            url: imageUrl,
            sourceType: "mistake_image",
            badge: "Saved error image",
            mimeType: mistake.imageMimeType,
            lesson: mistake.lesson,
          };
          mistakeImageSources.push(source);
          allSources.push(source);
        } catch (error) {
          console.warn("[MistakeNotebook] Could not sign saved image", { mistakeId: mistake.id, error: String(error) });
        }
        aiTask = "image_understanding";
      }
      if (mistakeImageSources.length > 0) emitSse(res, "sources", { sources: allSources });
    }

    if (image && image.data && image.mimeType) {
      contentsParts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
      contentsParts.push({
        text: `\n\n[Vision Triggered] OCR/Diagram Analysis requested. Image mimeType is ${image.mimeType}. Scan the image details carefully and run custom vision-based prompt contexts (such as OCR, formula extraction, or diagram understanding) to give precise, contextual, step-by-step guidance.`
      });
    }

    if (attachments && attachments.length > 0) {
      const bucketName = getAdminBucket().name;
      for (const att of attachments) {
        if (att.storagePath && att.mimeType) {
           contentsParts.push({
             fileData: {
               fileUri: `gs://${bucketName}/${att.storagePath}`,
               mimeType: att.mimeType
             }
           });
           contentsParts.push({
             text: `\n\n[Attachment: ${att.fileName || 'unknown file'}] Please analyze the attached file.`
           });
        }
      }
      aiTask = "image_understanding"; // Use multimodal model
    }

    let stream: any = null;
    let modelUsed = "";

    try {
      const result = await generateContentStreamWithFallback(
        aiTask,
        {
          model: "ignored", // will be overridden by router
          contents: [{ role: "user", parts: contentsParts }],
          config: {
            systemInstruction: finalSysInstruction,
            temperature: getTemperature(route.mode),
            maxOutputTokens: getMaxTokens(route.mode)
          }
        },
        ai,
        signal
      );
      stream = result.stream;
      modelUsed = result.modelUsed;
      if (result.warning) {
         emitSse(res, "token", { text: `\n\n⚠️ *${result.warning}*\n\n` });
      }
    } catch (err: any) {
      throw new Error(`All model streaming options failed. ${err.message}`);
    }

    let isInterrupted = false;
    let fullText = "";
    let chunkBuffer = "";
    try {
      for await (const chunk of stream) {
        const text = chunk.text || "";
        if (text) {
          fullText += text;
          chunkBuffer += text;
          trace.totalChars += text.length;
          trace.tokenCount++;

          if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
            emitSse(res, "token", { text: chunkBuffer });
            trace.lastEvent = "token";
            chunkBuffer = "";
          }
        }
      }
      if (chunkBuffer.length > 0) {
        emitSse(res, "token", { text: chunkBuffer });
      }
      if (!isInterrupted && mistakeImageSources.length > 0) {
        const gallery = `\n\n### Saved error image${mistakeImageSources.length === 1 ? "" : "s"}\n\n${mistakeImageSources.map((source: any) => {
          const alt = String(source.title || "Saved mistake image").replace(/[\[\]]/g, "");
          return `![${alt}](${source.url})`;
        }).join("\n\n")}`;
        fullText += gallery;
        emitSse(res, "token", { text: gallery });
      }
    } catch (e: any) {
      console.warn("Stream interrupted:", e);
      isInterrupted = true;
      emitSse(res, "error", { ok: false, error: "Stream interrupted", recoverable: true, code: "STREAM_INTERRUPTED", completed: false, incomplete: true });
    }

    // Track AI Usage Costs
    try {
      const { trackAIUsage } = await import("../cost/usageTracker");
      const inputTokens = Math.round((contextBlocksText.length + prompt.length + sysInstruction.length) / 3.8) + 100;
      const outputTokens = Math.round(fullText.length / 3.5);
      await trackAIUsage(user.uid, modelUsed || "gemini-2.0-flash", inputTokens, outputTokens, "normalMessages");
    } catch (trackErr) {
      console.warn("[usageTracker] Error tracking usage:", trackErr);
    }

    emitSse(res, "status", { step: "assistant", status: "Saving chat" });

    let chatRes: any = { chatSaved: false };
    try {
    try {
      await updateConversationState(user.uid, {
        activeSourceIds: allSources.map((s: any) => s.id || s.sourceId).filter(Boolean),
        selectedSourceId: route.entities?.activeSourceId || null,
        selectedQuestionId: route.entities?.questionNo || null
      });
    } catch (e) { /* ignore */ }
      chatRes = await safeCall("saveFinalChat", () => saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: fullText,
        mode: route.mode,
        subject: activeSubject,
        sources: allSources
      }), { chatSaved: false }, res);
      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
    } catch (err: any) {
      console.warn("CHAT_SAVE_SKIPPED", err);
    }

    // Background extraction
    if (process.env.ENABLE_MEMORY_EXTRACTION === "true") {
      safeCall("extractStableMemoryIfUseful", () => extractStableMemoryIfUseful({ uid: user.uid, email: user.email, prompt, answer: fullText, userContext: modifiedUserContext }), null, res).catch(() => null);
    }

    // Generate suggestions
    if (!isInterrupted && fullText.length > 0) {
      try {
        let finalSuggestions: string[] = [];

        function getDeterministicSuggestions(mode: string): string[] {
          if (mode === "paper_question_qa") {
            return [
              "මේක PDF එකෙන් ආයෙත් verify කරන්න",
              "මේ ප්‍රශ්නයේ marking points දෙන්න",
              "මේ වගේ තව MCQ 5ක් දෙන්න"
            ];
          }

          if (mode === "tutor_explanation" || mode === "normal_chat") {
            return [
              "මේක සරලව නැවත පැහැදිලි කරන්න",
              "මේ lesson එකෙන් MCQ 5ක් දෙන්න",
              "මගේ වැරදි points ටික කියන්න"
            ];
          }

          return [
            "තව කෙටියෙන් කියන්න",
            "exam answer එකක් ලෙස ලියන්න",
            "මතක තබාගන්න tips දෙන්න"
          ];
        }

        if (process.env.ENABLE_AI_SUGGESTIONS === "true") {
          const suggPrompt = `Based on the user's message: "${prompt}" and the assistant's answer: "${fullText.substring(0, 1000)}...", generate 3 short, contextual follow-up suggestions in Sinhala.
Important: Output ONLY a valid JSON array of 3 strings.
Example suggestions for Clora X:
- "මේ ප්‍රශ්නය PDF එකෙන් ආයෙත් පරීක්ෂා කරන්න" (Recheck from PDF)
- "මේ අවුරුද්දේ marking scheme එක දෙන්න" (Get marking scheme)
- "මේ lesson එකෙන් තව mcq ප්‍රශ්න දෙන්න" (More MCQs from this lesson)
- "මේක වැරදියි, නැවත පරීක්ෂා කරන්න" (This is wrong, recheck)
Do not include any other text or markdown formatting.`;

          try {
            const { result: sugResult } = await callGeminiWithFallback("fast_background", {
                model: "ignored",
                contents: suggPrompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 200,
                    responseMimeType: "application/json"
                }
            }, getAIClient());

            const sugText = sugResult.text || "";
            let cleaned = sugText.replace(/```json/gi, "").replace(/```/g, "").trim();

            let parsed = null;
            try {
              parsed = JSON.parse(cleaned);
            } catch (e) {
              const start = cleaned.indexOf("[");
              const end = cleaned.lastIndexOf("]");
              if (start >= 0 && end > start) {
                try {
                  parsed = JSON.parse(cleaned.slice(start, end + 1));
                } catch (e) {}
              }
            }

            if (Array.isArray(parsed) && parsed.length > 0) {
              finalSuggestions = parsed.filter(x => typeof x === "string").slice(0, 3);
            }
          } catch (e) {
             console.warn("Failed to generate AI suggestions, falling back to deterministic", e);
          }
        }

        if (finalSuggestions.length === 0) {
           finalSuggestions = getDeterministicSuggestions(route.mode);
        }

        emitSse(res, "suggestions", { suggestions: finalSuggestions });

      } catch (err) {
        console.warn("Failed to generate suggestions", err);
      }
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    let summaryItems: string[] = [];

    if (route.mode === "normal_chat") {
       summaryItems.push(`Thought for ${elapsedSeconds}s`);
    } else if (paperIntent.isOfficialPaperCandidate) {
       summaryItems.push(`✓ Official paper request detected`);
       summaryItems.push(`✓ Subject/year/question parsed (${paperIntent.subject || ''} ${paperIntent.year || ''} Q${paperIntent.questionNo || ''})`);
       summaryItems.push(`✓ Past Papers DB checked`);
       if (hasExactQuestionText) {
          summaryItems.push(`✓ Source lock checked`);
          summaryItems.push(`✓ Evidence checked`);
       } else {
          summaryItems.push(`✓ Source checked`);
          summaryItems.push(`⚠ Exact question evidence missing`);
       }
    } else {
       summaryItems.push(`Thought for ${elapsedSeconds}s`);
       if (allSources && allSources.length > 0) summaryItems.push(`✓ Context sources checked`);
    }

    emitSse(res, "safe_summary", { items: summaryItems });
    trace.completed = !isInterrupted;
    emitSse(res, "done", { ok: !isInterrupted, completed: !isInterrupted, incomplete: isInterrupted, requestId, messageId: chatRes?.messageId || null, chatSaved: trace.chatSaved, sources: allSources || [], finishReason: isInterrupted ? "interrupted" : "complete" });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } catch (error: any) {
    console.error("Stream Error", error);
    trace.errorCode = error.code || "UNKNOWN_ERROR";
    trace.errorMessage = error.message || String(error);

    // Check if error is AI_BILLING_EXHAUSTED (from checkAiBillingCircuit or classifyAiError)
    const classified = error.code === "AI_BILLING_EXHAUSTED" ? error : classifyAiError(error);

    if (classified.code === "AI_BILLING_EXHAUSTED") {
      emitSse(res, "error", {
        code: "AI_BILLING_EXHAUSTED",
        message: "AI credits අවසන් වෙලා තියෙනවා. Billing update කළාම නැවත AI answer දෙන්නම්.",
        canRetry: false,
        localOnlyAvailable: true
      });
      emitSse(res, "suggestions", {
        suggestions: [
          "Firebase PDFs list කරන්න",
          "Indexed PDF chunks බලන්න",
          "Billing fix කළාට පස්සේ answer continue කරන්න"
        ]
      });
      emitSse(res, "done", {
        completed: false,
        reason: "AI_BILLING_EXHAUSTED",
        canContinue: false
      });
    } else {
      emitSse(res, "error", { ok: false, error: classified.userMessage || classified.errorMessage || String(error), code: classified.code, recoverable: true });
      if (!res.headersSent) {
         emitSse(res, "token", { text: "\n\n⚠️ සමාවන්න, පද්ධතියේ දෝෂයක් ඇති විය." });
      }
      emitSse(res, "done", { ok: false, completed: false, requestId, chatSaved: false, finishReason: "error_recovered" });
    }

    trace.doneSent = true;
    trace.lastEvent = "done";
  } finally {
    clearInterval(heartbeatInterval);
    unregisterRequest(requestId);
    unregisterRequest(requestId);
    if (!trace.doneSent) {
      try {
        emitSse(res, "done", {
          ok: trace.completed,
          completed: trace.completed,
          requestId,
          chatSaved: trace.chatSaved,
          reason: trace.completed ? "STREAM_FINISHED" : "STREAM_FINISHED_WITH_RECOVERABLE_ERROR"
        });
        trace.doneSent = true;
        trace.lastEvent = "done";
      } catch (e) {
        console.error("Failed to send done in finally", e);
      }
    }
    trace.endedAt = new Date().toISOString();
    res.end();
  }
}

export async function aiContinueStream(req: any, res: any) {
  const startedAt = Date.now();
  const requestId = req.body?.clientRequestId || "req_cont_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  const trace: StreamTrace = {
    requestId,
    startedAt: new Date().toISOString(),
    completed: false,
    doneSent: false,
    clientClosed: false,
    tokenCount: 0,
    totalChars: 0,
    chatSaved: false
  };
  addStreamTrace(trace);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const abortController = registerRequest(requestId);
  const signal = abortController.signal;
  const heartbeatInterval = setInterval(() => {
    try {
      emitSse(res, "heartbeat", { ok: true, requestId, ts: Date.now() });
      trace.lastEvent = "heartbeat";
    } catch (e) {
      // ignore
    }
  }, 10000);

  req.on("close", () => {
    cancelRequest(requestId);
    console.log(`[STREAM] STREAM_CLIENT_CLOSED requestId=${requestId}`);
    trace.clientClosed = true;
    trace.endedAt = new Date().toISOString();
  });

  try {
    const { originalPrompt, previousAssistantText, sources = [], chatId, reason } = req.body;
    const user = req.user;

    // Check Daily Safety Limit Guardrails for Continuation (REMOVED)
    const { trackAIUsage } = await import("../cost/usageTracker");

    emitSse(res, "status", { step: "started", message: "Continuing answer..." });

    const trimmedPrevText = (previousAssistantText || "").slice(-1500);

    const promptText = `
User original prompt: "${originalPrompt}"
The previous answer stopped halfway due to: "${reason || "unknown"}"
Here is the last part of the previous answer:
"...${trimmedPrevText}"

Instruction:
Continue the previous Sinhala answer from exactly where it stopped. Do not repeat completed sections. Finish the remaining explanation.
Keep the same tone and language (Sinhala-first style).
`;

    const ai = getAIClient();
    let stream: any = null;
    let modelUsed = "";

    try {
      const result = await generateContentStreamWithFallback("final_answer", {
        model: "ignored", // will be overridden by router
        contents: promptText,
        config: {
          maxOutputTokens: 2000
        },
      }, ai, signal);

      stream = result.stream;
      modelUsed = result.modelUsed;
      if (result.warning) {
        emitSse(res, "token", { text: `\n\n⚠️ *${result.warning}*\n\n` });
      }
    } catch (err: any) {
      throw new Error(`Continue stream failed: ${err.message}`);
    }

    let fullText = "";
    let chunkBuffer = "";
    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) {
        fullText += text;
        chunkBuffer += text;
        trace.totalChars += text.length;
        trace.tokenCount++;
        if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
          emitSse(res, "token", { text: chunkBuffer });
          trace.lastEvent = "token";
          chunkBuffer = "";
        }
      }
    }
    if (chunkBuffer.length > 0) {
      emitSse(res, "token", { text: chunkBuffer });
    }

    trace.completed = true;

    // Track AI Usage Costs for Continuation
    try {
      const { trackAIUsage } = await import("../cost/usageTracker");
      const inputTokens = Math.round(promptText.length / 3.8) + 100;
      const outputTokens = Math.round(fullText.length / 3.5);
      await trackAIUsage(user.uid, modelUsed || "gemini-3.1-pro-preview", inputTokens, outputTokens, "proCalls");
    } catch (trackErr) {
      console.warn("[usageTracker] Error tracking continuation usage:", trackErr);
    }

    if (chatId) {
      await safeCall("saveContinuationChat", async () => {
        const db = getAdminDb();
        const chatRef = db.collection("users").doc(user.uid).collection("chat_history").doc(chatId);
        const docSnap = await chatRef.get();
        if (docSnap.exists) {
          const prevData = docSnap.data();
          const updatedAnswer = (prevData?.assistantAnswer || "") + "\n" + fullText;
          await chatRef.update({
            assistantAnswer: updatedAnswer,
            updatedAt: new Date().toISOString()
          });
          trace.chatSaved = true;
        }
      }, null, res);
    }

    emitSse(res, "done", {
      ok: true,
      completed: true,
      requestId,
      chatSaved: trace.chatSaved
    });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } catch (err: any) {
    console.error("Continue Stream Error", err);
    trace.errorCode = err.code || "CONTINUE_FAILED";
    trace.errorMessage = err.message || String(err);
    emitSse(res, "error", { ok: false, error: err.message, recoverable: true, code: "CONTINUE_FAILED" });
    emitSse(res, "done", { ok: false, completed: false, requestId, chatSaved: false });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } finally {
    clearInterval(heartbeatInterval);
    unregisterRequest(requestId);
    unregisterRequest(requestId);
    if (!trace.doneSent) {
      try {
        emitSse(res, "done", {
          ok: trace.completed,
          completed: trace.completed,
          requestId,
          chatSaved: trace.chatSaved
        });
        trace.doneSent = true;
        trace.lastEvent = "done";
      } catch (e) {
        // ignore
      }
    }
    trace.endedAt = new Date().toISOString();
    res.end();
  }
}
