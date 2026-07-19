import { Router } from "express";
import { requireUser, getAdminBucket, getAdminDb } from "../firebase/admin";
import { diagnoseStudent } from "../ai-core/student/studentDiagnosis";
import { generateWarPlan } from "../ai-core/study/warPlan";
import { loadMistakeRecords } from "../firebase/mistakeStore";
import { invalidateUserAIContext } from "../firebase/userContext";

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
    const records = await loadMistakeRecords(user.uid, user.email, 100);
    // The browser retrieves image bytes through the authenticated endpoint
    // below. This works even when the server account cannot sign GCS URLs.
    const mistakes = records.map((record) => ({
      ...record,
      hasImage: Boolean(record.imageStoragePath),
      imageEndpoint: record.imageStoragePath
        ? `/api/student/mistakes/${encodeURIComponent(record.id)}/image?owner=${encodeURIComponent(record.ownerPath || "uid")}`
        : null,
    }));
    res.json({ ok: true, mistakes });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

router.get("/mistakes/:mistakeId/image", async (req, res) => {
  try {
    const user = await requireUser(req);
    const records = await loadMistakeRecords(user.uid, user.email, 200);
    const requestedOwner = String(req.query.owner || "");
    const record = records.find((candidate) => String(candidate.id) === String(req.params.mistakeId)
      && (!requestedOwner || String(candidate.ownerPath || "uid") === requestedOwner));
    if (!record?.imageStoragePath) {
      return res.status(404).json({ ok: false, code: "MISTAKE_IMAGE_NOT_FOUND", error: "Saved image was not found." });
    }
    const [bytes] = await getAdminBucket().file(String(record.imageStoragePath)).download();
    if (!bytes?.length) {
      return res.status(404).json({ ok: false, code: "MISTAKE_IMAGE_EMPTY", error: "Saved image is empty." });
    }
    const mimeType = ["image/png", "image/jpeg", "image/webp"].includes(String(record.imageMimeType || ""))
      ? String(record.imageMimeType)
      : "image/jpeg";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    return res.send(bytes);
  } catch (err: any) {
    console.error("[mistakes] Could not serve saved image", { id: req.params.mistakeId, error: String(err) });
    return res.status(500).json({ ok: false, code: "MISTAKE_IMAGE_READ_FAILED", error: "Saved image could not be opened." });
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    invalidateUserAIContext(user.uid);
    res.json({ ok: true, id: document.id });
  } catch (err: any) {
    res.status(500).json({ error: "Internal operation failed." });
  }
});

export default router;
