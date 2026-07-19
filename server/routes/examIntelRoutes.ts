import { Router } from "express";
import { requireUser, requireAdmin, getAdminDb } from "../firebase/admin";
import { buildExamIndex } from "../ai-core/pdf/indexing";
import { rankTopicProbability } from "../ai-core/exam-intel/probabilityRanker";
import { detectUnaskedTopics } from "../ai-core/exam-intel/unaskedTopicDetector";
import { generatePredictedPaper } from "../ai-core/exam-intel/predictedPaper";

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
    
    const rankings = await rankTopicProbability(subject as string, Number(targetYear || 2026));
    res.json(rankings);
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
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
    const { subject, mode, targetMarks, includeAnswers } = req.body;
    
    const paper = await generatePredictedPaper({
      subject,
      mode,
      targetMarks,
      includeAnswers,
      studentUid: user.uid
    });
    
    res.json(paper);
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
  }
});

export default router;
