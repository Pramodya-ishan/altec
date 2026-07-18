import { Router } from "express";
import { getAdminDb, requireUser } from "../firebase/admin";
import {
  analyseLearningAttempt,
  buildRevisionPlan,
  gradeAnswer,
  type LearningAttemptInput,
  type RevisionItem,
} from "../learning/learningEngine";

const router = Router();

function safeString(value: unknown, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

router.post("/attempts", async (req, res) => {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const input: LearningAttemptInput = {
      subject: safeString(body.subject, 20).toUpperCase(),
      lesson: safeString(body.lesson, 180),
      questionId: safeString(body.questionId, 220) || null,
      questionType: safeString(body.questionType, 40) || "MCQ",
      correct: Boolean(body.correct),
      selectedAnswer: safeString(body.selectedAnswer, 1000) || null,
      correctAnswer: safeString(body.correctAnswer, 1000) || null,
      responseTimeMs: Number(body.responseTimeMs || 0),
      confidence: body.confidence == null ? null : Number(body.confidence),
      working: safeString(body.working, 8000) || null,
      expectedUnit: safeString(body.expectedUnit, 50) || null,
      submittedUnit: safeString(body.submittedUnit, 50) || null,
      expectedSignificantFigures: body.expectedSignificantFigures == null ? null : Number(body.expectedSignificantFigures),
      submittedSignificantFigures: body.submittedSignificantFigures == null ? null : Number(body.submittedSignificantFigures),
      previousErrorCount: Number(body.previousErrorCount || 0),
      difficulty: body.difficulty == null ? null : Number(body.difficulty),
    };

    if (!input.subject || !input.lesson) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "subject and lesson are required" });
    }

    const analysis = analyseLearningAttempt(input);
    const db = getAdminDb();
    const now = new Date().toISOString();
    const attemptRef = db.collection("users").doc(user.uid).collection("answer_history").doc();
    await attemptRef.set({
      id: attemptRef.id,
      uid: user.uid,
      ...input,
      ...analysis,
      createdAt: now,
      updatedAt: now,
    });

    if (!input.correct) {
      const mistakeKey = `${input.subject}:${input.questionId || input.lesson}`.replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 300);
      const mistakeRef = db.collection("users").doc(user.uid).collection("mistake_notebook").doc(mistakeKey);
      const existing = await mistakeRef.get();
      const previous = existing.exists ? existing.data() || {} : {};
      await mistakeRef.set({
        id: mistakeKey,
        uid: user.uid,
        subject: input.subject,
        lesson: input.lesson,
        questionId: input.questionId,
        questionType: input.questionType,
        studentAnswer: input.selectedAnswer,
        correctAnswer: input.correctAnswer,
        mistakeTypes: analysis.mistakeTypes,
        guessed: analysis.guessed,
        sameErrorCount: Number(previous.sameErrorCount || previous.repeatCount || 0) + 1,
        intervalDays: analysis.intervalDays,
        easeFactor: analysis.easeFactor,
        nextReviewAt: analysis.nextReviewAt,
        lastAttemptAt: now,
        mastered: false,
        createdAt: previous.createdAt || now,
        updatedAt: now,
      }, { merge: true });
    }

    return res.json({ ok: true, attemptId: attemptRef.id, analysis });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "ATTEMPT_SAVE_FAILED", message: "The operation failed. Please try again." });
  }
});

router.get("/revision-queue", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = safeString(req.query.subject, 20).toUpperCase();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
    const snap = await getAdminDb().collection("users").doc(user.uid).collection("mistake_notebook")
      .orderBy("updatedAt", "desc")
      .limit(250)
      .get();
    const now = Date.now();
    const items = snap.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((item: any) => !subject || String(item.subject || "").toUpperCase() === subject)
      .map((item: any) => ({
        ...item,
        due: !item.nextReviewAt || new Date(item.nextReviewAt).getTime() <= now,
        priorityScore: Math.min(100, Number(item.sameErrorCount || item.repeatCount || 1) * 15 + (item.mastered ? 0 : 30)),
      }))
      .sort((a: any, b: any) => Number(b.due) - Number(a.due) || b.priorityScore - a.priorityScore)
      .slice(0, limit);
    return res.json({ ok: true, items, total: items.length });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "REVISION_QUEUE_FAILED", message: "The operation failed. Please try again." });
  }
});

