import express from "express";
import { requireUser, getAdminDb } from "../firebase/admin";
import { processAIRequest } from "./respond";
import { AI_MODELS, getAIClient, getModelFallbackChain, prepareGoogleCredentials } from "./client";
import { retrieveRelevantKnowledge } from "../knowledge/retrieve";
import { pastPapersData } from "../../src/data/pastPapersData";

export const aiRoutes = express.Router();

// Self Test endpoint
aiRoutes.get("/self-test", async (req, res) => {
  const result: any = {
    ok: true,
    authPath: "vertex-ai-adc",
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    models: {
      fast: AI_MODELS.fast,
      default: AI_MODELS.default,
      pro: AI_MODELS.pro,
      image: AI_MODELS.image,
    },
    searchGroundingEnabled: process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true",
    textModelOk: false,
    imageModelConfigured: Boolean(AI_MODELS.image),
    firestoreContextOk: false,
    knowledgeRetrievalOk: false,
  };
  try {
    prepareGoogleCredentials();
    const ai = getAIClient();
    let text = "";
    for (const model of getModelFallbackChain(AI_MODELS.fast)) {
      try {
        const response = await ai.models.generateContent({ model, contents: "Reply only: OK" });
        text = response.text || "";
        result.textModelOk = true;
        result.textModelUsed = model;
        result.text = text;
        break;
      } catch (error: any) {
        result.lastTextModelError = error.message;
      }
    }

    try {
      await getAdminDb().listCollections();
      result.firestoreContextOk = true;
    } catch (error: any) {
      result.firestoreError = error.message;
    }

    const chunks = await retrieveRelevantKnowledge({
      prompt: "SFT ET ICT syllabus progress",
      activeSubject: "sft",
      mode: "self-test",
      limit: 3,
    });
    result.knowledgeRetrievalOk = chunks.length > 0;
    result.knowledgeChunksRetrieved = chunks.length;

    if (!result.textModelOk) result.ok = false;
    res.status(result.ok ? 200 : 500).json(result);
  } catch (error: any) {
    result.ok = false;
    result.error = error.message;
    res.status(500).json(result);
  }
});

