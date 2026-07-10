import { Router } from "express";
import { requireUser, getAdminDb } from "../firebase/admin";
import { diagnoseStudent } from "../ai-core/student/studentDiagnosis";
import { generateWarPlan } from "../ai-core/study/warPlan";

const router = Router();

// Student Diagnosis
router.get("/diagnosis", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { subject } = req.query;
    if (!subject) return res.status(400).json({ error: "Subject is required" });
    
    const diagnosis = await diagnoseStudent(user.uid, subject as string);
    res.json(diagnosis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate 30-Day War Plan
router.post("/war-plan", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { target, days, dailyHours, subjects, examDates } = req.body;
    
    const plan = await generateWarPlan({
      uid: user.uid,
      target,
      days,
      dailyHours,
      subjects,
      examDates
    });
    
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record Mock Result
router.post("/mock-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const { subject, date, mcqMarks, structuredMarks, essayMarks, totalMarks, timeTaken, weakLessons } = req.body;
    
    const resultRef = await db.collection("users").doc(user.uid).collection("mock_results").add({
      subject,
      date: date || new Date().toISOString(),
      mcqMarks,
      structuredMarks,
      essayMarks,
      totalMarks,
      timeTaken,
      weakLessons,
      createdAt: new Date().toISOString()
    });
    
    // Update forecast (simplified)
    const currentMarkEstimate = totalMarks; // Simple logic for now
    await db.collection("users").doc(user.uid).collection("forecasts").add({
      uid: user.uid,
      currentMarkEstimate,
      forecast7Day: currentMarkEstimate + 5,
      forecast30Day: currentMarkEstimate + 15,
      a3Chance: currentMarkEstimate > 50 ? "Medium" : "Low",
      mustFix: weakLessons || [],
      updatedAt: new Date().toISOString()
    });
    
    res.json({ ok: true, id: resultRef.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mistake Notebook
router.post("/mistake", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const { subject, lesson, subtopic, questionType, questionText, userAnswer, correctAnswer, mistakeType, explanation } = req.body;
    
    await db.collection("users").doc(user.uid).collection("mistake_notebook").add({
      uid: user.uid,
      subject,
      lesson,
      subtopic,
      questionType,
      questionText,
      userAnswer,
      correctAnswer,
      mistakeType,
      explanation,
      retryDate: new Date().toISOString(),
      repeatCount: 0,
      mastered: false,
      createdAt: new Date().toISOString()
    });
    
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
