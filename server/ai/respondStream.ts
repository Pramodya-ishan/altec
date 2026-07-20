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
import { getConversationState, resetConversationState, updateConversationState } from "../knowledge/conversationState";
import { retrieveEvidence } from "../knowledge/evidenceRetrieval";
import { generateContentStreamWithFallback, callGeminiWithFallback, AITask } from "./modelRouter";
import { resolveAnswerPolicy } from "./answerPolicy";
import { scoreSource } from "../sources/sourceScoring";
import { isLessonEvidenceMode } from "../knowledge/lessonResolver";
import { createAssistantStreamSanitizer, isSimpleGreeting, sanitizeAssistantText, simpleGreetingReply } from "./responseHygiene";
import { deriveEducationalVisualBlocks } from "./visualAidBuilder";
import { buildImageReferenceText, isImageGenerationIntent } from "./imageIntent";
import { getSubjectSyllabusGroundingPdf } from "../pdf/syllabusGrounding";
import {
  extractQuestionNumberFromPrompt,
  inferQuestionTypeFromText,
  isExplicitNamedSourceRequest,
  isPaperForecastPrompt,
  parseSourceChoiceIndex,
  rankNamedSources,
  resolveLockedQuestionType,
  selectNamedSource,
  shouldUseLockedSourceForTurn,
  toPendingSourceChoice,
} from "./sourceSelection";
import { resolveFastConversation } from "./fastConversation";
import { isMistakeReviewIntent, selectMistakeRecordForPrompt } from "../firebase/mistakeStore";
import { detectSinhalaTextEncoding, normalizeSinhalaExtractedText } from "../pdf/legacySinhala";
import {
  assessAnswerCompleteness,
  buildContinuationInstruction,
  getModelFinishReason,
  mergeContinuationText,
} from "./answerCompleteness";
import {
  AnswerQualityReport,
  buildAnswerContractInstruction,
  createQualityRepairedAnswer,
  reviewAnswerQuality,
} from "./answerQuality";
import { recordAiTelemetry } from "../observability/aiTelemetry";
import { createAnswerPlan, plannerContext } from "./answerPlanner";
import { buildFollowUpSuggestionPrompt, parseFollowUpSuggestions, withSuggestionTimeout } from "./followUpSuggestions";
import { secureEvidenceText, sourceSecurityInstruction } from "./sourceContentSecurity";
import {
  attachEvidenceContractToSources,
  buildEvidenceContract,
  classifyAnswerEvidenceStatus,
  detectEvidenceContradictions,
  evidenceContractInstruction,
} from "./evidenceContract";

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
  modelFinishReason?: string;
  completionPasses?: number;
  incompleteReasons?: string[];
  qualityPassed?: boolean;
  qualityConfidence?: number;
  qualityCoveragePercent?: number;
  qualityRepaired?: boolean;
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

async function safeCall<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  res: any,
  options: { critical?: boolean; publicMessage?: string } = {},
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[STREAM_DEPENDENCY_FAILED] name=${name}`, error);
    if (options.critical) {
      const failure = new Error(options.publicMessage || "Required document evidence could not be loaded.");
      (failure as Error & { code?: string; isPublic?: boolean }).code = "EVIDENCE_DEPENDENCY_FAILED";
      (failure as Error & { code?: string; isPublic?: boolean }).isPublic = true;
      throw failure;
    }
    emitSse(res, "status", { step: "warning", message: "Some optional context was unavailable." });
    return fallback;
  }
}

function getTemperature(mode: string) {
  switch (mode) {
    case 'paper_question_qa':
    case 'uploaded_pdf_question_qa':
    case 'uploaded_pdf_qa':
    case 'rag_qa':
    case 'marking_scheme_request': return 0.1;
    case 'today_plan': return 0.25;
    case 'study_plan': return 0.25;
    case 'tutor_explanation': return 0.2;
    case 'notes_generation': return 0.2;
    case 'quiz_generation': return 0.25;
    case 'past_paper_search': return 0.1;
    default: return 0.25;
  }
}

export function getMaxTokens(mode: string) {
  if (mode === "uploaded_pdf_question_qa" || mode === "uploaded_pdf_qa" || mode === "rag_qa" || mode === "paper_question_qa") {
    return 16_384;
  }
  if (["notes_generation", "study_plan", "quiz_generation", "tutor_explanation", "marking_scheme_request"].includes(mode)) {
    return 12_288;
  }
  // The old 2,000-token default silently cut otherwise valid explanations.
  // A generous default is intentional: the model may still answer concisely,
  // but it is no longer forced to stop before every requested item is covered.
  return 8_192;
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

export async function saveFinalChat(params: {uid: string, email?: string, userText: string, assistantText: string, mode: string, subject?: string, sources?: any[], completion?: { completed: boolean; finishReason?: string | null; completionPasses?: number; missingSubparts?: string[]; reasons?: string[] }, quality?: AnswerQualityReport | null}): Promise<SaveChatResult> {
  // Always strip visual blocks before saving to history
  params.assistantText = sanitizeAssistantText(stripRawVisualBlocks(params.assistantText));

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
      chatSaved: true,
      answerCompleted: params.completion?.completed ?? true,
      modelFinishReason: params.completion?.finishReason || null,
      completionPasses: params.completion?.completionPasses || 0,
      missingSubparts: params.completion?.missingSubparts || [],
      incompleteReasons: params.completion?.reasons || [],
      answerQuality: params.quality || null,
    });

    const historyRef = db.collection("users").doc(params.uid).collection("chat_history").doc(requestId);
    batch.set(historyRef, chatData);


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
  const markClientClosed = () => {
    if (res.writableEnded || trace.doneSent) return;
    cancelRequest(requestId);
    console.log(`[STREAM] STREAM_CLIENT_CLOSED requestId=${requestId}`);
    trace.clientClosed = true;
    trace.endedAt = new Date().toISOString();
  };
  req.on("aborted", markClientClosed);
  res.on("close", markClientClosed);

  try {
    const { prompt: submittedPrompt, activeSubject, mode: requestedMode = "auto", history = [], image, attachments, chatId } = req.body;
    const user = req.user;
    const originalPrompt = String(submittedPrompt || "");
    let prompt = originalPrompt;
    const promptEncoding = detectSinhalaTextEncoding(originalPrompt);
    if (promptEncoding.encoding === "legacy_fm_abhaya" || promptEncoding.encoding === "legacy_unknown") {
      const convertedPrompt = normalizeSinhalaExtractedText(originalPrompt);
      if (convertedPrompt.normalizedText) {
        prompt = convertedPrompt.normalizedText;
        emitSse(res, "status", { step: "legacy_sinhala", status: "converted", message: "Converted legacy Sinhala text to Unicode." });
      } else {
        prompt = `[UNREADABLE LEGACY SINHALA TEXT]
The following pasted legacy-font text could not be converted reliably. Do not infer, reconstruct, or answer missing words from general memory. Ask for the original PDF/page image or use the selected saved PDF with document vision.