// Debug Context endpoint
aiRoutes.post("/debug-context", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { loadUserAIContext } = await import("../firebase/userContext");
    const context = await loadUserAIContext(user.uid, user.email);
    const knowledgeChunks = await retrieveRelevantKnowledge({
      prompt: req.body?.prompt || "progress weak lessons syllabus",
      activeSubject: req.body?.activeSubject,
      mode: req.body?.mode || "debug",
      uid: user.uid,
      email: user.email,
      userContext: context,
      limit: 8,
    });
    
    res.json({
      ok: true,
      uid: user.uid,
      email: user.email || null,
      emailMasked: (user.email || "").replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      oldPathFound: context.diagnostics?.oldPathFound || false,
      newPathFound: context.diagnostics?.newPathFound || false,
      migratedLegacyProgress: context.diagnostics?.migratedLegacyProgress || false,
      loadedProfileFields: Object.keys(context.profile || {}),
      progressRecordsChecked: context.diagnostics?.progressRecordsChecked || 0,
      lessonHistoryCount: context.diagnostics?.lessonHistoryCount || 0,
      paperMarksCount: context.diagnostics?.paperMarksCount || 0,
      questionMarksCount: context.diagnostics?.questionMarksCount || 0,
      knowledgeChunksRetrieved: knowledgeChunks.length,
      weakLessons: context.weakLessons || [],
      latestZ: context.latestZ,
      subjectZScores: context.subjectZScores,
      selectedMode: req.body.mode || 'auto',
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

import { aiRespondStream } from "./respondStream";

aiRoutes.post("/respond-stream", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    await aiRespondStream(req, res);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Main Respond endpoint
aiRoutes.post("/respond", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    if (req.body.mode === 'image_generation') {
        const { generateEducationalImage } = await import("../image/generate");
        const result = await generateEducationalImage(req);
        if (!result.ok) res.status(500).json(result);
        else res.json(result);
        return;
    }

    const result = await processAIRequest(req);
    if (!result.ok) {
       res.status((result as any).code === 'QUOTA_EXCEEDED' ? 429 : 500).json(result);
    } else {
       res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Wrappers for old endpoints
aiRoutes.post("/chat", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

aiRoutes.post("/gemini-chat", async (req, res) => {
  try {
    // If not authenticated properly, try bypass or throw
    const user = await requireUser(req).catch(() => {
        if(process.env.DEV_BYPASS_AUTH === 'true') {
           return { uid: 'dev-user-id', email: 'dev@example.com', name: 'Dev User' };
        }
        throw new Error("Unauthorized");
    });
    
    (req as any).user = user;
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

aiRoutes.post("/notebook-quiz", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    req.body.mode = 'quiz_generation';
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/chat-history
aiRoutes.get("/chat-history", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const userUidRef = db.collection("users").doc(user.uid);
    
    const [uidSnap, emailSnap] = await Promise.all([
      userUidRef.collection("chat_history").orderBy("createdAt", "asc").limit(100).get().catch(() => ({ docs: [] })),
      user.email ? db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").orderBy("createdAt", "asc").limit(100).get().catch(() => ({ docs: [] })) : { docs: [] }
    ]);

    const docs = [...(uidSnap as any).docs, ...(emailSnap as any).docs];
    const chatHistory = Array.from(new Map(docs.map(d => [d.id, { id: d.id, ...d.data() }])).values())
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json({ ok: true, chatHistory });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/chat-history
aiRoutes.post("/chat-history", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { role, text, mode, subject } = req.body;
    if (!role || !text) {
      return res.status(400).json({ ok: false, error: "Role and text are required" });
    }

    const db = getAdminDb();
    const userUidRef = db.collection("users").doc(user.uid);
    const docRef = userUidRef.collection("chat_history").doc();
    const messageData = {
      role,
      text,
      content: text,
      mode: mode || "auto",
      subject: subject || null,
      createdAt: new Date().toISOString()
    };
    await docRef.set(messageData);

    // Also mirror to email if email path exists
    if (user.email) {
      await db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").doc(docRef.id).set(messageData).catch(() => null);
    }

    res.json({ ok: true, id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/chat-history/clear
aiRoutes.post("/chat-history/clear", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const batch = db.batch();
    
    const uidSnap = await db.collection("users").doc(user.uid).collection("chat_history").get().catch(() => ({ docs: [] }));
    uidSnap.docs.forEach((doc: any) => batch.delete(doc.ref));

    if (user.email) {
      const emailSnap = await db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").get().catch(() => ({ docs: [] }));
      emailSnap.docs.forEach((doc: any) => batch.delete(doc.ref));
    }

    await batch.commit();
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/image/generate
aiRoutes.post("/image/generate", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    const { generateEducationalImage } = await import("../image/generate");
    const result = await generateEducationalImage(req);
    if (!result.ok) {
      res.status(500).json(result);
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/ai/image
aiRoutes.post("/ai/image", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    const { generateEducationalImage } = await import("../image/generate");
    const result = await generateEducationalImage(req);
    if (!result.ok) {
      res.status(500).json(result);
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/past-papers/search
aiRoutes.post("/past-papers/search", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    const { searchPastPapers } = await import("../pastPapers/search");
    await searchPastPapers(req, res);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

function extractJsonObject(text: string) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try {
      return JSON.parse(fenced.trim());
    } catch {}
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {}
  }
  return null;
}

function normalizeQuizQuestion(question: any, index: number, subject: string, topic: string) {
  const options = Array.isArray(question.options) && question.options.length >= 2
    ? question.options.map((option: any) => String(option))
    : ["Correct", "Incorrect", "Needs revision", "Not enough data"];
  const answerText = String(question.answer ?? options[0]);
  let correctIndex = options.findIndex((option: string) => option.trim().toLowerCase() === answerText.trim().toLowerCase());
  if (typeof question.correctIndex === "number") correctIndex = question.correctIndex;
  if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

  return {
    type: question.type || "mcq",
    question: String(question.question || `${subject.toUpperCase()} ${topic} revision question ${index + 1}`),
    options,
    answer: options[correctIndex],
    correctIndex,
    explanation: String(question.explanation || "Review the referenced syllabus chunk and retry the question."),
    marks: Number(question.marks || 1),
    sourceRefs: Array.isArray(question.sourceRefs) ? question.sourceRefs : [],
  };
}

function buildFallbackQuiz(subject: string, topic: string, chunks: any[]) {
  const seed = chunks.length ? chunks : [{ title: topic || subject, text: `${subject.toUpperCase()} ${topic || "syllabus"} revision` }];
  return seed.slice(0, 5).map((chunk: any, index: number) => normalizeQuizQuestion({
    question: `${chunk.subject?.toUpperCase() || subject.toUpperCase()} ${topic || chunk.topic || "lesson"}: which statement best matches the source?`,
    options: [
      String(chunk.title || chunk.topic || "This topic is included in the syllabus/source set."),
      "This topic is not related to A/L Technology.",
      "This topic should be ignored for revision.",
      "No source is available for this topic.",
    ],
    answer: String(chunk.title || chunk.topic || "This topic is included in the syllabus/source set."),
    explanation: String(chunk.text || "").slice(0, 260) || "Generated from local syllabus/source metadata.",
    marks: 1,
    sourceRefs: [chunk.title].filter(Boolean),
  }, index, subject, topic));
}

aiRoutes.post("/quiz", async (req, res) => {
  try {
    const user = await requireUser(req);
    const subject = String(req.body.subject || req.body.activeSubject || "sft").toLowerCase();
    const topic = String(req.body.topic || req.body.prompt || "revision").trim();
    if (!topic) {
      return res.status(400).json({ ok: false, error: "Topic is required" });
    }

    const { loadUserAIContext } = await import("../firebase/userContext");
    const userContext = await loadUserAIContext(user.uid, user.email);
    const chunks = await retrieveRelevantKnowledge({
      prompt: `${subject} ${topic} quiz`,
      activeSubject: subject,
      mode: "quiz_generation",
      uid: user.uid,
      email: user.email,
      userContext,
      limit: 8,
    });

    let quizObject: any = null;
    const prompt = `Return only strict JSON for a Sinhala-first G.C.E. A/L Technology quiz. Schema: {"title":string,"subject":string,"topic":string,"questions":[{"type":"mcq","question":string,"options":string[],"answer":string,"explanation":string,"marks":number,"sourceRefs":string[]}]} Subject: ${subject}. Topic: ${topic}. Use these sources: ${JSON.stringify(chunks.slice(0, 6))}`;

    for (const model of getModelFallbackChain(AI_MODELS.default)) {
      try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { temperature: 0.25, responseMimeType: "application/json" as any },
        });
        quizObject = extractJsonObject(response.text || "");
        if (quizObject?.questions?.length) break;
      } catch (e) {
        console.warn(`Quiz model ${model} failed:`, e);
      }
    }

    const questions = Array.isArray(quizObject?.questions)
      ? quizObject.questions.slice(0, 8).map((q: any, i: number) => normalizeQuizQuestion(q, i, subject, topic))
      : buildFallbackQuiz(subject, topic, chunks);

    const normalized = {
      title: quizObject?.title || `${subject.toUpperCase()} ${topic} quiz`,
      subject,
      topic,
      questions,
    };

    res.json({ ok: true, quizObject: normalized, quiz: questions, sources: chunks });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || "Quiz generation failed" });
  }
});

aiRoutes.get("/quota", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const [files, images] = await Promise.all([
      db.collection("users").doc(user.uid).collection("files").limit(200).get().catch(() => ({ docs: [] })),
      db.collection("users").doc(user.uid).collection("generated_images").limit(200).get().catch(() => ({ docs: [] })),
    ]);
    const usedBytes = [...(files as any).docs, ...(images as any).docs].reduce((sum: number, doc: any) => {
      const data = doc.data();
      return sum + Number(data.size || data.bytes || 0);
    }, 0);
    res.json({ ok: true, used: usedBytes, quota: Number(process.env.USER_STORAGE_QUOTA_BYTES || 250 * 1024 * 1024) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

aiRoutes.post("/lesson-optimizer", async (req, res) => {
  const send = (event: string, data: any) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    send("status", { message: "Loading progress and weak lessons..." });
    const prompt = `${req.body.prompt || "Create the next best study plan."}\n\nUse provided app data and actual weak lessons. Keep Sinhala-first. App data snapshot: ${JSON.stringify(req.body.data || {}).slice(0, 12000)}`;
    const result: any = await processAIRequest({
      ...req,
      body: {
        prompt,
        activeSubject: req.body.activeSubject,
        explicitMode: "study_plan",
        history: req.body.history || [],
      },
      user,
    });
    if (result.ok) {
      send("chunk", { text: result.text || result.response });
      send("done", { ok: true });
    } else {
      send("error", { message: result.error || "Lesson optimizer failed" });
      send("done", { ok: false });
    }
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/event-stream; charset=utf-8" });
    }
    send("error", { message: error.message || "Lesson optimizer failed" });
    send("done", { ok: false });
    res.end();
  }
});

aiRoutes.get("/past-papers/local/:subject/:year", async (req, res) => {
  const subject = String(req.params.subject || "").toLowerCase();
  const year = String(req.params.year || "");
  const paper = (pastPapersData.papers || []).find((item: any) => {
    const itemSubject = String(item.metadata?.subjectKey || "").toLowerCase();
    const itemYear = String(item.metadata?.exam || "").match(/\b(20\d{2}|19\d{2})\b/)?.[1];
    return itemSubject === subject && itemYear === year;
  });

  if (!paper) {
    return res.status(404).json({ ok: false, error: "No verified local paper found for the requested subject/year" });
  }
  res.json({ ok: true, paper });
});
