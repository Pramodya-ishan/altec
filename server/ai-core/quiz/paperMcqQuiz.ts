import { getAdminDb } from "../../firebase/admin";
import { getConversationState, updateConversationState, type PaperMcqQuizSession } from "../../knowledge/conversationState";
import { cleanAssistantResponse, normalizeSinhalaUnicode } from "../../../shared/text/assistantText";
import { removeUndefinedDeep } from "../memory/chatSanitizer";

export type PaperMcqQuizStartIntent = {
  isQuizStart: true;
  year: string;
  subject: "SFT" | "ET" | "ICT";
  startQuestionNo: number;
  endQuestionNo: number;
};

export type PaperMcqQuizAction =
  | { kind: "answer"; optionNo: string }
  | { kind: "skip" }
  | { kind: "stop" }
  | { kind: "invalid" };

function normalizeSubjectText(value: string): "SFT" | "ET" | "ICT" | null {
  const text = value.toUpperCase();
  if (/\bSFT\b|SCIENCE\s+FOR\s+TECHNOLOGY|තාක්ෂණවේදය\s+සඳහා\s+විද්‍යාව/i.test(text)) return "SFT";
  if (/\bET\b|ENGINEERING\s+TECHNOLOGY|ඉංජිනේරු\s+තාක්ෂණවේදය/i.test(text)) return "ET";
  if (/\bICT\b|INFORMATION\s+(?:AND|&)\s+COMMUNICATION\s+TECHNOLOGY|තොරතුරු\s+හා\s+සන්නිවේදන/i.test(text)) return "ICT";
  return null;
}

export function detectPaperMcqQuizStart(prompt: string, activeSubject?: string | null): PaperMcqQuizStartIntent | null {
  const text = normalizeSinhalaUnicode(prompt).trim();
  const lower = text.toLowerCase();
  const year = text.match(/\b(20\d{2})\b/)?.[1] || null;
  const subject = normalizeSubjectText(text) || normalizeSubjectText(String(activeSubject || ""));
  const hasMcq = /\bmcq\b|බහුවරණ/i.test(text);
  const hasQuizFlow = /one\s*by\s*one|එකින්\s*එක|එක\s*එක|පිළිවෙළින්|wrdina|වැරදි|error\s*(?:log|book)|quiz/i.test(lower);
  const range = text.match(/\b([1-9]|[1-4]\d|50)\s*(?:සිට|ඉඳන්|ඉදන්|idn|indn|to|through|[-–—])\s*([1-9]|[1-4]\d|50)\b/i);

  if (!year || !subject || !hasMcq || !hasQuizFlow || !range) return null;
  const startQuestionNo = Number(range[1]);
  const endQuestionNo = Number(range[2]);
  if (startQuestionNo < 1 || endQuestionNo > 50 || startQuestionNo > endQuestionNo) return null;

  return { isQuizStart: true, year, subject, startQuestionNo, endQuestionNo };
}

function comparable(value: unknown): string {
  return normalizeSinhalaUnicode(value)
    .toLowerCase()
    .replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/, "")
    .replace(/[\s*_#>`~\-–—:;,.!?()[\]{}|/\\]+/g, " ")
    .trim();
}

export function parsePaperMcqQuizAction(prompt: string, session: PaperMcqQuizSession): PaperMcqQuizAction {
  const text = normalizeSinhalaUnicode(prompt).trim();
  const lower = text.toLowerCase();

  if (/^(?:stop|end|quit|cancel|නවත්වන්න|අවසන්|ඇති|එපා)$/i.test(lower)) return { kind: "stop" };
  if (/^(?:skip|pass|next|මඟහරින්න|පසුව|ඊළඟ)$/i.test(lower)) return { kind: "skip" };

  const numeric = text.match(/^\s*(?:(?:answer|option|ans|පිළිතුර)\s*[:=-]?\s*)?[\[(]?([1-5])[\])\].]?\s*$/i);
  if (numeric) return { kind: "answer", optionNo: numeric[1] };

  const answerText = comparable(text);
  if (answerText.length >= 2 && Array.isArray(session.options)) {
    const matches = session.options
      .map((option, index) => ({ optionNo: String(index + 1), text: comparable(option) }))
      .filter((item) => item.text && (item.text === answerText || item.text.includes(answerText) || answerText.includes(item.text)));
    if (matches.length === 1) return { kind: "answer", optionNo: matches[0].optionNo };
  }

  return { kind: "invalid" };
}

