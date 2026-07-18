import { Router } from "express";
import { requireUser, getAdminBucket, getAdminDb } from "../firebase/admin";
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
    res.status(500).json({ error: "Internal operation failed." });
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
    res.status(500).json({ error: "Internal operation failed." });
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
    res.status(500).json({ error: "Internal operation failed." });
  }
});

// Mistake Notebook
router.get("/mistakes", async (req, res) => {
  try {
    const user = await requireUser(req);
    const snapshot = await getAdminDb().collection("users").doc(user.uid).collection("mistake_notebook")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    const bucket = getAdminBucket();
    const mistakes = await Promise.all(snapshot.docs.map(async (document: any) => {
      const data = document.data();
      let imageUrl: string | null = null;
      if (data.imageStoragePath) {
        try {
          [imageUrl] = await bucket.file(data.imageStoragePath).getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
        } catch (error) {
          console.warn("[mistakes] Could not sign image", { id: document.id, error: String(error) });
        }
      }
      return { id: document.id, ...data, imageUrl };
    }));
    res.json({ ok: true, mistakes });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

router.post("/mistake", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const { subject, lesson, questionText, errorText, imageStoragePath, imageMimeType, imageFileName } = req.body || {};
    const normalizedSubject = String(subject || "").trim().toUpperCase();
    const normalizedLesson = String(lesson || "").trim().slice(0, 180);
    const normalizedError = String(errorText || questionText || "").trim().slice(0, 8000);
    const normalizedImagePath = String(imageStoragePath || "").replace(/^\/+/, "");
    if (!["SFT", "ET", "ICT"].includes(normalizedSubject)) {
      return res.status(400).json({ ok: false, error: "Choose SFT, ET, or ICT." });
    }
    if (!normalizedLesson) {
      return res.status(400).json({ ok: false, error: "Lesson is required." });
    }
    if (!normalizedError && !normalizedImagePath) {
      return res.status(400).json({ ok: false, error: "Add error text or an image." });
    }
    if (normalizedImagePath && !normalizedImagePath.startsWith(`users/${user.uid}/images/`)) {
      return res.status(403).json({ ok: false, error: "Invalid mistake image path." });
    }
    
    const document = await db.collection("users").doc(user.uid).collection("mistake_notebook").add({
      uid: user.uid,
      subject: normalizedSubject,
      lesson: normalizedLesson,
      errorText: normalizedError,
      questionText: normalizedError,
      imageStoragePath: normalizedImagePath || null,
      imageMimeType: normalizedImagePath ? String(imageMimeType || "image/jpeg").slice(0, 100) : null,
      imageFileName: normalizedImagePath ? String(imageFileName || "mistake-image").slice(0, 180) : null,
      retryDate: new Date().toISOString(),
      repeatCount: 0,
      mastered: false,
      createdAt: new Date().toISOString()
    });
    
    res.json({ ok: true, id: document.id });
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
  }
});

export default router;