${originalPrompt}`;
        emitSse(res, "status", { step: "legacy_sinhala", status: "ocr_required", message: "Legacy Sinhala needs the original PDF or page image." });
      }
    }

    let allSources: any[] = [];

    if (isSimpleGreeting(prompt) && !image && (!attachments || attachments.length === 0)) {
      const answer = simpleGreetingReply(prompt);
      emitSse(res, "token", { text: answer });
      const chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: "normal_chat",
        subject: activeSubject,
        sources: [],
      });
      trace.chatSaved = chatRes.chatSaved;
      trace.messageId = chatRes.messageId;
      trace.completed = true;
      emitSse(res, "done", {
        ok: true,
        completed: true,
        requestId,
        messageId: chatRes.messageId || null,
        chatSaved: chatRes.chatSaved,
        sources: [],
        finishReason: "simple_greeting",
      });
      trace.doneSent = true;
      return;
    }

    const fastConversation = !image && (!attachments || attachments.length === 0)
      ? resolveFastConversation(prompt)
      : null;
    if (fastConversation) {
      emitSse(res, "token", { text: fastConversation.answer });
      const chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: fastConversation.answer,
        mode: "normal_chat",
        subject: activeSubject,
        sources: [],
      });
      trace.chatSaved = chatRes.chatSaved;
      trace.messageId = chatRes.messageId;
      trace.completed = true;
      emitSse(res, "done", {
        ok: true,
        completed: true,
        requestId,
        messageId: chatRes.messageId || null,
        chatSaved: chatRes.chatSaved,
        sources: [],
        suggestions: [],
        fastPath: true,
        answerStatus: "general",
        sourceMode: "general_ai",
        finishReason: `fast_conversation_${fastConversation.intent}`,
      });
      trace.doneSent = true;
      return;
    }

    if (isImageGenerationIntent(prompt, Boolean(image))) {
      emitSse(res, "status", {
        step: "image_generation",
        status: "working",
        message: "Creating the educational image…",
      });

      const { generateEducationalImage } = await import("../image/generate");
      const imageResult = await generateEducationalImage({
        user,
        body: {
          prompt,
          subject: activeSubject,
          referenceText: buildImageReferenceText(history),
          aspectRatio: "4:3",
        },
      });

      if (!imageResult.ok || !imageResult.imageUrl) {
        const message = "රූපය නිර්මාණය කිරීමට මේ මොහොතේ නොහැකි වුණා. ටික වේලාවකින් නැවත උත්සාහ කරන්න.";
        emitSse(res, "token", { text: message });
        emitSse(res, "done", {
          ok: false,
          completed: true,
          requestId,
          finishReason: imageResult.code || "image_generation_failed",
        });
        trace.completed = true;
        trace.doneSent = true;
        return;
      }

      const answer = `මෙන්න ඉල්ලූ රූපය.\n\n![Generated educational image](${imageResult.imageUrl})`;
      emitSse(res, "token", { text: answer });
      const chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: "image_generation",
        subject: activeSubject,
        sources: [],
      });
      trace.chatSaved = chatRes.chatSaved;
      trace.messageId = chatRes.messageId;
      trace.completed = true;
      emitSse(res, "done", {
        ok: true,
        completed: true,
        requestId,
        messageId: chatRes.messageId || null,
        chatSaved: chatRes.chatSaved,
        image: {
          imageUrl: imageResult.imageUrl,
          storagePath: imageResult.storagePath,
          model: imageResult.model,
        },
        finishReason: "image_generation_complete",
      });
      trace.doneSent = true;
      return;
    }

    emitSse(res, "status", { step: "understanding", message: "Understanding your question" });
    emitSse(res, "status", { step: "context", message: "Checking your progress, papers, and lesson resources" });

    // 1. Route Request
    const { detectOfficialPaperCandidate } = await import("../ai-core/intent/paperQuestionParser");
    const paperIntent = detectOfficialPaperCandidate(prompt, activeSubject);
    const paperForecastPrompt = isPaperForecastPrompt(prompt);
    let activeConversationState = await getConversationState(user.uid);
    if (chatId && String(activeConversationState.conversationId || "") !== String(chatId)) {
      activeConversationState = await resetConversationState(user.uid, String(chatId));
    }
    const attachedPdf = Array.isArray(attachments)
      ? attachments.find((attachment: any) => attachment?.sourceId && String(attachment?.mimeType || "").toLowerCase().includes("pdf"))
      : null;
    if (attachedPdf?.sourceId) {
      activeConversationState = await updateConversationState(user.uid, {
        conversationId: String(chatId || activeConversationState.conversationId),
        selectedSourceId: String(attachedPdf.sourceId),
        selectedSourceTitle: String(attachedPdf.fileName || "Uploaded PDF"),
        selectedSourceSubject: activeSubject || activeConversationState.activeSubject || null,
        activeSourceIds: [String(attachedPdf.sourceId)],
        evidenceMode: "strict",
        allowGeneratedContent: false,
        awaitingSourceSelection: false,
        pendingSourceChoices: [],
        lastIntent: "uploaded_pdf_qa",
      });
    }

    // Check if it's an official paper candidate but subject is missing
    if (paperIntent.isOfficialPaperCandidate && !paperForecastPrompt && paperIntent.needsSubjectClarification) {
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

    const normalizedInitialPrompt = String(prompt || "").normalize("NFKC").trim().toLowerCase();
    const explicitLockedQuestionNo = extractQuestionNumberFromPrompt(normalizedInitialPrompt);
    const bareLockedQuestionNo = activeConversationState.lastIntent !== "lesson_pdf_search"
      ? normalizedInitialPrompt.match(/^(\d{1,3})[?.!]*$/u)?.[1] || null
      : null;
    const lockedQuestionNo = explicitLockedQuestionNo || bareLockedQuestionNo;
    const canUseLockedQuestionFastRoute = Boolean(
      activeConversationState.selectedSourceId
      && lockedQuestionNo
      && !activeConversationState.awaitingMistakeSelection
      && !activeConversationState.awaitingSourceSelection
      && !isExplicitNamedSourceRequest(prompt)
      && !paperIntent.isOfficialPaperCandidate,
    );

    const route: any = canUseLockedQuestionFastRoute
      ? {
          mode: "paper_question_qa",
          answerHints: { mustUseRag: true, mustUseGoogleSearch: false, mustUseUrlContext: false, mustAskClarification: false },
          entities: {
            activeSourceId: activeConversationState.selectedSourceId,
            subject: activeConversationState.selectedSourceSubject || activeConversationState.activeSubject || activeSubject || "SFT",
            year: activeConversationState.selectedSourceYear || undefined,
            questionNo: lockedQuestionNo,
            questionType: resolveLockedQuestionType({
              prompt: normalizedInitialPrompt,
              selectedQuestionType: activeConversationState.selectedQuestionType,
              selectedSourceTitle: activeConversationState.selectedSourceTitle,
            }),
          },
        }
      : await safeCall("routeKnowledgeRequest", () => routeKnowledgeRequest({
          prompt,
          uid: user.uid,
          email: user.email,
          activeSubject: paperIntent.subject || activeSubject,
          conversationHistory: history,
        }), {
          mode: paperForecastPrompt ? "past_paper_analysis" : (paperIntent.isOfficialPaperCandidate ? "paper_question_qa" : "normal_chat"),
          answerHints: { mustUseRag: true, mustUseGoogleSearch: false, mustUseUrlContext: false, mustAskClarification: false },
          entities: {
            year: paperIntent.year,
            subject: paperIntent.subject,
            questionNo: paperIntent.questionNo,
            questionType: paperIntent.questionType
          }
        } as any, res);

    // [FIX 1] Force paper intent over LLM router if it looks like a paper question
    if (paperIntent.isOfficialPaperCandidate && !paperForecastPrompt) {
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
    if (paperIntent.isOfficialPaperCandidate && !paperForecastPrompt && route.mode === "normal_chat") {
      console.log(`[OFFICIAL_PAPER_GATE] Converted normal_chat -> paper_question_qa`);
      route.mode = "paper_question_qa";
    }

    const normalizedFollowUp = String(prompt || "").trim().toLowerCase();
    let selectedMistakeRecord: any = null;

    // A numeric reply after the Error Log list selects that record before any
    // active PDF can reinterpret the same number as Q1/Q2. This is the exact
    // ambiguity that previously sent record “2” into scanned-PDF QA.
    const pendingMistakeIds = Array.isArray(activeConversationState.pendingMistakeChoices)
      ? activeConversationState.pendingMistakeChoices
      : [];
    const mistakeChoiceMatch = activeConversationState.awaitingMistakeSelection
      ? String(prompt || "").trim().match(/^(\d{1,3})[.)]?[?.!]*$/u)
      : null;
    if (mistakeChoiceMatch) {
      const mistakeChoiceIndex = Number(mistakeChoiceMatch[1]) - 1;
      const selectedMistakeKey = pendingMistakeIds[mistakeChoiceIndex];
      if (selectedMistakeKey) {
        const { loadMistakeRecords } = await import("../firebase/mistakeStore");
        const records = await loadMistakeRecords(user.uid, user.email, 100);
        const keyMatch = String(selectedMistakeKey).match(/^(uid|legacy_email):(.*)$/u);
        const selectedOwner = keyMatch?.[1] || "";
        const selectedMistakeId = keyMatch?.[2] || selectedMistakeKey;
        selectedMistakeRecord = records.find((record: any) => String(record.id) === String(selectedMistakeId)
          && (!selectedOwner || String(record.ownerPath || "uid") === selectedOwner)) || null;
      }
      if (selectedMistakeRecord) {
        const selectedSubject = String(selectedMistakeRecord.subject || activeSubject || "SFT").toUpperCase();
        const selectedLesson = String(selectedMistakeRecord.lesson || "පාඩම සඳහන් කර නැහැ");
        const selectedDetail = String(selectedMistakeRecord.errorText || selectedMistakeRecord.questionText || "Image-only saved mistake");
        prompt = `මගේ Error Log එකේ තෝරාගත් record එක විශ්ලේෂණය කරන්න. Subject: ${selectedSubject}. Lesson: ${selectedLesson}. Saved note: ${selectedDetail}. Saved image එක තිබේ නම් එය කියවා, ප්‍රශ්නය, මට වැරදෙන්න ඇති හේතුව, නිවැරදි පියවර, අවසාන පිළිතුර සහ සමාන පුහුණු ප්‍රශ්නයක් දෙන්න.`;
        route.mode = "tutor_explanation";
        route.entities = { ...(route.entities || {}), subject: selectedSubject as any, activeSourceId: undefined };
        route.answerHints = { ...(route.answerHints || {}), mustUseRag: false, mustUseGoogleSearch: false, mustAskClarification: false };
        await updateConversationState(user.uid, {
          pendingMistakeChoices: [],
          awaitingMistakeSelection: false,
          activeMistakeId: selectedMistakeRecord.id,
          lastIntent: "mistake_record_review",
        });
      }
    }

    // Numeric replies immediately after a PDF list select that exact displayed
    // source. They are not interpreted as a question number until selection is
    // complete, which removes the ambiguous "1"/"2" behaviour.
    const pendingChoices = Array.isArray(activeConversationState.pendingSourceChoices)
      ? activeConversationState.pendingSourceChoices
      : [];
    const pendingChoiceIndex = activeConversationState.awaitingSourceSelection
      ? parseSourceChoiceIndex(prompt, pendingChoices.length)
      : null;
    if (pendingChoiceIndex !== null) {
      const choice = pendingChoices[pendingChoiceIndex];
      const answer = sanitizeAssistantText(`**${choice.title}** තෝරාගත්තා. දැන් එම PDF එකේ අවශ්‍ය ප්‍රශ්න අංකය ලියන්න. උදාහරණ: **q1**, **MCQ 7**, හෝ **essay 1**.`);
      await updateConversationState(user.uid, {
        selectedSourceId: choice.sourceId,
        selectedSourceTitle: choice.title,
        selectedSourceSubject: choice.subject || activeConversationState.activeSubject || null,
        selectedSourceYear: choice.year || null,
        selectedQuestionType: choice.questionTypeHint || null,
        activeSubject: choice.subject || activeConversationState.activeSubject,
        activeSourceIds: [choice.sourceId],
        pendingSourceChoices: [],
        awaitingSourceSelection: false,
        lastIntent: "selected_resource_discussion",
      });
      emitSse(res, "token", { text: answer });
      const chatRes = await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: answer, mode: "selected_resource_discussion", subject: choice.subject || activeSubject, sources: [] });
      trace.completed = true;
      trace.chatSaved = chatRes.chatSaved;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes.messageId || null, chatSaved: chatRes.chatSaved, sources: [], finishReason: "source_selected" });
      trace.doneSent = true;
      return;
    }

    // Resolve named model/guessing/syllabus resources directly. A request such
    // as "guessing 1 essay q1" must lock Guessing 01 Essay before any model is
    // allowed to answer.
    const hasNamedPdfDescriptor = isExplicitNamedSourceRequest(prompt);
    if (hasNamedPdfDescriptor) {
      const { getSourceInventory } = await import("../sources/sourceInventoryService");
      const explicitSubject = route.entities?.subject || (/\bsft\b|science for technology|තාක්ෂණවේදය සඳහා විද්‍යාව/iu.test(prompt) ? "SFT" : undefined);
      const inventory = await getSourceInventory({
        uid: user.uid,
        subject: explicitSubject || activeConversationState.activeSubject || activeSubject || undefined,
        isAdmin: user.roles?.includes("admin") || user.admin === true,
      });
      const available = Array.isArray(inventory.all) ? inventory.all : [];
      const named = selectNamedSource(available, prompt);
      const requestedNamedQuestion = extractQuestionNumberFromPrompt(prompt);
      if (named.locked && named.source && named.sourceId) {
        const source = named.source;
        const questionType = inferQuestionTypeFromText(prompt) || inferQuestionTypeFromText(`${source.title || ""} ${source.resourceType || ""}`) || activeConversationState.selectedQuestionType || "ESSAY";
        route.entities = route.entities || {};
        route.entities.activeSourceId = named.sourceId;
        route.entities.subject = source.subject || explicitSubject || activeConversationState.activeSubject || "SFT";
        route.entities.year = source.year ? String(source.year) : route.entities.year;
        route.entities.questionType = questionType;
        if (requestedNamedQuestion) route.entities.questionNo = requestedNamedQuestion;
        route.mode = requestedNamedQuestion ? "paper_question_qa" : "selected_resource_discussion";
        route.answerHints = { ...(route.answerHints || {}), mustUseRag: true, mustAskClarification: false };
        await updateConversationState(user.uid, {
          selectedSourceId: named.sourceId,
          selectedSourceTitle: source.title || source.fileName || "PDF source",
          selectedSourceSubject: source.subject || route.entities.subject || null,
          selectedSourceYear: source.year ? String(source.year) : null,
          selectedQuestionType: questionType as any,
          activeSubject: source.subject || route.entities.subject || activeConversationState.activeSubject,
          activeSourceIds: [named.sourceId],
          pendingSourceChoices: [],
          awaitingSourceSelection: false,
          currentQuestionIndex: requestedNamedQuestion ? Number(requestedNamedQuestion) : activeConversationState.currentQuestionIndex,
          lastIntent: requestedNamedQuestion ? "paper_question_qa" : "selected_resource_discussion",
        });
        if (!requestedNamedQuestion) {
          const answer = sanitizeAssistantText(`**${source.title || source.fileName || "PDF source"}** තෝරාගත්තා. එම PDF එකේ ප්‍රශ්න අංකය ලියන්න.`);
          emitSse(res, "token", { text: answer });
          const chatRes = await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: answer, mode: "selected_resource_discussion", subject: route.entities.subject, sources: [] });
          trace.completed = true;
          trace.chatSaved = chatRes.chatSaved;
          emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes.messageId || null, chatSaved: chatRes.chatSaved, sources: [], finishReason: "named_source_selected" });
          trace.doneSent = true;
          return;
        }
      } else if (named.ranked.length > 0) {
        const ranked = named.ranked.slice(0, 8).map(({ source }: any) => source);
        const choices = ranked.map(toPendingSourceChoice).filter(Boolean) as any[];
        await updateConversationState(user.uid, { pendingSourceChoices: choices, awaitingSourceSelection: true, lastIntent: "lesson_pdf_search" });
        const answer = sanitizeAssistantText([
          "මේ නමට ගැළපෙන saved PDFs:",
          "",
          ...ranked.map((source: any, index: number) => `${index + 1}. **${source.title || source.fileName || "PDF source"}**`),
          "",
          "අවශ්‍ය PDF එකේ අංකය පමණක් ලියන්න.",
        ].join("\n"));
        emitSse(res, "token", { text: answer });
        const candidateSources = ranked.map((source: any) => ({ ...source, usedInAnswer: false }));
        const chatRes = await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: answer, mode: "lesson_pdf_search", subject: explicitSubject || activeSubject, sources: candidateSources });
        trace.completed = true;
        trace.chatSaved = chatRes.chatSaved;
        emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes.messageId || null, chatSaved: chatRes.chatSaved, sources: candidateSources, finishReason: "source_selection_required" });
        trace.doneSent = true;
        return;
      }
    }

    // A source/mistake chooser is valid for the immediately expected numeric
    // reply only. A substantive new request cancels the stale chooser so a
    // later number cannot unexpectedly reopen an old PDF or Error Log record.
    const staleChoiceReset: Record<string, any> = {};
    if (activeConversationState.awaitingSourceSelection
      && !isExplicitNamedSourceRequest(prompt)
      && !shouldUseLockedSourceForTurn(prompt, route.mode)) {
      staleChoiceReset.pendingSourceChoices = [];
      staleChoiceReset.awaitingSourceSelection = false;
    }
    if (activeConversationState.awaitingMistakeSelection
      && !mistakeChoiceMatch
      && !isMistakeReviewIntent(prompt)) {
      staleChoiceReset.pendingMistakeChoices = [];
      staleChoiceReset.awaitingMistakeSelection = false;
    }
    if (Object.keys(staleChoiceReset).length > 0) {
      await updateConversationState(user.uid, staleChoiceReset);
    }

    const selectedSourceId = activeConversationState.selectedSourceId || activeConversationState.activeSourceIds?.[0] || null;

    // “full paper lesson name + point name” is a document-wide operation, not
    // a request for whichever question happened to be active last. Lock the
    // selected PDF and analyze every question/section in one grounded pass.
    const { isPaperOutlineIntent, analyzeSelectedPaperOutline, formatPaperOutlineMarkdown } = await import("../pdf/paperOutline");
    if (selectedSourceId && isPaperOutlineIntent(prompt)) {
      emitSse(res, "status", { step: "paper_outline", status: "reading", message: "Reading the complete selected paper…" });
      try {
        const { getSourceInventory } = await import("../sources/sourceInventoryService");
        const inventory = await getSourceInventory({
          uid: user.uid,
          subject: activeConversationState.selectedSourceSubject || activeSubject || undefined,
          isAdmin: user.roles?.includes("admin") || user.admin === true,
        });
        const source = (inventory.all || []).find((candidate: any) =>
          String(candidate.id || candidate.sourceId) === String(selectedSourceId),
        );
        if (!source) throw Object.assign(new Error("The selected PDF is no longer available in your source inventory."), { code: "SELECTED_PDF_NOT_FOUND" });

        const outline = await analyzeSelectedPaperOutline({ uid: user.uid, source, prompt });
        const answer = sanitizeAssistantText(formatPaperOutlineMarkdown(outline));
        const outlineSources = [{
          id: source.id || source.sourceId,
          sourceId: source.id || source.sourceId,
          title: source.title || source.fileName || outline.sourceTitle,
          storagePath: source.storagePath || null,
          badge: "Selected PDF",
          usedInAnswer: true,
        }];
        emitSse(res, "sources", { sources: outlineSources });
        emitSse(res, "token", { text: answer });
        const chatRes = await saveFinalChat({
          uid: user.uid,
          email: user.email,
          userText: prompt,
          assistantText: answer,
          mode: "selected_paper_outline",
          subject: activeConversationState.selectedSourceSubject || activeSubject,
          sources: outlineSources,
        });
        await updateConversationState(user.uid, { lastIntent: "selected_paper_outline" });
        trace.completed = true;
        trace.chatSaved = chatRes.chatSaved;
        trace.messageId = chatRes.messageId;
        emitSse(res, "done", {
          ok: true,
          completed: true,
          requestId,
          messageId: chatRes.messageId || null,
          chatSaved: chatRes.chatSaved,
          sources: outlineSources,
          finishReason: "selected_paper_outline_complete",
        });
        trace.doneSent = true;
        return;
      } catch (outlineError: any) {
        const answer = `තෝරාගත් PDF එකේ සම්පූර්ණ lesson/point mapping එක ලබාගැනීමට නොහැකි වුණා. ${String(outlineError?.message || "PDF evidence could not be read.")}`;
        emitSse(res, "token", { text: answer });
        emitSse(res, "done", {
          ok: false,
          completed: true,
          requestId,
          errorCode: outlineError?.code || "PAPER_OUTLINE_FAILED",
          finishReason: "selected_paper_outline_failed",
        });
        trace.completed = true;
        trace.doneSent = true;
        return;
      }
    }

    if (selectedSourceId && /^[?？]+$/.test(String(prompt || "").trim())) {
      const title = activeConversationState.selectedSourceTitle || "තෝරාගත් PDF එක";
      const current = activeConversationState.currentQuestionIndex ? ` දැනට තෝරාගෙන ඇත්තේ ප්‍රශ්නය ${activeConversationState.currentQuestionIndex}.` : "";
      const answer = sanitizeAssistantText(`**${title}** PDF එක තවම තෝරාගෙන තිබෙනවා.${current} අවශ්‍ය ප්‍රශ්න අංකය **q1**, **MCQ 7**, හෝ **essay 1** ලෙස ලියන්න.`);
      emitSse(res, "token", { text: answer });
      const chatRes = await saveFinalChat({ uid: user.uid, email: user.email, userText: prompt, assistantText: answer, mode: "selected_resource_discussion", subject: activeConversationState.selectedSourceSubject || activeSubject, sources: [] });
      trace.completed = true;
      trace.chatSaved = chatRes.chatSaved;
      emitSse(res, "done", { ok: true, completed: true, requestId, messageId: chatRes.messageId || null, chatSaved: chatRes.chatSaved, sources: [], finishReason: "active_source_status" });
      trace.doneSent = true;
      return;
    }
    const explicitQuestionFollowUp = normalizedFollowUp.match(/^(?:q(?:uestion)?|ප්‍රශ්නය|prashna|mcq|essay)\s*[-:#]?\s*(\d{1,3})[?.!]*$/i)
      || normalizedFollowUp.match(/^(\d{1,3})\s*(?:වන|වෙනි|වැනි|st|nd|rd|th)\s*(?:ප්‍රශ්නය|question|mcq|essay)[?.!]*$/i);
    const bareQuestionFollowUp = activeConversationState.lastIntent !== "lesson_pdf_search"
      ? normalizedFollowUp.match(/^(\d{1,3})[?.!]*$/)
      : null;
    const questionFollowUp = explicitQuestionFollowUp || bareQuestionFollowUp;
    const resourceFollowUp = /^(?:ek\s+krmu|eka\s+karamu|එක\s+කරමු|ඒක\s+කරමු|e\s*pdf\s*eke.*|මේ\s*pdf.*)$/i.test(normalizedFollowUp);

    // A short follow-up such as "1", "q1" or "එක කරමු" refers to the
    // source selected in the previous turn. Persisting and resolving this on
    // the server prevents the model from losing the PDF and asking for it
    // again.
    if (selectedSourceId && (questionFollowUp || resourceFollowUp)) {
      route.mode = questionFollowUp ? "paper_question_qa" : "continue_grounded_discussion";
      route.entities = route.entities || {};
      route.entities.activeSourceId = selectedSourceId;
      route.entities.subject = route.entities.subject || activeConversationState.selectedSourceSubject || activeConversationState.activeSubject || activeSubject || "SFT";
      route.entities.year = route.entities.year || activeConversationState.selectedSourceYear || undefined;
      if (questionFollowUp) {
        route.entities.questionNo = questionFollowUp[1];
        route.entities.questionType = resolveLockedQuestionType({
          prompt: normalizedFollowUp,
          selectedQuestionType: activeConversationState.selectedQuestionType,
          selectedSourceTitle: activeConversationState.selectedSourceTitle,
          routedQuestionType: route.entities.questionType,
        });
      }
      route.answerHints = {
        ...(route.answerHints || {}),
        mustUseRag: true,
        mustAskClarification: false,
      };
    }

    const sourceContextApplies = Boolean(selectedSourceId) && shouldUseLockedSourceForTurn(prompt, route.mode);
    if (!sourceContextApplies) {
      route.entities = route.entities || {};
      if (route.entities.activeSourceId === selectedSourceId) route.entities.activeSourceId = undefined;
      // An LLM router can over-weight old conversation history and label a new
      // standalone topic as a continuation. Only explicit source language is
      // allowed to keep that mode while a PDF is locked.
      if (["continue_grounded_discussion", "selected_resource_discussion"].includes(route.mode)) {
        route.mode = paperForecastPrompt ? "past_paper_analysis" : "normal_chat";
        route.answerHints = {
          ...(route.answerHints || {}),
          mustUseRag: paperForecastPrompt,
          mustAskClarification: false,
        };
      }
      if (selectedSourceId) {
        activeConversationState = await updateConversationState(user.uid, {
          activeSourceIds: [],
          selectedSourceId: null,
          selectedSourceTitle: null,
          selectedSourceSubject: null,
          selectedSourceYear: null,
          selectedQuestionType: null,
          selectedQuestionId: null,
          evidenceMode: "none",
          allowGeneratedContent: true,
        });
      }
    }

    const evidenceConversationState = sourceContextApplies
      ? activeConversationState
      : {
          ...activeConversationState,
          activeSourceIds: [],
          selectedSourceId: null,
          selectedSourceTitle: null,
          selectedSourceSubject: null,
          selectedSourceYear: null,
        };
    const policy = resolveAnswerPolicy(prompt, route, activeSubject, attachments);
    const evidence = await retrieveEvidence(user.uid, prompt, route, policy, evidenceConversationState);
    // REMOVED: Early evidence apology block (Finding 026)
    if (evidence.selectedSource) {
       route.entities.activeSourceId = evidence.selectedSource.id || evidence.selectedSource.sourceId;
       route.entities.year = evidence.selectedSource.year || route.entities.year;
    }
    await updateConversationState(user.uid, {
      activeSubject: evidence.subject || activeConversationState.activeSubject,
      activeLessonIds: evidence.lessonIds.length > 0 ? evidence.lessonIds : activeConversationState.activeLessonIds,
      activeSourceIds: evidence.allowedSourceIds.length > 0 ? evidence.allowedSourceIds : (sourceContextApplies ? activeConversationState.activeSourceIds : []),
      selectedSourceId: evidence.selectedSource?.id || evidence.selectedSource?.sourceId || (sourceContextApplies ? activeConversationState.selectedSourceId : null),
      selectedSourceTitle: evidence.selectedSource?.title || evidence.selectedSource?.fileName || (sourceContextApplies ? activeConversationState.selectedSourceTitle : null) || null,
      selectedSourceSubject: evidence.selectedSource?.subject || (sourceContextApplies ? activeConversationState.selectedSourceSubject : null) || evidence.subject || null,
      selectedSourceYear: evidence.selectedSource?.year ? String(evidence.selectedSource.year) : (sourceContextApplies ? activeConversationState.selectedSourceYear : null) || null,
      selectedQuestionType: (route.entities?.questionType as any) || (sourceContextApplies ? activeConversationState.selectedQuestionType : null) || null,
      currentQuestionIndex: questionFollowUp ? Number(questionFollowUp[1]) : activeConversationState.currentQuestionIndex,
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

    // A lesson PDF lookup is an inventory operation, not a generative answer.
    // Return exact Firebase matches. If the lesson classifier is uncertain,
    // fall back to the real subject inventory instead of claiming no PDF exists.
    if (route.mode === "lesson_pdf_search") {
      const lessonName = route.entities.lesson || evidence.lessonIds[0] || "requested lesson";
      let lessonSources = (evidence.candidates || []).map((source: any) => {
        const id = source.sourceId || source.id;
        return {
          ...source,
          id,
          sourceId: id,
          url: source.url || `/api/rag/sources/${id}/download`,
          badge: "Lesson PDF",
          usedInAnswer: false,
        };
      });

      let usedSubjectFallback = false;
      if (lessonSources.length === 0) {
        const { getSourceInventory } = await import("../sources/sourceInventoryService");
        const inventory = await getSourceInventory({
          uid: user.uid,
          subject: route.entities.subject || activeSubject || undefined,
          isAdmin: user.roles?.includes("admin") || user.admin === true,
        });
        lessonSources = (inventory.all || [])
          .filter((source: any) => {
            const kind = String(source.mediaKind || "pdf").toLowerCase();
            const name = String(source.fileName || source.title || "").toLowerCase();
            return kind === "pdf" || name.endsWith(".pdf");
          })
          .sort((a: any, b: any) => {
            const sourceRequest = {
              subject: route.entities.subject || activeSubject || undefined,
              year: route.entities.year || undefined,
              resourceType: route.entities.resourceType || undefined,
              paperType: route.entities.questionType || route.entities.paperType || undefined,
              keywords: prompt.split(/\s+/).filter(Boolean),
              ownerUid: user.uid,
            };
            return scoreSource(b, sourceRequest) - scoreSource(a, sourceRequest);
          })
          .slice(0, 10)
          .map((source: any) => {
            const id = source.sourceId || source.id;
            return {
              ...source,
              id,
              sourceId: id,
              url: source.url || `/api/rag/sources/${id}/download`,
              badge: "Saved PDF",
              usedInAnswer: false,
            };
          });
        usedSubjectFallback = lessonSources.length > 0;
      }

      const readyCount = lessonSources.filter((source: any) => (
        source.textIndexed === true || Number(source.chunkCount || 0) > 0 || source.indexStatus === "ready"
      )).length;

      let answer: string;
      if (lessonSources.length > 0) {
        answer = [
          usedSubjectFallback
            ? `**${lessonName}** සඳහා exact lesson-name match එකක් නොලැබුණත්, මේ accessible saved PDFs හමු වුණා:`
            : `**${lessonName}** lesson එකට match වෙන saved PDFs:`,
          "",
          ...lessonSources.map((source: any, index: number) => {
            const status = source.textIndexed || Number(source.chunkCount || 0) > 0 || source.indexStatus === "ready"
              ? "Ready for questions"
              : source.needsOcr
                ? "OCR pending"
                : "Index pending";
            return `${index + 1}. [${source.title}](${source.url}) — ${status}`;
          }),
          "",
          readyCount > 0
            ? "Ready ලෙස පෙන්වන PDF එකක් තෝරලා ප්‍රශ්නය අහන්න. මම එහි indexed text evidence එක AI answer එකට යොදාගන්නම්."
            : "PDF files save වෙලා තිබුණත් searchable index එක තවම සූදානම් නැහැ.",
        ].join("\n");
      } else {
        answer = `**${lessonName}** සඳහා ඔබට access තියෙන saved PDF එකක් දැනට හමු වුණේ නැහැ.`;
      }

      answer = sanitizeAssistantText(answer);
      if (lessonSources.length > 0) {
        const choices = lessonSources.map(toPendingSourceChoice).filter(Boolean) as any[];
        await updateConversationState(user.uid, {
          pendingSourceChoices: choices,
          awaitingSourceSelection: choices.length > 0,
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
    userContext.activeSubject = null;
    userContext.subjectScope = "all";
    userContext.requestedSubjectHint = activeSubject || null;

    // A. DETERMINISTIC Z-SCORE INTENT
    if (route.mode === "zscore_prediction") {
       const zctx = userContext?.zScoreContext || {};
          emitSse(res, "status", { step: "zscore_db", status: "reading" });
          const formatMetric = (value: unknown, digits = 4) =>
            typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "N/A";
          const usesSavedPaperHistory = /actual_saved_paper_marks|saved[_ -]?paper/i.test(String(zctx.calculationBasis || ""));
          const estimateLabel = usesSavedPaperHistory ? "Saved-paper Z estimate" : "Exam Score Predictor Z estimate";
          const estimateIntro = usesSavedPaperHistory
            ? "ඔයා සුරැකි SFT, ET සහ ICT paper marks වලින් ගණනය කළ practice estimate එක"
            : "ඔයාගේ syllabus progress එකෙන් Exam Score Predictor ගණනය කළ planning estimate එක";
          let fastAns = `### ${estimateLabel}\n\n${estimateIntro}: **${formatMetric(zctx.latestOverallZScore)}**.\n`;
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
          fastAns += usesSavedPaperHistory
            ? `> මෙය සුරැකි paper marks මත ගණනය කළ practice estimate එකක්. Official exam Z-score හෝ official rank එකක් නොවේ.`
            : `> මේවා Exam Score Predictor planning estimates. Official exam Z-score හෝ official district/island rank නොවේ.`;

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

    // A2. DETERMINISTIC SAVED ERROR LOG INTENT
    // Do not ask the model to decide whether the notebook is empty. The server
    // has already merged current UID records with legacy email-keyed records.
    const isMistakeWriteRequest = /(?:save|add|log|record|store|සේව්|සුරකි|එකතු)\s+(?:this|it|මේ|මෙය|mistake|error)/iu.test(String(prompt || ""));
    if (isMistakeReviewIntent(prompt) && !isMistakeWriteRequest && !selectedMistakeRecord) {
      emitSse(res, "status", { step: "mistake_notebook", status: "reading", message: "Reading your saved Error Log…" });
      const records = Array.isArray(userContext?.recentMistakes) ? userContext.recentMistakes.slice(0, 12) : [];
      selectedMistakeRecord = selectMistakeRecordForPrompt(records, prompt);
      if (selectedMistakeRecord) {
        const originalMistakeRequest = prompt;
        prompt = `${originalMistakeRequest}\n\nUse this exact saved Error Log record as the learner-specific basis: Subject ${selectedMistakeRecord.subject || "SFT"}; lesson ${selectedMistakeRecord.lesson || "unknown"}; saved note ${selectedMistakeRecord.errorText || selectedMistakeRecord.questionText || "image-only record"}. Preserve the action requested in the first sentence. Do not list all Error Log records and do not ask the learner to choose a record.`;
        route.mode = "tutor_explanation";
        route.entities = { ...(route.entities || {}), subject: selectedMistakeRecord.subject || activeSubject, activeSourceId: undefined };
        route.answerHints = { ...(route.answerHints || {}), mustUseRag: false, mustUseGoogleSearch: false, mustAskClarification: false };
        await updateConversationState(user.uid, {
          pendingMistakeChoices: [],
          awaitingMistakeSelection: false,
          activeMistakeId: selectedMistakeRecord.id,
          lastIntent: "mistake_record_review",
        });
      }
      if (!selectedMistakeRecord) {
      let answerText = `### Error Log\n\n`;
      if (records.length === 0) {
        answerText += "ඔයාගේ current account UID path එකත් පැරණි email-based path එකත් දෙකම පරීක්ෂා කළා. මේ account එකට සුරැකි Error Log record එකක් හමු වුණේ නැහැ.";
      } else {
        answerText += `ඔයාගේ Error Log එකේ සුරැකි record **${records.length}ක්** හමු වුණා.\n\n`;
        answerText += records.map((record: any, index: number) => {
          const subject = String(record.subject || "Subject").toUpperCase();
          const lesson = String(record.lesson || "පාඩම සඳහන් කර නැහැ").trim();
          const detail = String(record.errorText || record.questionText || "Image-only saved mistake").trim().replace(/\s+/g, " ").slice(0, 320);
          const imageNote = record.imageStoragePath ? " · saved image ඇත" : "";
          const repeatNote = Number(record.repeatCount || 0) > 1 ? ` · වර ${Number(record.repeatCount)}ක් වැරදී ඇත` : "";
          return `**${index + 1}. ${subject} — ${lesson}**${imageNote}${repeatNote}\n\n${detail}`;
        }).join("\n\n");
        answerText += "\n\nසාකච්ඡා කරන්න ඕන record අංකය දෙන්න. මම ඒ saved record එකේ ප්‍රශ්නය, වැරදුණු හේතුව, නිවැරදි ක්‍රමය සහ නැවත පුහුණු ප්‍රශ්නය දෙන්නම්.";
        await updateConversationState(user.uid, {
          pendingMistakeChoices: records.map((record: any) => `${record.ownerPath || "uid"}:${record.id}`),
          awaitingMistakeSelection: true,
          activeMistakeId: null,
          lastIntent: "mistake_notebook",
        });
      }
      emitSse(res, "token", { text: answerText });
      trace.lastEvent = "token";
      const chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answerText,
        mode: "mistake_notebook",
        subject: activeSubject,
      });
      if (chatRes?.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
      trace.completed = true;
      emitSse(res, "done", {
        ok: true,
        completed: true,
        requestId,
        messageId: chatRes?.messageId || null,
        chatSaved: trace.chatSaved,
        sources: [],
        finishReason: records.length > 0 ? "mistake_log_loaded" : "mistake_log_empty",
      });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
      }
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
      emitSse(res, "status", { step: "sources_db", status: "searching", message: "Checking saved PDFs…" });
      const requestedSubject = route.entities.subject || activeSubject || undefined;
      const wantsAnswerable = route.entities.inventoryMode === "answerable";
      const isAdmin = user.roles?.includes("admin") || user.admin === true;

      const { getSourceInventory } = await import("../sources/sourceInventoryService");
      const inventory = await getSourceInventory({
        uid: user.uid,
        subject: requestedSubject,
        isAdmin,
      });

      const groups = inventory.groups;
      const pdfSources = [
        ...groups.pastPapers,
        ...groups.markingSchemes,
        ...groups.syllabus,
        ...groups.paperStructure,
        ...groups.uploadedPdfs,
      ].filter((source: any) => {
        const kind = String(source.mediaKind || "pdf").toLowerCase();
        const mime = String(source.mimeType || "").toLowerCase();
        const name = String(source.fileName || source.title || "").toLowerCase();
        return kind === "pdf" || mime === "application/pdf" || name.endsWith(".pdf");
      });

      const indexedSources = pdfSources.filter((source: any) => (
        source.textIndexed === true
        || Number(source.chunkCount || 0) > 0
        || String(source.indexStatus || source.processingStatus || "").toLowerCase() === "ready"
      ));
      const directPdfSources = pdfSources.filter((source: any) => {
        const status = String(source.indexStatus || source.processingStatus || "").toLowerCase();
        return Boolean(source.storagePath) && !["failed", "archived"].includes(status);
      });
      const answerableSources = Array.from(new Map(
        [...indexedSources, ...directPdfSources].map((source: any) => [String(source.sourceId || source.id), source]),
      ).values()) as any[];
      const pendingSources = pdfSources.filter((source: any) => !answerableSources.includes(source));
      const inventoryBase = wantsAnswerable
        ? (answerableSources.length > 0 ? answerableSources : pdfSources)
        : pdfSources;
      const displayedSources = [...inventoryBase]
        .sort((a: any, b: any) => {
            const sourceRequest = {
              subject: route.entities.subject || activeSubject || undefined,
              year: route.entities.year || undefined,
              resourceType: route.entities.resourceType || undefined,
              paperType: route.entities.questionType || route.entities.paperType || undefined,
              keywords: prompt.split(/\s+/).filter(Boolean),
              ownerUid: user.uid,
            };
            return scoreSource(b, sourceRequest) - scoreSource(a, sourceRequest);
          })
        .slice(0, 12);

      const sseSources = displayedSources.map((source: any) => {
        const id = source.sourceId || source.id;
        return {
          id,
          sourceId: id,
          title: source.title,
          url: source.url || `/api/rag/sources/${id}/download`,
          storagePath: source.storagePath,
          badge: source.resourceType === "past_paper"
            ? "Past Paper"
            : source.resourceType === "marking_scheme"
              ? "Marking Scheme"
              : source.resourceType === "paper_structure"
                ? "Paper Structure"
                : "Saved PDF",
          confidence: 1,
          sourceType: source.resourceType,
          sourceScope: source.sourceScope,
          subject: source.subject,
          year: source.year,
          textIndexed: source.textIndexed,
          indexStatus: source.indexStatus,
          usedInAnswer: false,
        };
      });

      if (sseSources.length > 0) {
        const choices = displayedSources.map(toPendingSourceChoice).filter(Boolean) as any[];
        await updateConversationState(user.uid, {
          pendingSourceChoices: choices,
          awaitingSourceSelection: choices.length > 0,
          lastIntent: "lesson_pdf_search",
        });
        emitSse(res, "sources", { sources: sseSources });
      }

      let answer = "";
      if (pdfSources.length === 0) {
        answer = requestedSubject
          ? `${requestedSubject} සඳහා ඔබට access තියෙන saved PDF එකක් දැනට හමු වුණේ නැහැ.`
          : "ඔබට access තියෙන saved PDF එකක් දැනට හමු වුණේ නැහැ.";
      } else if (wantsAnswerable && answerableSources.length > 0) {
        answer = [
          `මේ PDF${answerableSources.length === 1 ? " එකෙන්" : " වලින්"} මට දැන්ම evidence-based පිළිතුරු දෙන්න පුළුවන්:`,
          "",
          ...displayedSources.map((source: any, index: number) => {
            const id = source.sourceId || source.id;
            const meta = [source.subject, source.year, source.lesson].filter(Boolean).join(" · ");
            const indexed = source.textIndexed === true
              || Number(source.chunkCount || 0) > 0
              || String(source.indexStatus || source.processingStatus || "").toLowerCase() === "ready";
            const status = indexed ? "Indexed and ready" : "Ready for secure direct PDF scan";
            return `${index + 1}. [${source.title}](/api/rag/sources/${id}/download)${meta ? ` — ${meta}` : ""} — ${status}`;
          }),
          "",
          "PDF නමත් ප්‍රශ්න අංකයත් කියන්න. Indexed text නැත්නම් source file එක secure Direct PDF QA වෙත යවලා evidence එකෙන් පිළිතුරු දෙන්නම්.",
        ].join("\n");
      } else if (wantsAnswerable) {
        answer = [
          "Saved PDF files හමු වුණා, නමුත් source file path හෝ usable text index එකක් නැති නිසා ඒවායෙන් තවම පිළිතුරු දෙන්න බැහැ:",
          "",
          ...pendingSources.map((source: any, index: number) => {
            const status = source.needsOcr ? "OCR required" : (source.indexStatus || source.processingStatus || "index pending");
            return `${index + 1}. ${source.title} — ${status}`;
          }),
          "",
          "Admin reprocess/index action එක අවසන් වූ පසු ඒ PDF අන්තර්ගතයෙන් පිළිතුරු දෙන්න පුළුවන්.",
        ].join("\n");
      } else {
        answer = [
          `ඔබට access තියෙන saved PDFs${pdfSources.length > displayedSources.length ? ` අතරින් වඩාත් අදාළ ${displayedSources.length}` : ""}:`,
          "",
          ...displayedSources.map((source: any, index: number) => {
            const id = source.sourceId || source.id;
            const status = source.textIndexed || Number(source.chunkCount || 0) > 0 || source.indexStatus === "ready" ? "Ready" : (source.needsOcr ? "OCR pending" : "Index pending");
            return `${index + 1}. [${source.title}](/api/rag/sources/${id}/download) — ${status}`;
          }),
          "",
          "PDF එක තෝරන්න එහි අංකය පමණක් ලියන්න. නිශ්චිත නමක් සොයන්න නම් එම නම ලියන්න.",
        ].join("\n");
      }

      answer = sanitizeAssistantText(answer);
      emitSse(res, "token", { text: answer });
      trace.lastEvent = "token";

      const chatRes = await saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: answer,
        mode: "pdf_inventory_request",
        subject: requestedSubject,
        sources: sseSources,
      });

      trace.chatSaved = chatRes.chatSaved;
      trace.messageId = chatRes.messageId;
      trace.completed = true;
      emitSse(res, "done", {
        ok: pdfSources.length > 0,
        completed: true,
        requestId,
        messageId: chatRes.messageId || null,
        chatSaved: chatRes.chatSaved,
        sources: sseSources,
        finishReason: answerableSources.length > 0 ? "answerable_pdf_inventory" : "pdf_inventory",
      });
      trace.doneSent = true;
      trace.lastEvent = "done";
      return;
    }

    // C. PAST PAPER QUESTION QA or MARKING SCHEME REQUEST or PDF LINK REQUEST
    const hasUploadedPdf = prompt.includes("[Uploaded PDF:");
    const isPaperQa = !hasUploadedPdf && (route.mode === "paper_question_qa" || route.mode === "marking_scheme_request" || route.mode === "pdf_link_request");
    if (isPaperQa) {
      const requestedSubject = route.entities.subject || activeSubject || "SFT";
      let requestedYear = route.entities.year || (sourceContextApplies ? activeConversationState.selectedSourceYear : undefined) || undefined;
      const requestedQuestionNo = route.entities.questionNo;
      const requestedQuestionType = String(
        route.entities.questionType
        || (sourceContextApplies ? activeConversationState.selectedQuestionType : null)
        || paperIntent.questionType
        || "MCQ",
      ).toUpperCase();
      const activePaperSourceId = route.entities?.activeSourceId
        || (sourceContextApplies ? activeConversationState.selectedSourceId : null)
        || null;

      if (requestedSubject && (requestedYear || activePaperSourceId)) {
        emitSse(res, "status", { step: "exam_db", status: "searching" });

        let paperSource: any = null;
        let resolution: any = { sources: [], paperSource: null };

        const { resolveStrictSource } = await import("../ai-core/sources/sourceResolver");
        const { getSourceInventory } = await import("../sources/sourceInventoryService");

        const isAdminUser = user.roles?.includes("admin") || user.admin === true;
        const inventory = await getSourceInventory({ uid: user.uid, subject: requestedSubject, isAdmin: isAdminUser });
        const allAvailableSources = [...inventory.groups.pastPapers, ...inventory.groups.markingSchemes, ...inventory.groups.syllabus, ...inventory.groups.uploadedPdfs, ...inventory.groups.paperStructure];

        const strictRes = resolveStrictSource(allAvailableSources, {
          year: requestedYear,
          subject: requestedSubject,
          activeSourceId: activePaperSourceId,
          expectedResourceType: route.mode === "marking_scheme_request" ? "marking_scheme" : undefined,
          prompt
        });

        if (strictRes.sourceLocked && strictRes.selectedSource) {
           console.log(`[AI_CORE] Source Locked: ${strictRes.selectedSource.title}`);
           paperSource = { ...strictRes.selectedSource, id: strictRes.selectedSource.id || strictRes.selectedSource.sourceId };
           requestedYear = requestedYear || (paperSource.year ? String(paperSource.year) : "Model/Guessing");
           route.entities.year = requestedYear;
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
             const msg = `${requestedYear || ""} ${requestedSubject || ""} ${requestedQuestionType} ${requestedQuestionNo || ""} සඳහා තෝරාගත් නිශ්චිත PDF මූලාශ්‍රය සනාථ කරගත නොහැකි නිසා පිළිතුරක් අනුමාන කරන්නේ නැහැ.`;
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
        const questionId = (paperSource?.id && requestedQuestionNo) ? `${paperSource.id}_${requestedQuestionType}_${requestedQuestionNo}`.replace(/\//g, "_") : null;

        if (hasPaperSource && route.mode !== "pdf_link_request") {
          const db = getAdminDb();
          const { retrieveEvidenceForPaperQuestion } = await import("../ai-core/evidence/evidenceRetriever");

          // 1.1 Check Evidence first!
          if (questionId) {
            emitSse(res, "status", { step: "evidence_check", message: "Searching for verified evidence..." });
            const evidenceResult = await retrieveEvidenceForPaperQuestion({
              sourceId: paperSource.id,
              questionType: requestedQuestionType,
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
                  questionType: requestedQuestionType,
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

                   const isHealthy = hasQuestionMarker && (requestedQuestionType === "MCQ" ? hasOptions : true);

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

          const sourceIdentity = `${paperSource?.resourceType || ""} ${paperSource?.sourceType || ""} ${paperSource?.sourceScope || ""} ${paperSource?.title || ""}`.toLowerCase();
          const sourceIsMarkingScheme = /marking|scheme|answer|පිළිතුරු/u.test(sourceIdentity);
          // Question-paper chunks prove where the question is, but they are not
          // an answer. Route every uncached question-paper request through the
          // exact extractor + syllabus-bounded solver.
          if (requestedQuestionNo && !sourceIsMarkingScheme) badTextQuality = true;

          // 1.3 If chunks are missing or bad, trigger the authenticated Direct
          // PDF QA handoff. The frontend sends the source identity; the backend
          // performs the verified Firebase Admin read.
          if (noChunks || badTextQuality || needsOcr) {
            console.log(`[AI_RESPOND_STREAM] Direct PDF QA required for ${paperSource.id}. Emitting event...`);

            emitSse(res, "direct_pdf_handoff_required", {
              sourceId: paperSource.id || paperSource.sourceId,
              storagePath: paperSource.storagePath,
              title: paperSource.title,
              subject: requestedSubject,
              year: requestedYear,
              questionNo: requestedQuestionNo,
              questionType: requestedQuestionType,
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
                questionType: requestedQuestionType,
              prompt: prompt,
                extractionMethod: "pending_direct_pdf_qa"
              }
            });

            // The frontend starts the follow-up request while the backend reads
            // the verified source path. No cross-origin Storage fetch is used.
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
            composedAnswer = `✅ **ඔයා හෙව්ව PDF එක හමු වුණා.**\n\n📌 **${pSrc?.title}**\n- **Subject:** ${requestedSubject}\n- **Year:** ${requestedYear}\n- **Source:** සත්‍යාපිත local source\n\n📥 [PDF එක ආරක්ෂිතව විවෘත කරන්න](${pSrc?.url || `/api/rag/sources/${pSrc?.id}/download`})`;
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
              // Do not manufacture a generic sentence and label it as the
              // exact paper question. The verified answer blocks can stand on
              // their own when the question wording was not extracted here.
              questionText: undefined,
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
      }), { chunks: [], source: null, hasExactQuestionText: false, needsOcr: false }, res, {
        critical: true,
        publicMessage: "The selected PDF evidence could not be loaded. Please try again.",
      });

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
        limit: isLessonEvidenceMode(route.mode) ? 32 : 12,
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
            resourceType: route.entities.resourceType || (route.entities.paperType ? "past_paper" : undefined),
            paperType: route.entities.questionType,
            keywords: prompt.split(" ")
          });

          if (policy.intent === "official_paper_question" && score < 75) return;
          if (policy.intent === "syllabus_lesson_explanation" && score < 55) return;

          if (!isLessonEvidenceMode(route.mode)) {
            allSources.push({ title: c.title, sourceId: c.sourceId || c.id, pageNumber: c.metadata?.pageNumber || c.page, sourceType: c.sourceType || 'rag', sourceScope: c.sourceScope || 'personal', confidence: c.confidence, badge: "RAG" });
          }
          const evidenceTextLimit = isLessonEvidenceMode(route.mode) ? 4_000 : 3_000;
          contextBlocksText += `\n[RAG SOURCE ${i+1}] ${c.title}:\n${c.text.substring(0, evidenceTextLimit)}\n`;
        });
      }
    }

    if (isLessonEvidenceMode(route.mode) && contextBlocksText.trim().length === 0) {
      const lessonName = route.entities.lesson || evidence.lessonIds[0] || "requested lesson";
      emitSse(res, "status", { step: "syllabus_fallback", status: "searching", message: "Checking the syllabus and paper structure" });
      try {
        const { resolveExamResources } = await import("./examResourceResolver");
        const fallbackResolution: any = await resolveExamResources({
          prompt: `${prompt}
Lesson: ${lessonName}`,
          uid: user.uid,
          subject: route.entities.subject || activeSubject || undefined,
        });
        for (const source of fallbackResolution?.sources || []) {
          const text = String(source?.text || source?.snippet || "").trim();
          if (text) contextBlocksText += `
[SYLLABUS / PAPER STRUCTURE] ${source.title || lessonName}:
${text.slice(0, 5000)}
`;
          if (!allSources.some((existing: any) => (existing.sourceId || existing.id) === (source.sourceId || source.id))) {
            allSources.push({ ...source, badge: source.badge || "Syllabus" });
          }
        }
      } catch (fallbackError: any) {
        console.warn("SYLLABUS_FALLBACK_FAILED", fallbackError?.message || fallbackError);
      }
      if (contextBlocksText.trim().length === 0) {
        contextBlocksText += `
[PROJECT SYLLABUS FALLBACK]
Explain ${lessonName} only with established Sri Lankan G.C.E. A/L Technology syllabus concepts. State uncertainty for any detail that requires an unavailable document.
`;
      }
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

    const securedEvidence = secureEvidenceText(contextBlocksText);
    contextBlocksText = securedEvidence.text;
    allSources = attachEvidenceContractToSources(allSources);
    if (!securedEvidence.safe) {
      emitSse(res, "status", {
        step: "source_security",
        status: "filtered",
        message: "Ignored untrusted instructions embedded inside source content",
        removedLineCount: securedEvidence.removedLineCount,
      });
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
    // Every learner-facing answer uses the high-quality final writer. Greetings
    // are handled deterministically above, so there is no reason to trade away
    // reasoning quality on an actual study question when cost is not constrained.
    let aiTask: AITask = image ? "image_understanding" : "final_answer";

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
    finalSysInstruction += buildAnswerContractInstruction({
      prompt,
      mode: route.mode,
      evidenceRequired: policy.requireEvidence,
    });
    finalSysInstruction += sourceSecurityInstruction(securedEvidence.threats.length);

    // Build the parts array for the contents object
    const mistakeImageSources: any[] = [];
    const requestTextPart: any = {
      text: `Context Blocks:\n${contextBlocksText}\n\nPrevious Chat History:\n${history?.length ? JSON.stringify(history) : 'None'}\n\nCurrent User Request:\n${prompt}\nAnswer in Sinhala-first style if appropriate.`,
    };
    const contentsParts: any[] = [requestTextPart];

    const explicitSubject = String(route.entities?.subject || paperIntent.subject || "").toUpperCase();
    const promptSubject = /(?:\bSFT\b|SCIENCE FOR TECHNOLOGY|තාක්ෂණවේදය සඳහා විද්‍යාව|තාක්ෂණවේදය සඳහා විද්යාව)/iu.test(String(prompt || ""))
      ? "SFT"
      : /(?:\bET\b|ENGINEERING TECHNOLOGY|ඉංජිනේරු තාක්ෂණවේදය)/iu.test(String(prompt || ""))
        ? "ET"
        : /(?:\bICT\b|INFORMATION AND COMMUNICATION TECHNOLOGY|තොරතුරු හා සන්නිවේදන තාක්ෂණය)/iu.test(String(prompt || ""))
          ? "ICT"
          : "";
    const groundingSubject = [explicitSubject, promptSubject, String(activeSubject || "").toUpperCase()]
      .find((value) => ["SFT", "ET", "ICT"].includes(value));

    if (groundingSubject) {
      const syllabusPdf = await safeCall(
        `${groundingSubject.toLowerCase()}AuthoritativeSyllabus`,
        () => getSubjectSyllabusGroundingPdf(user.uid, groundingSubject),
        null,
        res,
        {
          critical: policy.requireEvidence,
          publicMessage: `The authoritative ${groundingSubject} syllabus is temporarily unavailable.`,
        },
      );
      if (syllabusPdf?.gcsUri) {
        contentsParts.unshift({ fileData: { fileUri: syllabusPdf.gcsUri, mimeType: "application/pdf" } });
      } else if (syllabusPdf?.buffer?.length) {
        contentsParts.unshift({ inlineData: { mimeType: "application/pdf", data: syllabusPdf.buffer.toString("base64") } });
      }
      if (syllabusPdf) {
        requestTextPart.text += `\n\nAUTHORITATIVE ${groundingSubject} SOURCE: The attached official syllabus PDF defines the allowed scope. For SFT, do not add separate A/L Biology/Chemistry/Physics/Mathematics content unless this syllabus or retrieved approved SFT resources include it.`;
      }
    }

    const asksAboutMistakes = Boolean(selectedMistakeRecord) || isMistakeReviewIntent(prompt);
    if (asksAboutMistakes && Array.isArray(modifiedUserContext.recentMistakes)) {
      const allRecentMistakes = modifiedUserContext.recentMistakes as any[];
      const recentMistakes = selectedMistakeRecord
        ? [selectedMistakeRecord]
        : allRecentMistakes.slice(0, 8);
      requestTextPart.text += `\n\n${selectedMistakeRecord ? "SELECTED" : "Recent"} Mistake Notebook records (real saved data):\n${JSON.stringify(recentMistakes.map((mistake: any) => ({
        subject: mistake.subject,
        lesson: mistake.lesson,
        errorText: mistake.errorText || mistake.questionText,
        createdAt: mistake.createdAt,
        hasImage: Boolean(mistake.imageStoragePath),
        masteryScore: mistake.masteryScore || 0,
        correctStreak: mistake.correctStreak || 0,
        nextReviewAt: mistake.nextReviewAt || mistake.retryDate || null,
        errorCategory: mistake.errorCategory || "unknown",
      })))}\n${selectedMistakeRecord
        ? "Analyze only this selected record. Read its attached image first. Identify the exact question, diagnose the likely error category, show the correct method and checked answer, then give one similar practice question calibrated to its mastery score. Do not list the notebook again."
        : "These are the user's real saved Error Log records. Summarize only what was requested and use mastery/due-date data for a grounded revision quiz."}\nNever say the Error Log is empty when this list contains records. If a saved image is attached below, inspect that actual image. Do not ask the user to upload it again. Never replace unreadable or missing details with generic likely mistakes; say exactly what cannot be read.`;
      const bucket = getAdminBucket();
      for (const mistake of recentMistakes.slice(0, 3)) {
        if (!mistake.imageStoragePath || !mistake.imageMimeType) continue;
        try {
          const [imageBytes] = await bucket.file(String(mistake.imageStoragePath)).download();
          if (!imageBytes?.length || imageBytes.length > 12 * 1024 * 1024) throw new Error("Saved image is empty or too large.");
          contentsParts.push({
            inlineData: {
              data: imageBytes.toString("base64"),
              mimeType: mistake.imageMimeType,
            },
          });
          contentsParts.push({ text: `Saved Error Log image for ${mistake.subject || "subject"} / ${mistake.lesson || "lesson"}. This is the actual selected evidence; inspect it before answering.` });
          const source = {
            id: mistake.id,
            sourceId: mistake.id,
            title: mistake.imageFileName || `${mistake.subject || "Subject"} - ${mistake.lesson || "lesson"}`,
            sourceType: "mistake_image",
            badge: "Saved error image",
            mimeType: mistake.imageMimeType,
            lesson: mistake.lesson,
            ownerPath: mistake.ownerPath || "uid",
          };
          mistakeImageSources.push(source);
          allSources.push(source);
        } catch (error) {
          console.warn("[MistakeNotebook] Could not load saved image", { mistakeId: mistake.id, error: String(error) });
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

    emitSse(res, "status", {
      step: "answer_planning",
      status: "working",
      message: "Planning every requested part, calculation check, and evidence dependency",
    });
    const answerPlan = await createAnswerPlan({
      prompt,
      mode: route.mode,
      sources: allSources,
      evidenceRequired: policy.requireEvidence,
    });
    requestTextPart.text += plannerContext(answerPlan);
    const currentEvidenceContract = buildEvidenceContract(allSources);
    const evidenceContradictions = detectEvidenceContradictions(currentEvidenceContract);
    const answerEvidenceStatus = classifyAnswerEvidenceStatus({ prompt, mode: route.mode, sources: allSources });
    finalSysInstruction += evidenceContractInstruction(currentEvidenceContract, evidenceContradictions);
    finalSysInstruction += `\n\nANSWER STATUS LABEL: ${answerEvidenceStatus}. Use this exact epistemic status and never upgrade it.`;
    emitSse(res, "answer_status", {
      status: answerEvidenceStatus,
      sourceMode: sourceContextApplies ? "locked_pdf" : "general_ai",
      lockedSourceActive: sourceContextApplies,
      sourceTitle: sourceContextApplies ? (evidence.selectedSource?.title || activeConversationState.selectedSourceTitle || allSources[0]?.title || null) : null,
      contradictions: evidenceContradictions,
    });

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
         emitSse(res, "status", { step: "model_fallback", status: "working", message: "Primary AI model was unavailable; completing with the backup model." });
      }
    } catch (err: any) {
      throw new Error(`All model streaming options failed. ${err.message}`);
    }

    let fullText = "";
    let chunkBuffer = "";
    let modelFinishReason: string | null = null;
    let streamFailure: any = null;
    const responseSanitizer = createAssistantStreamSanitizer();
    try {
      for await (const chunk of stream) {
        modelFinishReason = getModelFinishReason(chunk) || modelFinishReason;
        const text = chunk.text || "";
        if (!text) continue;
        const sanitized = responseSanitizer.push(text);
        if (!sanitized) continue;
        fullText += sanitized;
        chunkBuffer += sanitized;
        trace.totalChars += sanitized.length;
        trace.tokenCount++;

        if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
          emitSse(res, "token", { text: chunkBuffer });
          trace.lastEvent = "token";
          chunkBuffer = "";
        }
      }
    } catch (e: any) {
      console.warn("Stream interrupted:", e);
      streamFailure = e;
    }

    const finalSanitized = responseSanitizer.flush();
    if (finalSanitized) {
      fullText += finalSanitized;
      chunkBuffer += finalSanitized;
      trace.totalChars += finalSanitized.length;
    }
    if (chunkBuffer.length > 0) {
      emitSse(res, "token", { text: chunkBuffer });
      trace.lastEvent = "token";
    }

    let completionAssessment = assessAnswerCompleteness({
      prompt,
      answer: fullText,
      finishReason: streamFailure ? "STREAM_INTERRUPTED" : modelFinishReason,
      mode: route.mode,
    });
    let completionPasses = 0;
    const maxCompletionPasses = Math.min(3, Math.max(1, Number(process.env.AI_AUTO_CONTINUATION_PASSES || 3)));

    while (
      completionAssessment.shouldContinue
      && completionPasses < maxCompletionPasses
      && !signal.aborted
      && !res.writableEnded
    ) {
      completionPasses += 1;
      emitSse(res, "status", {
        step: "completion_recovery",
        status: "working",
        message: completionPasses === 1
          ? "Checking that every requested part is complete"
          : "Finishing the remaining answer sections",
        pass: completionPasses,
      });

      const continuationInstruction = buildContinuationInstruction({
        originalPrompt: prompt,
        currentAnswer: fullText,
        assessment: completionAssessment,
      });
      const continuationContents: any[] = [{ role: "user", parts: contentsParts }];
      if (fullText.trim()) continuationContents.push({ role: "model", parts: [{ text: fullText }] });
      continuationContents.push({ role: "user", parts: [{ text: continuationInstruction }] });

      try {
        const continuation = await callGeminiWithFallback("final_answer", {
          model: "ignored",
          contents: continuationContents,
          config: {
            systemInstruction: finalSysInstruction,
            temperature: Math.min(0.2, getTemperature(route.mode)),
            maxOutputTokens: Math.max(8_192, getMaxTokens(route.mode)),
          },
        }, ai);
        modelUsed = continuation.modelUsed || modelUsed;
        const continuationText = sanitizeAssistantText(continuation.result.text || "");
        const mergedText = mergeContinuationText(fullText, continuationText);
        const addedText = mergedText.startsWith(fullText) ? mergedText.slice(fullText.length) : continuationText;
        if (!addedText.trim()) {
          completionAssessment = {
            ...completionAssessment,
            shouldContinue: false,
            reasons: Array.from(new Set([...completionAssessment.reasons, "CONTINUATION_MADE_NO_PROGRESS"])),
          };
          break;
        }
        fullText = mergedText;
        emitSse(res, "token", { text: addedText });
        trace.lastEvent = "token";
        trace.totalChars += addedText.length;
        modelFinishReason = getModelFinishReason(continuation.result) || "STOP";
        completionAssessment = assessAnswerCompleteness({
          prompt,
          answer: fullText,
          finishReason: modelFinishReason,
          mode: route.mode,
        });
      } catch (completionError: any) {
        console.warn("[ANSWER_COMPLETION_RECOVERY_FAILED]", completionError?.message || completionError);
        completionAssessment = {
          ...completionAssessment,
          shouldContinue: false,
          reasons: Array.from(new Set([...completionAssessment.reasons, "CONTINUATION_REQUEST_FAILED"])),
        };
        break;
      }
    }

    let qualityReport: AnswerQualityReport | null = null;
    if (completionAssessment.complete && !signal.aborted && !res.writableEnded) {
      emitSse(res, "status", {
        step: "answer_verification",
        status: "working",
        message: "Independently checking coverage, calculations, units, and evidence",
      });
      const initialQuality = await reviewAnswerQuality({
        prompt,
        answer: fullText,
        mode: route.mode,
        evidenceRequired: policy.requireEvidence,
        sources: allSources,
      });
      qualityReport = initialQuality.report;

      const actionableIssueCount = qualityReport.missingRequirements.length
        + qualityReport.factualRisks.length
        + qualityReport.numericalChecks.length
        + qualityReport.citationRisks.length;
      if (!qualityReport.passed && actionableIssueCount > 0) {
        emitSse(res, "status", {
          step: "answer_repair",
          status: "working",
          message: "Correcting the complete answer before final delivery",
        });
        try {
          const repaired = await createQualityRepairedAnswer({
            originalPrompt: prompt,
            currentAnswer: fullText,
            report: qualityReport,
            modelInstruction: initialQuality.repairInstruction,
            systemInstruction: finalSysInstruction,
            contentsParts,
            maxOutputTokens: getMaxTokens(route.mode),
          });
          const repairedAssessment = assessAnswerCompleteness({
            prompt,
            answer: repaired.answer,
            finishReason: "STOP",
            mode: route.mode,
          });
          if (repaired.answer.trim() && repairedAssessment.complete) {
            fullText = repaired.answer;
            modelUsed = repaired.modelUsed || modelUsed;
            completionAssessment = repairedAssessment;
            emitSse(res, "answer_replace", { text: fullText, reason: "quality_repair" });
            trace.totalChars = fullText.length;
            const verifiedRepair = await reviewAnswerQuality({
              prompt,
              answer: fullText,
              mode: route.mode,
              evidenceRequired: policy.requireEvidence,
              sources: allSources,
            });
            qualityReport = { ...verifiedRepair.report, repaired: true };
          }
        } catch (qualityRepairError: any) {
          console.warn("[ANSWER_QUALITY_REPAIR_FAILED]", qualityRepairError?.message || qualityRepairError);
          qualityReport = {
            ...qualityReport,
            reviewError: `Repair failed: ${String(qualityRepairError?.message || qualityRepairError).slice(0, 400)}`,
          };
        }
      }
      emitSse(res, "quality_report", { report: qualityReport });
    }

    if (qualityReport && !qualityReport.passed) {
      completionAssessment = {
        ...completionAssessment,
        complete: false,
        shouldContinue: true,
        reasons: Array.from(new Set([...completionAssessment.reasons, "QUALITY_VERIFICATION_FAILED"])),
      };
    }

    const isInterrupted = !completionAssessment.complete;
    trace.modelFinishReason = modelFinishReason || undefined;
    trace.completionPasses = completionPasses;
    trace.incompleteReasons = completionAssessment.reasons;
    trace.qualityPassed = qualityReport?.passed;
    trace.qualityConfidence = qualityReport?.confidence;
    trace.qualityCoveragePercent = qualityReport?.coveragePercent;
    trace.qualityRepaired = qualityReport?.repaired;

    if (isInterrupted) {
      emitSse(res, "error", {
        ok: false,
        error: "The answer could not be completed automatically.",
        recoverable: completionAssessment.shouldContinue || !signal.aborted,
        code: "ANSWER_INCOMPLETE",
        completed: false,
        incomplete: true,
        missingSubparts: completionAssessment.missingSubparts,
        reasons: completionAssessment.reasons,
      });
    }

    const derivedVisualBlocks = !isInterrupted
      ? [
        ...mistakeImageSources.map((source: any) => ({
          type: "mistake_image_preview",
          title: source.title || "Saved error image",
          mistakeId: source.id,
          ownerPath: source.ownerPath,
          caption: `${source.lesson || "Error Log"} · saved image`,
        })),
        ...deriveEducationalVisualBlocks({ prompt, answer: fullText, mode: route.mode }),
      ]
      : [];
    if (derivedVisualBlocks.length > 0) {
      emitSse(res, "visual_blocks", { blocks: derivedVisualBlocks });
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
        activeSourceIds: allSources.map((s: any) => s.id || s.sourceId).filter(Boolean).length > 0
          ? allSources.map((s: any) => s.id || s.sourceId).filter(Boolean)
          : activeConversationState.activeSourceIds,
        selectedSourceId: route.entities?.activeSourceId || activeConversationState.selectedSourceId || null,
        selectedSourceTitle: activeConversationState.selectedSourceTitle || null,
        selectedSourceSubject: route.entities?.subject || activeConversationState.selectedSourceSubject || null,
        selectedSourceYear: route.entities?.year || activeConversationState.selectedSourceYear || null,
        selectedQuestionType: (route.entities?.questionType as any) || activeConversationState.selectedQuestionType || null,
        selectedQuestionId: route.entities?.questionNo || activeConversationState.selectedQuestionId || null
      });
    } catch (e) { /* ignore */ }
      chatRes = await safeCall("saveFinalChat", () => saveFinalChat({
        uid: user.uid,
        email: user.email,
        userText: prompt,
        assistantText: fullText,
        mode: route.mode,
        subject: activeSubject,
        sources: allSources,
        completion: {
          completed: !isInterrupted,
          finishReason: modelFinishReason,
          completionPasses,
          missingSubparts: completionAssessment.missingSubparts,
          reasons: completionAssessment.reasons,
        },
        quality: qualityReport,
      }), { chatSaved: false }, res);
      if (chatRes && chatRes.chatSaved) {
        trace.chatSaved = true;
        trace.messageId = chatRes.messageId;
      }
    } catch (err: any) {
      console.warn("CHAT_SAVE_SKIPPED", err);
    }

    // Background extraction
    if (!isInterrupted && qualityReport?.passed === true && process.env.ENABLE_MEMORY_EXTRACTION !== "false") {
      safeCall("extractStableMemoryIfUseful", () => extractStableMemoryIfUseful({ uid: user.uid, email: user.email, prompt, answer: fullText, userContext: modifiedUserContext }), null, res).catch(() => null);
    }

    // Suggestions are generated from the actual turn. They are optional and
    // time-bounded so they never delay delivery of the completed answer.
    if (!isInterrupted && fullText.length > 0) {
      try {
        const task = callGeminiWithFallback("fast_background", {
          model: "ignored",
          contents: buildFollowUpSuggestionPrompt(prompt, fullText),
          config: { temperature: 0.55, maxOutputTokens: 220, responseMimeType: "application/json" },
        }, getAIClient()).then(({ result }) => parseFollowUpSuggestions(result.text || ""));
        const suggestions = await withSuggestionTimeout(task, 1_800);
        if (Array.isArray(suggestions) && suggestions.length === 3) {
          emitSse(res, "suggestions", { suggestions });
        }
      } catch (err) {
        console.warn("Contextual suggestions unavailable", err);
      }
    }

    // Internal routing, retrieval and validation details are deliberately not
    // sent to the browser. Only the answer and its usable sources belong in
    // the learner-facing conversation.
    trace.completed = !isInterrupted;
    await recordAiTelemetry({
      id: requestId,
      kind: "answer",
      ok: !isInterrupted,
      startedAt: trace.startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      code: isInterrupted ? "ANSWER_INCOMPLETE" : "COMPLETE",
      mode: route.mode,
      model: modelUsed,
      completed: !isInterrupted,
      autoContinued: completionPasses > 0,
      completionPasses,
      qualityPassed: qualityReport?.passed ?? null,
      qualityCoveragePercent: qualityReport?.coveragePercent ?? null,
      qualityRepaired: qualityReport?.repaired ?? null,
      sourceCount: allSources.length,
    });
    emitSse(res, "done", {
      ok: !isInterrupted,
      completed: !isInterrupted,
      incomplete: isInterrupted,
      requestId,
      messageId: chatRes?.messageId || null,
      chatSaved: trace.chatSaved,
      sources: allSources || [],
      visualBlocks: derivedVisualBlocks,
      finishReason: isInterrupted ? "answer_incomplete" : "complete",
      modelFinishReason: modelFinishReason || null,
      autoContinued: completionPasses > 0,
      completionPasses,
      canContinue: isInterrupted && !signal.aborted,
      missingSubparts: completionAssessment.missingSubparts,
      incompleteReasons: completionAssessment.reasons,
      qualityReport,
      answerStatus: answerEvidenceStatus,
      sourceMode: sourceContextApplies ? "locked_pdf" : "general_ai",
      evidenceContradictions,
      answerPlan: {
        requirementCount: answerPlan.requirements.length,
        visualNeed: answerPlan.visualNeed,
        generatedBy: answerPlan.generatedBy,
      },
    });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } catch (error: any) {
    console.error("Stream Error", error);
    trace.errorCode = error.code || "UNKNOWN_ERROR";
    trace.errorMessage = error.message || String(error);
    await recordAiTelemetry({
      id: requestId,
      kind: "answer",
      ok: false,
      startedAt: trace.startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      code: trace.errorCode,
      completed: false,
    });

    // Check if error is AI_BILLING_EXHAUSTED (from checkAiBillingCircuit or classifyAiError)
    const classified = error.code === "AI_BILLING_EXHAUSTED" ? error : classifyAiError(error);

    if (classified.code === "AI_BILLING_EXHAUSTED") {
      emitSse(res, "error", {
        code: "AI_BILLING_EXHAUSTED",
        message: "AI credits අවසන් වෙලා තියෙනවා. Billing update කළාම නැවත AI answer දෙන්නම්.",
        canRetry: false,
        localOnlyAvailable: true
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

  const markContinuationClientClosed = () => {
    if (res.writableEnded || trace.doneSent) return;
    cancelRequest(requestId);
    console.log(`[STREAM] STREAM_CLIENT_CLOSED requestId=${requestId}`);
    trace.clientClosed = true;
    trace.endedAt = new Date().toISOString();
  };
  req.on("aborted", markContinuationClientClosed);
  res.on("close", markContinuationClientClosed);

  try {
    const { originalPrompt, previousAssistantText, sources = [], chatId, reason } = req.body;
    const user = req.user;

    // Check Daily Safety Limit Guardrails for Continuation (REMOVED)
    const { trackAIUsage } = await import("../cost/usageTracker");

    emitSse(res, "status", { step: "started", message: "Continuing answer..." });

    const trimmedPrevText = (previousAssistantText || "").slice(-6000);

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
          temperature: 0.1,
          maxOutputTokens: 12_288
        },
      }, ai, signal);

      stream = result.stream;
      modelUsed = result.modelUsed;
      if (result.warning) emitSse(res, "status", { step: "model_fallback", status: "working", message: "Completing with the backup AI model." });
    } catch (err: any) {
      throw new Error(`Continue stream failed: ${err.message}`);
    }

    let fullText = "";
    let chunkBuffer = "";
    let modelFinishReason: string | null = null;
    const continuationSanitizer = createAssistantStreamSanitizer();
    for await (const chunk of stream) {
      modelFinishReason = getModelFinishReason(chunk) || modelFinishReason;
      const text = chunk.text || "";
      if (text) {
        const safeText = continuationSanitizer.push(text);
        if (!safeText) continue;
        fullText += safeText;
        chunkBuffer += safeText;
        trace.totalChars += safeText.length;
        trace.tokenCount++;
        if (chunkBuffer.length >= 50 || /[\n\r\.\?!,;]/.test(chunkBuffer)) {
          emitSse(res, "token", { text: chunkBuffer });
          trace.lastEvent = "token";
          chunkBuffer = "";
        }
      }
    }
    const continuationTail = continuationSanitizer.flush();
    if (continuationTail) {
      fullText += continuationTail;
      chunkBuffer += continuationTail;
      trace.totalChars += continuationTail.length;
    }
    if (chunkBuffer.length > 0) {
      emitSse(res, "token", { text: chunkBuffer });
    }

    let completionAssessment = assessAnswerCompleteness({
      prompt: originalPrompt,
      answer: `${previousAssistantText || ""}\n${fullText}`,
      finishReason: modelFinishReason,
      mode: "continue",
    });
    let completionPasses = 0;
    while (completionAssessment.shouldContinue && completionPasses < 3 && !signal.aborted && !res.writableEnded) {
      completionPasses += 1;
      emitSse(res, "status", { step: "completion_recovery", status: "working", message: "Finishing the remaining answer sections", pass: completionPasses });
      const combinedAnswer = `${previousAssistantText || ""}\n${fullText}`.trim();
      try {
        const completion = await callGeminiWithFallback("final_answer", {
          model: "ignored",
          contents: [
            { role: "user", parts: [{ text: `Original request:\n${originalPrompt}` }] },
            { role: "model", parts: [{ text: combinedAnswer }] },
            { role: "user", parts: [{ text: buildContinuationInstruction({ originalPrompt, currentAnswer: combinedAnswer, assessment: completionAssessment }) }] },
          ],
          config: { temperature: 0.1, maxOutputTokens: 12_288 },
        }, ai);
        modelUsed = completion.modelUsed || modelUsed;
        const merged = mergeContinuationText(fullText, sanitizeAssistantText(completion.result.text || ""));
        const delta = merged.startsWith(fullText) ? merged.slice(fullText.length) : sanitizeAssistantText(completion.result.text || "");
        if (!delta.trim()) break;
        fullText = merged;
        emitSse(res, "token", { text: delta });
        trace.totalChars += delta.length;
        modelFinishReason = getModelFinishReason(completion.result) || "STOP";
        completionAssessment = assessAnswerCompleteness({
          prompt: originalPrompt,
          answer: `${previousAssistantText || ""}\n${fullText}`,
          finishReason: modelFinishReason,
          mode: "continue",
        });
      } catch (completionError: any) {
        console.warn("[CONTINUATION_COMPLETION_FAILED]", completionError?.message || completionError);
        break;
      }
    }

    trace.completed = completionAssessment.complete;
    trace.modelFinishReason = modelFinishReason || undefined;
    trace.completionPasses = completionPasses;
    trace.incompleteReasons = completionAssessment.reasons;

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
            updatedAt: new Date().toISOString(),
            answerCompleted: completionAssessment.complete,
            modelFinishReason: modelFinishReason || null,
            completionPasses: completionPasses,
            missingSubparts: completionAssessment.missingSubparts,
            incompleteReasons: completionAssessment.reasons,
          });
          trace.chatSaved = true;
        }
      }, null, res);
    }

    emitSse(res, "done", {
      ok: completionAssessment.complete,
      completed: completionAssessment.complete,
      requestId,
      chatSaved: trace.chatSaved,
      finishReason: completionAssessment.complete ? "complete" : "answer_incomplete",
      modelFinishReason: modelFinishReason || null,
      autoContinued: completionPasses > 0,
      completionPasses,
      canContinue: !completionAssessment.complete && !signal.aborted,
      missingSubparts: completionAssessment.missingSubparts,
      incompleteReasons: completionAssessment.reasons,
    });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } catch (err: any) {
    console.error("Continue Stream Error", err);
    trace.errorCode = err.code || "CONTINUE_FAILED";
    trace.errorMessage = err.message || String(err);
    emitSse(res, "error", { ok: false, error: "Internal operation failed.", recoverable: true, code: "CONTINUE_FAILED" });
    emitSse(res, "done", { ok: false, completed: false, requestId, chatSaved: false });
    trace.doneSent = true;
    trace.lastEvent = "done";
  } finally {
    clearInterval(heartbeatInterval);
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