export async function getActivePaperMcqQuiz(uid: string): Promise<PaperMcqQuizSession | null> {
  const state = await getConversationState(uid);
  return state.quizSession?.active ? state.quizSession : null;
}

export async function beginPaperMcqQuiz(params: {
  uid: string;
  sourceId: string;
  storagePath?: string | null;
  downloadUrl?: string | null;
  title?: string | null;
  year: string;
  subject: string;
  startQuestionNo: number;
  endQuestionNo: number;
}) {
  const now = new Date().toISOString();
  const quizSession: PaperMcqQuizSession = {
    active: true,
    sourceId: params.sourceId,
    storagePath: params.storagePath || null,
    downloadUrl: params.downloadUrl || null,
    title: params.title || null,
    year: params.year,
    subject: params.subject,
    questionType: "MCQ",
    startQuestionNo: params.startQuestionNo,
    endQuestionNo: params.endQuestionNo,
    currentQuestionNo: params.startQuestionNo,
    awaitingAnswer: false,
    expectedOptionNo: null,
    expectedOptionText: null,
    questionText: null,
    options: [],
    explanationSinhala: null,
    lesson: null,
    pageNumber: null,
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    answeredCount: 0,
    startedAt: now,
    updatedAt: now,
  };
  await updateConversationState(params.uid, {
    selectedSourceId: params.sourceId,
    currentQuestionIndex: params.startQuestionNo,
    lastIntent: "paper_mcq_quiz",
    quizSession,
  });
  return quizSession;
}

