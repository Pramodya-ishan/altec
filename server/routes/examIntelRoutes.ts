import { Router } from "express";
import { requireUser, requireAdmin, getAdminDb } from "../firebase/admin";
import { buildExamIndex } from "../ai-core/pdf/indexing";
import { rankTopicProbability } from "../ai-core/exam-intel/probabilityRanker";
import { detectUnaskedTopics } from "../ai-core/exam-intel/unaskedTopicDetector";
import { generatePredictedPaper } from "../ai-core/exam-intel/predictedPaper";
import { backtestPredictionModel } from "../ai-core/exam-intel/backtest";
import { defaultPredictionSettings, mergePredictionSettings, normalizePredictionSubject } from "../ai-core/exam-intel/predictionPolicy";
import { loadSubjectSyllabusCorpus } from "../ai-core/exam-intel/syllabusCorpus";

const router = Router();

// Background job to build exam index
router.post("/build-index", async (req, res) => {
  try {
    await requireAdmin(req);
    // Trigger background job (we'll run it synchronously for simplicity in this demo environment, 
    // but usually you'd use a queue)
    const results = await buildExamIndex();
    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: "Internal operation failed." });
  }
});

// Get subject pattern report
router.get("/report", async (req, res) => {
  try {
    await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    
    const db = getAdminDb();
    const reportSnap = await db.collection("exam_pattern_reports").doc(subject as string).get();
    
    if (reportSnap.exists) {
      res.json(reportSnap.data());
    } else {
      // If no report, maybe generate one or return empty
      res.json({ subject, message: "Report not yet generated for this subject" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
  }
});

// Get probability ranking
router.get("/probability", async (req, res) => {
  try {
    await requireUser(req);
    const { subject, targetYear } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    
    const normalizedSubject = normalizePredictionSubject(subject);
    const db = getAdminDb();
    const settingsSnapshot = await db.collection("prediction_settings").doc(normalizedSubject).get().catch(() => null);
    const settings = mergePredictionSettings(normalizedSubject, settingsSnapshot?.exists ? settingsSnapshot.data() : {}, { targetYear: Number(targetYear || 2026) });
    const rankings = await rankTopicProbability(normalizedSubject, settings.targetYear, settings);
    res.json(rankings);
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
  }
});

router.get("/settings", async (req, res) => {
  try {
    await requireUser(req);
    const subject = normalizePredictionSubject(req.query.subject || "SFT");
    const snapshot = await getAdminDb().collection("prediction_settings").doc(subject).get();
    return res.json({ ok: true, settings: mergePredictionSettings(subject, snapshot.exists ? snapshot.data() : defaultPredictionSettings(subject)) });
  } catch (err: any) {
    return res.status(Number(err?.status) || 500).json({ ok: false, code: err?.code || "PREDICTION_SETTINGS_LOAD_FAILED", message: err?.message || "Prediction settings could not be loaded." });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const subject = normalizePredictionSubject(req.body?.subject || "SFT");
    const ref = getAdminDb().collection("prediction_settings").doc(subject);
    const snapshot = await ref.get();
    const settings = mergePredictionSettings(subject, snapshot.exists ? snapshot.data() : {}, req.body?.settings || req.body);
    const saved = { ...settings, updatedAt: new Date().toISOString(), updatedBy: admin.uid };
    await ref.set(saved, { merge: true });
    return res.json({ ok: true, settings: saved });
  } catch (err: any) {
    return res.status(Number(err?.status) || (String(err?.message || "").includes("Unauthorized") ? 401 : 500)).json({ ok: false, code: err?.code || "PREDICTION_SETTINGS_SAVE_FAILED", message: err?.message || "Prediction settings could not be saved." });
  }
});

router.get("/backtest", async (req, res) => {
  try {
    await requireUser(req);
    const subject = normalizePredictionSubject(req.query.subject || "SFT");
    const db = getAdminDb();
    const [questionSnapshot, syllabusSnapshot] = await Promise.all([
      db.collection("exam_question_index").where("subject", "==", subject).limit(2500).get(),
      db.collection("syllabus_nodes").where("subject", "==", subject).limit(1000).get(),
    ]);
    const result = backtestPredictionModel({
      subject,
      questions: questionSnapshot.docs.map((document: any) => ({ id: document.id, ...document.data() })),
      syllabusNodes: syllabusSnapshot.docs.map((document: any) => ({ id: document.id, ...document.data() })),
      startYear: Number(req.query.startYear || 0) || undefined,
      endYear: Number(req.query.endYear || 0) || undefined,
      topK: Number(req.query.topK || 10),
    });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(Number(err?.status) || 500).json({ ok: false, code: err?.code || "PREDICTION_BACKTEST_FAILED", message: err?.message || "Prediction backtest could not be calculated." });
  }
});

router.get("/syllabus-coverage", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = normalizePredictionSubject(req.query.subject || "SFT");
    const corpus = await loadSubjectSyllabusCorpus({ uid: user.uid, subject, isAdmin: user.admin === true || user.roles?.includes?.("admin") });
    return res.json({ ok: true, subject, coverage: corpus.coverage, sources: corpus.sources, nodes: corpus.syllabusNodes.length });
  } catch (err: any) {
    return res.status(Number(err?.status) || 500).json({ ok: false, code: err?.code || "SYLLABUS_COVERAGE_FAILED", message: err?.message || "Syllabus coverage could not be loaded." });
  }
});

// Get unasked topics
router.get("/unasked-topics", async (req, res) => {
  try {
    await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    
    const data = await detectUnaskedTopics(subject as string);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
  }
});

// Generate predicted paper
router.post("/predicted-paper", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { subject, mode, targetMarks, includeAnswers, targetYear, paperType, questionCount, includeImages, maxImageQuestions, committeeSize, settings } = req.body;
    
    const paper = await generatePredictedPaper({
      subject,
      mode,
      targetMarks,
      includeAnswers,
      studentUid: user.uid,
      user,
      targetYear,
      paperType,
      questionCount,
      includeImages,
      maxImageQuestions,
      committeeSize,
      settings,
    });
    
    res.json(paper);
  } catch (err: any) {
    res.status(Number(err?.status) || 500).json({ ok: false, code: err?.code || "PREDICTED_PAPER_FAILED", error: err?.message || "Predicted revision paper could not be generated." });
  }
});

export default router;
