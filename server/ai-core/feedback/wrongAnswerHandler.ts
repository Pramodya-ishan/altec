import { getAdminDb } from "../../firebase/admin";

export async function handleWrongAnswerFeedback(params: {
  uid: string;
  sourceId: string;
  questionType: string;
  questionNo: string;
  reason?: string;
  originalPrompt?: string;
  badAnswer?: string;
  mode?: string;
  year?: string;
  subject?: string;
}) {
  const { uid, sourceId, questionType, questionNo, reason, originalPrompt, badAnswer, mode, year, subject } = params;
  const db = getAdminDb();
  
  const cacheId = `${sourceId}_${questionType || 'MCQ'}_${questionNo}`.replace(/\//g, "_");
  
  // 1. Mark cache as rejected
  const cacheRef = db.collection("pdf_question_cache").doc(cacheId);
  const cacheDoc = await cacheRef.get();
  const currentFeedbackCount = cacheDoc.data()?.feedbackCount || 0;
  
  await cacheRef.set({
    rejected: true,
    validationStatus: "rejected",
    lastFeedback: reason || "User marked as wrong",
    feedbackCount: currentFeedbackCount + 1,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  
  // 2. Add to ai_feedback collection
  const feedbackId = `FB_${Date.now()}_${uid}`;
  await db.collection("ai_feedback").doc(feedbackId).set({
    uid,
    originalPrompt: originalPrompt || "",
    badAnswer: badAnswer || "",
    reason: reason || "User marked as wrong",
    mode: mode || "paper_question_qa",
    sourceId,
    year: year || "",
    subject: subject || "",
    questionNo,
    createdAt: new Date().toISOString(),
    status: "needs_review"
  });
  
  console.info(`[WrongAnswerHandler] Quarantined ${cacheId} and added to ai_feedback queue.`);
  return { ok: true, message: "Feedback recorded. Question quarantined for admin review." };
}