router.post("/revision-plan", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const snap = await db.collection("users").doc(user.uid).collection("mistake_notebook").limit(300).get();
    const items: RevisionItem[] = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        subject: String(data.subject || "SFT"),
        lesson: String(data.lesson || "Unknown lesson"),
        weaknessScore: Math.min(100, 35 + Number(data.sameErrorCount || data.repeatCount || 1) * 12),
        errorCount: Number(data.sameErrorCount || data.repeatCount || 1),
        lastAttemptAt: data.lastAttemptAt || data.updatedAt || null,
        nextReviewAt: data.nextReviewAt || null,
        estimatedMinutes: Number(data.estimatedMinutes || 25),
      };
    });
    const days = Number(req.body?.days || 7);
    const dailyMinutes = Number(req.body?.dailyMinutes || 120);
    const examDate = req.body?.examDate ? new Date(req.body.examDate) : null;
    const plan = buildRevisionPlan(items, { days, dailyMinutes, examDate });
    const planRef = db.collection("users").doc(user.uid).collection("revision_plans").doc();
    await planRef.set({ id: planRef.id, days, dailyMinutes, examDate: examDate?.toISOString() || null, plan, createdAt: new Date().toISOString() });
    return res.json({ ok: true, planId: planRef.id, plan });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "REVISION_PLAN_FAILED", message: "The operation failed. Please try again." });
  }
});

router.post("/grade", async (req, res) => {
  try {
    await requireUser(req);
    const body = req.body || {};
    if (!Array.isArray(body.markingPoints) || !Number.isFinite(Number(body.maxMarks))) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "markingPoints and maxMarks are required" });
    }
    const result = gradeAnswer({
      studentAnswer: safeString(body.studentAnswer, 30_000),
      modelAnswer: safeString(body.modelAnswer, 30_000) || null,
      markingPoints: body.markingPoints,
      maxMarks: Number(body.maxMarks),
      expectedUnit: safeString(body.expectedUnit, 50) || null,
      submittedUnit: safeString(body.submittedUnit, 50) || null,
      expectedSignificantFigures: body.expectedSignificantFigures == null ? null : Number(body.expectedSignificantFigures),
      submittedSignificantFigures: body.submittedSignificantFigures == null ? null : Number(body.submittedSignificantFigures),
    });
    return res.json({ ok: true, result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "ANSWER_GRADING_FAILED", message: "The operation failed. Please try again." });
  }
});

router.get("/daily-quiz", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = safeString(req.query.subject || "SFT", 20).toUpperCase();
    const db = getAdminDb();
    const mistakesSnap = await db.collection("users").doc(user.uid).collection("mistake_notebook").limit(100).get();
    const weakLessons = [...new Set(mistakesSnap.docs.map((doc: any) => String(doc.data().lesson || "")).filter(Boolean))].slice(0, 5);

    let query: any = db.collection("exam_question_index").where("subject", "==", subject).where("questionType", "==", "MCQ").limit(30);
    const questionSnap = await query.get();
    const questions = questionSnap.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => Number(weakLessons.includes(String(b.lesson))) - Number(weakLessons.includes(String(a.lesson))))
      .slice(0, 5)
      .map((question: any) => ({
        id: question.id,
        questionNo: question.questionNo,
        questionText: question.questionText,
        options: question.options || [],
        lesson: question.lesson,
        pageNumber: question.pageNumber || null,
        sourceId: question.sourceId,
        // Do not expose the correct answer before submission.
      }));
    return res.json({ ok: true, subject, weakLessons, questions });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "DAILY_QUIZ_FAILED", message: "The operation failed. Please try again." });
  }
});

router.post("/bookmarks", async (req, res) => {
  try {
    const user = await requireUser(req);
    const body = req.body || {};
    const questionId = safeString(body.questionId, 300);
    if (!questionId) return res.status(400).json({ ok: false, message: "questionId is required" });
    const ref = getAdminDb().collection("users").doc(user.uid).collection("question_bookmarks").doc(questionId.replace(/[^A-Za-z0-9:_-]/g, "_"));
    await ref.set({
      id: ref.id,
      uid: user.uid,
      questionId,
      sourceId: safeString(body.sourceId, 300) || null,
      subject: safeString(body.subject, 20).toUpperCase() || null,
      lesson: safeString(body.lesson, 180) || null,
      difficult: Boolean(body.difficult),
      note: safeString(body.note, 2000) || null,
      updatedAt: new Date().toISOString(),
      createdAt: body.createdAt || new Date().toISOString(),
    }, { merge: true });
    return res.json({ ok: true, id: ref.id });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "BOOKMARK_SAVE_FAILED", message: "The operation failed. Please try again." });
  }
});

export default router;
