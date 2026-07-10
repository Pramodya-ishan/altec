import { Router } from "express";
import { diagnoseStudent } from "./student/studentDiagnosis";
import { generateWarPlan } from "./study/warPlan";
import { updateStudentForecast } from "./study/mockForecast";
import { addMistake, getTodayRetries, markMistakeMastered, scheduleRetry } from "./study/mistakeNotebook";
import { buildExamIndex } from "./pdf/indexing";
import { buildPatternReport } from "./exam-intel/patternAnalyzer";
import { rankTopicProbability } from "./exam-intel/probabilityRanker";
import { detectUnaskedTopics } from "./exam-intel/unaskedTopicDetector";
import { generatePredictedPaper } from "./exam-intel/predictedPaper";
import { generateStudentWeeklyReport } from "./reports/studentWeeklyReport";
import { requireUser } from "../firebase/admin";

const router = Router();

router.get("/student/diagnosis", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Missing subject" });
    const result = await diagnoseStudent(user.uid, String(subject));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/study/war-plan", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await generateWarPlan({ ...req.body, uid: user.uid });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/study/mock-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await updateStudentForecast(user.uid);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/mistakes", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await getTodayRetries(user.uid);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/mistakes", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await addMistake(user.uid, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exam-intel/build-index", async (req, res) => {
  try {
    const result = await buildExamIndex();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exam-intel/report", async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await buildPatternReport(String(subject));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exam-intel/probability", async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await rankTopicProbability(String(subject));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exam-intel/unasked", async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await detectUnaskedTopics(String(subject));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exam-intel/predicted-paper", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await generatePredictedPaper({ ...req.body, uid: user.uid });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reports/student-weekly", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await generateStudentWeeklyReport(user.uid);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/repair-data", async (req, res) => {
  try {
    const user = await requireUser(req);
    if (user.email !== "26002ishan@gmail.com") {
      return res.status(403).json({ error: "Access Denied" });
    }
    const { getAdminDb } = await import("../../server/firebase/admin");
    const db = getAdminDb();
    
    // Repair example: Delete missing chunks, fix empty arrays
    const snapshot = await db.collection("exam_question_index").get();
    let deletedCount = 0;
    const batch = db.batch();
    
    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      if (!data.questionText && !data.sourceId) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });
    
    if (deletedCount > 0) {
      await batch.commit();
    }
    
    res.json({ message: `Repair finished. Deleted ${deletedCount} invalid documents.`, ok: true });
  } catch (err: any) {
    console.error("Repair error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