function stripOptionPrefix(value: unknown, optionNo?: string | null) {
  let text = normalizeSinhalaUnicode(value).trim();
  if (optionNo) {
    const escaped = optionNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*(?:\\(\\s*${escaped}\\s*\\)|${escaped}[.)])\\s*`), "");
  }
  return text.trim();
}

export async function attachPaperMcqQuizQuestion(params: {
  uid: string;
  sourceId: string;
  year: string;
  subject: string;
  questionNo: number;
  pageNumber?: number | null;
  questionText: string;
  options: string[];
  optionNo: string;
  optionText?: string | null;
  explanationSinhala?: string | null;
  lesson?: string | null;
}) {
  const state = await getConversationState(params.uid);
  const current = state.quizSession;
  if (!current?.active || current.sourceId !== params.sourceId || current.currentQuestionNo !== params.questionNo) {
    return null;
  }

  const next: PaperMcqQuizSession = {
    ...current,
    awaitingAnswer: true,
    expectedOptionNo: params.optionNo,
    expectedOptionText: stripOptionPrefix(params.optionText || params.options[Number(params.optionNo) - 1] || "", params.optionNo),
    questionText: normalizeSinhalaUnicode(params.questionText).trim(),
    options: params.options.map((option) => normalizeSinhalaUnicode(option).trim()),
    explanationSinhala: params.explanationSinhala ? cleanAssistantResponse(params.explanationSinhala) : null,
    lesson: params.lesson ? normalizeSinhalaUnicode(params.lesson).trim() : null,
    pageNumber: params.pageNumber ?? null,
    updatedAt: new Date().toISOString(),
  };

  await updateConversationState(params.uid, {
    currentQuestionIndex: params.questionNo,
    quizSession: next,
  });
  return next;
}

function mistakeDocId(session: PaperMcqQuizSession) {
  const base = `${session.sourceId}_MCQ_${session.currentQuestionNo}`
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
  return base || `mcq_${session.currentQuestionNo}`;
}

async function saveWrongMcqAttempt(uid: string, session: PaperMcqQuizSession, selectedOptionNo: string) {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid).collection("mistake_notebook").doc(mistakeDocId(session));
  const now = new Date();
  const nextRevision = new Date(now);
  nextRevision.setDate(nextRevision.getDate() + 1);
  const selectedText = stripOptionPrefix(session.options?.[Number(selectedOptionNo) - 1] || "", selectedOptionNo);
  const correctText = stripOptionPrefix(session.expectedOptionText || session.options?.[Number(session.expectedOptionNo || "0") - 1] || "", session.expectedOptionNo);

  await db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? snapshot.data() || {} : {};
    const sameErrorCount = Number(existing.sameErrorCount || 0) + 1;
    transaction.set(ref, removeUndefinedDeep({
      uid,
      subject: session.subject,
      lesson: session.lesson || `${session.year} ${session.subject} Past Paper MCQ`,
      errorText: `Q${session.currentQuestionNo}: ${session.questionText || ""}\n\nStudent answer: (${selectedOptionNo}) ${selectedText}\nCorrect answer: (${session.expectedOptionNo}) ${correctText}`.trim(),
      questionText: session.questionText || "",
      options: session.options || [],
      studentAnswer: selectedOptionNo,
      studentAnswerText: selectedText || null,
      correctAnswer: session.expectedOptionNo,
      correctAnswerText: correctText || null,
      explanationSinhala: session.explanationSinhala || null,
      sourceId: session.sourceId,
      sourceTitle: session.title || null,
      pageNumber: session.pageNumber ?? null,
      year: session.year,
      questionNo: session.currentQuestionNo,
      questionType: "MCQ",
      errorReason: `Selected option ${selectedOptionNo} instead of ${session.expectedOptionNo}.`,
      sameErrorCount,
      lastStudentAnswer: selectedOptionNo,
      lastAttemptAt: now.toISOString(),
      retryDate: nextRevision.toISOString(),
      nextRevisionAt: nextRevision.toISOString(),
      repeatCount: Number(existing.repeatCount || 0),
      mastered: false,
      createdAt: existing.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      autoSavedFromQuiz: true,
    }), { merge: true });
  });

  return ref.id;
}

export async function evaluatePaperMcqQuizAnswer(params: {
  uid: string;
  session: PaperMcqQuizSession;
  action: PaperMcqQuizAction;
}) {
  const { uid, session, action } = params;
  if (!session.awaitingAnswer || !session.expectedOptionNo) {
    return {
      kind: "not_ready" as const,
      message: "වත්මන් MCQ එක තවම load වෙලා නැහැ. එම ප්‍රශ්නය නැවත load කරන්න.",
      session,
    };
  }

  if (action.kind === "stop") {
    const closed = { ...session, active: false, awaitingAnswer: false, updatedAt: new Date().toISOString() };
    await updateConversationState(uid, { quizSession: closed, lastIntent: "paper_mcq_quiz_stopped" });
    return { kind: "stopped" as const, session: closed };
  }

  if (action.kind === "invalid") {
    return {
      kind: "invalid" as const,
      message: `පිළිතුර ලෙස 1, 2, 3, 4 හෝ 5 යවන්න. Skip කිරීමට “skip”, අවසන් කිරීමට “stop” යවන්න.`,
      session,
    };
  }

  const selectedOptionNo = action.kind === "skip" ? null : action.optionNo;
  const isCorrect = selectedOptionNo === session.expectedOptionNo;
  let mistakeId: string | null = null;
  if (selectedOptionNo && !isCorrect) {
    mistakeId = await saveWrongMcqAttempt(uid, session, selectedOptionNo);
  }

  const completedNo = session.currentQuestionNo;
  const nextQuestionNo = completedNo + 1;
  const finished = nextQuestionNo > session.endQuestionNo;
  const updated: PaperMcqQuizSession = {
    ...session,
    active: !finished,
    currentQuestionNo: finished ? completedNo : nextQuestionNo,
    awaitingAnswer: false,
    expectedOptionNo: null,
    expectedOptionText: null,
    questionText: null,
    options: [],
    explanationSinhala: null,
    lesson: null,
    pageNumber: null,
    correctCount: session.correctCount + (isCorrect ? 1 : 0),
    wrongCount: session.wrongCount + (selectedOptionNo && !isCorrect ? 1 : 0),
    skippedCount: session.skippedCount + (action.kind === "skip" ? 1 : 0),
    answeredCount: session.answeredCount + (selectedOptionNo ? 1 : 0),
    updatedAt: new Date().toISOString(),
  };

  await updateConversationState(uid, {
    currentQuestionIndex: finished ? null : nextQuestionNo,
    lastIntent: finished ? "paper_mcq_quiz_completed" : "paper_mcq_quiz",
    quizSession: updated,
  });

  const correctText = stripOptionPrefix(session.expectedOptionText || "", session.expectedOptionNo);
  const explanation = cleanAssistantResponse(session.explanationSinhala || "");
  let feedback: string;
  if (action.kind === "skip") {
    feedback = `⏭️ **Q${completedNo} මඟහැරියා.**\n\n**නිවැරදි පිළිතුර:** (${session.expectedOptionNo})${correctText ? ` ${correctText}` : ""}`;
  } else if (isCorrect) {
    feedback = `✅ **නිවැරදියි — (${session.expectedOptionNo})${correctText ? ` ${correctText}` : ""}**`;
  } else {
    feedback = `❌ **වැරදියි. ඔබේ පිළිතුර: (${selectedOptionNo})**\n\n**නිවැරදි පිළිතුර:** (${session.expectedOptionNo})${correctText ? ` ${correctText}` : ""}\n\n📌 මෙම වැරැද්ද Error Log එකට ස්වයංක්‍රීයව සුරැකුණා.`;
  }
  if (explanation) feedback += `\n\n${explanation}`;

  return {
    kind: finished ? "finished" as const : "continue" as const,
    isCorrect,
    selectedOptionNo,
    correctOptionNo: session.expectedOptionNo,
    feedback,
    mistakeId,
    nextQuestionNo: finished ? null : nextQuestionNo,
    session: updated,
  };
}

export function formatPaperMcqQuizQuestion(params: {
  year: string;
  subject: string;
  questionNo: number;
  startQuestionNo: number;
  endQuestionNo: number;
  questionText: unknown;
  options: unknown[];
  feedbackPrefix?: string | null;
}) {
  const questionText = normalizeSinhalaUnicode(params.questionText).trim();
  const options = Array.isArray(params.options)
    ? params.options.map((option) => normalizeSinhalaUnicode(option).trim()).filter(Boolean)
    : [];
  const optionLines = options.map((option, index) => {
    const clean = option.replace(/^\s*(?:\(\s*[1-5]\s*\)|[1-5][.)])\s*/, "");
    return `(${index + 1}) ${clean}`;
  });
  const progress = params.startQuestionNo === 1 && params.endQuestionNo === 50
    ? `${params.questionNo}/50`
    : `${params.questionNo} (${params.startQuestionNo}–${params.endQuestionNo})`;
  const blocks = [
    params.feedbackPrefix ? cleanAssistantResponse(params.feedbackPrefix) : "",
    `### ${params.year} ${params.subject} MCQ ${progress}`,
    questionText,
    optionLines.join("\n"),
    `**ඔබේ පිළිතුර ලෙස 1–5 අතර අංකය පමණක් යවන්න.**`,
  ].filter(Boolean);
  return cleanAssistantResponse(blocks.join("\n\n"));
}
