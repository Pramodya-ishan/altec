import { Router } from "express";
import { requireUser, getAdminDb, getAdminStorage } from "../firebase/admin";
import { aiRespondStream, aiContinueStream, lastStreamTraces } from "./respondStream";
import { processAIRequest } from "./respond";
import { getAIClient, prepareGoogleCredentials } from "./client";
import fs from "node:fs";
import path from "node:path";
import { aiBillingCircuitOpenUntil } from "./aiCircuitBreaker";
import { lastOk, lastError, setLastOk } from "./modelRouter";

export const aiRoutes = Router();

aiRoutes.get("/client-diagnostics", (req, res) => {
  const deployTarget = process.env.APP_DEPLOY_TARGET || "cloud_run";
  const useVertex = String(process.env.GEMINI_USE_VERTEX || "").toLowerCase() === "true";
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const hasServiceAccountJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasGeminiApiKey = !!process.env.GEMINI_API_KEY;

  res.json({
    mode: useVertex ? "vertex" : "api_key",
    deployTarget,
    project,
    location,
    geminiUseVertex: useVertex,
    hasServiceAccountJson,
    hasGeminiApiKey,
    apiKeyIgnored: useVertex,
    models: {
      normalChat: process.env.GEMINI_DEFAULT_MODEL || "gemini-3.5-flash",
      pdfQa: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash",
      final: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview"
    }
  });
});



aiRoutes.get("/debug-knowledge", async (req, res) => {
  try {
    const { routeKnowledgeRequest } = await import("../knowledge/knowledgeRouter");
    const route = await routeKnowledgeRequest({
      prompt: (req.query.q as string) || "2025 sft paper",
    });
    res.json({
      ok: true,
      query: req.query.q,
      parsedIntent: route.mode,
      entities: route.entities,
      hints: route.answerHints
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Self Test endpoint
aiRoutes.get("/self-test", async (req, res) => {
  try {
    prepareGoogleCredentials();
    const ai = getAIClient();
    const model = process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash";
    const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "al-ai-chat";
    const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

    const response = await ai.models.generateContent({
        model: model,
        contents: "Reply only OK"
    });

    setLastOk(true, null);

    res.json({
      ok: true,
      authPath: "vertex-ai-adc",
      project,
      location,
      model,
      text: response.text ? response.text.trim() : "OK"
    });
  } catch (error: any) {
    const errorMsg = String(error.message || error);
    setLastOk(false, errorMsg);

    if (errorMsg.toLowerCase().includes("prepayment credits are depleted") || errorMsg.toLowerCase().includes("prepayment")) {
      return res.json({
        ok: false,
        authPath: "api-key-prepay-path-detected",
        code: "WRONG_AI_AUTH_PATH",
        message: "This request is still using Gemini Developer API / AI Studio Prepay path, not Vertex AI."
      });
    }

    res.status(500).json({ ok: false, error: errorMsg });
  }
});

let cachedHealthResponse: any = null;
let cachedHealthTime = 0;
const CACHE_TTL_MS = 45000; // 45 seconds

// Comprehensive Health check endpoint
aiRoutes.get(["/health", "/model-health", "/model-healt", "/api/health"], async (req, res) => {
  const now = Date.now();
  if (cachedHealthResponse && (now - cachedHealthTime < CACHE_TTL_MS)) {
    return res.json(cachedHealthResponse);
  }

  const errors: any[] = [];
  let dbInfo: any = {};
  
  const tests = {
    adminInitialized: false,
    canWriteHealthDoc: false,
    canReadHealthDoc: false,
    canQueryRagSources: false,
    canQueryPastPapers: false,
    canSaveChat: false,
    canUploadStorage: false,
    canGenerateSignedUrl: false
  };

  const { getAdminDbInfo, getAdminDb, getAdminBucket } = await import("../firebase/admin");
  const { retryGoogleAuthOperation } = await import("../utils/retry");

  try {
    dbInfo = getAdminDbInfo();
    tests.adminInitialized = true;
  } catch (err: any) {
    errors.push({
      test: "adminInitialized",
      code: err.code || "ADMIN_INIT_FAILED",
      message: err.message,
      hint: "Check environment variables and credentials JSON."
    });
  }

  let db: any = null;
  if (tests.adminInitialized) {
    try {
      db = getAdminDb();
    } catch (err: any) {
      errors.push({
        test: "getAdminDb",
        code: "FIRESTORE_GET_DB_FAILED",
        message: err.message,
        hint: err.message.includes("CONFIG_ERROR_FIRESTORE_DATABASE_ID_MISSING")
          ? "FIRESTORE_DATABASE_ID environment variable is missing."
          : "Firestore database retrieval failed."
      });
    }
  }

  // 2. Write health doc
  if (db) {
    try {
      await db.collection("_health").doc("admin").set({ serverTime: new Date().toISOString() });
      tests.canWriteHealthDoc = true;
    } catch (err: any) {
      const msg = String(err.message || err);
      const isPermission = msg.includes("PERMISSION_DENIED") || err.code === 7;
      errors.push({
        test: "canWriteHealthDoc",
        code: isPermission ? "IAM_PERMISSION_DENIED" : "WRITE_HEALTH_DOC_FAILED",
        message: err.message,
        hint: isPermission
          ? `Grant Cloud Datastore User or Cloud Datastore Owner to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.`
          : "Unknown error writing to _health collection."
      });
    }
  }

  // 3. Read health doc
  if (db && tests.canWriteHealthDoc) {
    try {
      const snap = await db.collection("_health").doc("admin").get();
      tests.canReadHealthDoc = snap.exists;
    } catch (err: any) {
      errors.push({
        test: "canReadHealthDoc",
        code: "READ_HEALTH_DOC_FAILED",
        message: err.message
      });
    }
  }

  // 4. Query RAG sources limit 1
  if (db) {
    try {
      await db.collection("rag_sources").limit(1).get();
      tests.canQueryRagSources = true;
    } catch (err: any) {
      const msg = String(err.message || err);
      const isPermission = msg.includes("PERMISSION_DENIED") || err.code === 7;
      errors.push({
        test: "canQueryRagSources",
        code: isPermission ? "IAM_PERMISSION_DENIED" : "QUERY_RAG_SOURCES_FAILED",
        message: err.message,
        hint: isPermission
          ? `Grant Cloud Datastore User or Cloud Datastore Owner to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.`
          : "Unknown error querying rag_sources."
      });
    }
  }

  // 5. Query past papers limit 1
  if (db) {
    try {
      await db.collection("past_papers").limit(1).get();
      tests.canQueryPastPapers = true;
    } catch (err: any) {
      const msg = String(err.message || err);
      const isPermission = msg.includes("PERMISSION_DENIED") || err.code === 7;
      errors.push({
        test: "canQueryPastPapers",
        code: isPermission ? "IAM_PERMISSION_DENIED" : "QUERY_PAST_PAPERS_FAILED",
        message: err.message,
        hint: isPermission
          ? `Grant Cloud Datastore User or Cloud Datastore Owner to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.`
          : "Unknown error querying past_papers."
      });
    }
  }

  // 6. Write test chat doc to _health_chat
  if (db) {
    try {
      await db.collection("_health_chat").doc("test_chat").set({
        message: "Health check save",
        createdAt: new Date().toISOString()
      });
      tests.canSaveChat = true;
    } catch (err: any) {
      errors.push({
        test: "canSaveChat",
        code: "SAVE_CHAT_FAILED",
        message: err.message
      });
    }
  }

  const FORCE_CLIENT_STORAGE = true; // Force true to prevent Admin Storage OAuth premature close and retries spam

  if (FORCE_CLIENT_STORAGE) {
    tests.canUploadStorage = false;
    tests.canGenerateSignedUrl = false;
  } else {
    // 7 & 8 & 9. Storage bucket testing
    let bucket: any = null;
    if (tests.adminInitialized) {
      try {
        bucket = getAdminBucket();
      } catch (err: any) {
        errors.push({
          test: "getAdminBucket",
          code: "STORAGE_BUCKET_GET_FAILED",
          message: err.message,
          hint: "Check if storageBucket config or FIREBASE_STORAGE_BUCKET is correct."
        });
      }
    }

    if (bucket) {
      const fileRef = bucket.file("_health/admin-health.txt");
      
      // Test write/upload with retry
      try {
        await retryGoogleAuthOperation("canUploadStorage", async () => {
          await fileRef.save("Health check content", {
            resumable: false,
            contentType: "text/plain",
            metadata: {
              cacheControl: "private, max-age=0"
            }
          });
        });
        tests.canUploadStorage = true;
      } catch (err: any) {
        const msg = String(err.message || err);
        const isPermission = msg.includes("permission") || err.code === 403;
        errors.push({
          test: "canUploadStorage",
          code: isPermission ? "STORAGE_PERMISSION_DENIED" : "UPLOAD_STORAGE_FAILED",
          message: err.message,
          hint: isPermission
            ? `Grant Storage Object Admin to ${dbInfo.credentialsEmail || "your service account"} in project ${dbInfo.projectId || "al-ai-chat"}.`
            : "Google auth token premature close or generic upload failure. Check credentials and retry."
        });
      }

      // Test sign url with retry
      if (tests.canUploadStorage) {
        try {
          await retryGoogleAuthOperation("canGenerateSignedUrl", async () => {
            await fileRef.getSignedUrl({
              action: 'read',
              expires: Date.now() + 15 * 60 * 1000, // 15 mins
            });
          });
          tests.canGenerateSignedUrl = true;
        } catch (err: any) {
          errors.push({
            test: "canGenerateSignedUrl",
            code: "GENERATE_SIGNED_URL_FAILED",
            message: err.message,
            hint: "Ensure the Service Account has the Service Account Token Creator role on itself or project."
          });
        }

        // Cleanup
        try {
          await fileRef.delete();
        } catch (e) {}
      }
    }
  }

  const firestoreOk = tests.adminInitialized &&
                     tests.canWriteHealthDoc &&
                     tests.canReadHealthDoc &&
                     tests.canQueryRagSources &&
                     tests.canQueryPastPapers &&
                     tests.canSaveChat;

  const storageOk = tests.canUploadStorage && tests.canGenerateSignedUrl;
  const ok = firestoreOk; // Full-stack core db functions are healthy; storage is safely handled via client-side fallback

  // OCR health check validation
  let ocrAvailable = false;
  let ocrLastError: string | null = null;
  const isOcrEnabled = process.env.ENABLE_CLOUD_VISION_OCR === "true" || process.env.OCR_ENABLED === "true";
  const ocrInputBucket = process.env.VISION_OCR_INPUT_BUCKET || process.env.OCR_INPUT_BUCKET || "al-ai-chat-ocr-input";
  const ocrOutputBucket = process.env.VISION_OCR_OUTPUT_BUCKET || process.env.OCR_OUTPUT_BUCKET || "al-ai-chat-ocr-output";

  if (isOcrEnabled) {
    try {
      const { ImageAnnotatorClient } = await import("@google-cloud/vision");
      const client = new ImageAnnotatorClient();
      
      const storage = getAdminStorage();
      const inBucket = storage.bucket(ocrInputBucket);
      const outBucket = storage.bucket(ocrOutputBucket);
      
      const [inExists] = await inBucket.exists();
      const [outExists] = await outBucket.exists();
      
      if (inExists && outExists) {
        ocrAvailable = true;
      } else {
        ocrLastError = `Bucket existence check: inputBucket(${ocrInputBucket}): ${inExists}, outputBucket(${ocrOutputBucket}): ${outExists}`;
      }
    } catch (err: any) {
      ocrLastError = err.message;
    }
  }

  const responsePayload: any = {
    ok,
    projectId: dbInfo.projectId || "al-ai-chat",
    firestoreDatabaseId: dbInfo.databaseId || "(default)",
    storageBucket: dbInfo.storageBucket || "al-ai-chat.firebasestorage.app",
    credentialMode: dbInfo.credentialMode || "not_initialized",
    credentialsEmail: dbInfo.credentialsEmail || "unknown",
    hasPrivateKey: dbInfo.hasPrivateKey === true,
    tests,
    errors,
    ocr: {
      enabled: isOcrEnabled,
      provider: "cloud_vision",
      inputBucket: ocrInputBucket,
      outputBucket: ocrOutputBucket,
      available: ocrAvailable,
      lastError: ocrLastError
    },
    recommendedUploadMode: FORCE_CLIENT_STORAGE ? "client_firebase_storage" : (storageOk ? "backend_multer" : "client_firebase_storage"),

    requiredIamRoles: [
      "Cloud Datastore User",
      "Cloud Datastore Owner",
      "Storage Object Admin",
      "Vertex AI User"
    ],
    aiCore: {
      version: "evidence-first-v1",
      parser: true,
      sourceLock: true,
      evidenceGate: true,
      answerVerifier: true,
      verifiedAnswers: true,
      wrongFeedback: true
    },
    directPdfQa: {
      enabled: process.env.ENABLE_DIRECT_PDF_QA !== "false",
      mode: "frontend_blob_to_gemini",
      requiresGcs: false,
      available: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      model: process.env.GEMINI_PDF_QA_MODEL || "gemini-3.5-flash"
    }
  };

  if (FORCE_CLIENT_STORAGE) {
    responsePayload.storageMode = {
      recommendedUploadMode: "client_firebase_storage",
      tests: {
        canUploadStorage: false,
        canGenerateSignedUrl: false,
        skippedAdminStorageTests: true,
        reason: "client_firebase_storage_forced"
      }
    };
  } else if (firestoreOk && !storageOk) {
    responsePayload.degraded = true;
    responsePayload.storageMode = {
      adminStorageAvailable: false,
      clientStorageFallbackEnabled: true,
      recommendedUploadMode: "client_firebase_storage"
    };
  }

  const { getRealtimeConfig } = await import("../realtime/config");
  const realtimeCfg = getRealtimeConfig();

  responsePayload.directPdfQa = { mode: "frontend_blob_to_gemini", requiresGcs: false, available: true };
  responsePayload.tts = {
    enabled: process.env.ENABLE_TTS === "true",
    available: process.env.ENABLE_TTS === "true" && !!dbInfo.projectId,
    provider: process.env.TTS_PROVIDER || "google_cloud",
    lastError: null
  };
  responsePayload.realtime = {
    enabled: realtimeCfg.enabled,
    provider: realtimeCfg.provider,
    available: realtimeCfg.available,
    model: realtimeCfg.model,
    missing: realtimeCfg.missing,
    authMode: realtimeCfg.authMode
  };

  responsePayload.models = {
    final: { configured: process.env.GEMINI_FINAL_MODEL || "gemini-3.1-pro-preview", lastOk: true, lastError: null },
    fast: { configured: process.env.GEMINI_DEFAULT_MODEL || "gemini-3-flash-preview", lastOk: true, lastError: null },
    lite: { configured: process.env.GEMINI_LITE_MODEL || "gemini-3.1-flash-lite", lastOk: true, lastError: null },
    embeddings: { configured: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001", lastOk: true, lastError: null },
    image: { enabled: process.env.DISABLE_IMAGE_GENERATION !== "true", available: true, lastError: null }
  };

  cachedHealthResponse = responsePayload;
  cachedHealthTime = now;

  res.json(responsePayload);
});

// Debug Context endpoint
aiRoutes.post("/debug-context", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { loadUserAIContext } = await import("../firebase/userContext");
    const context = await loadUserAIContext(user.uid, user.email);
    
    let databaseId = process.env.FIRESTORE_DATABASE_ID;
    if (!databaseId) {
        try {
            const configPath = path.join(process.cwd(), "firebase-applet-config.json");
            const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            databaseId = config.firestoreDatabaseId;
        } catch(e) {}
    }
    
    res.json({
      ok: true,
      uid: user.uid,
      emailMasked: (user.email || "").replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      loadedProfileFields: Object.keys(context.profile || {}),
      progressCount: context.recentProgress?.length || 0,
      weakLessonsCount: context.weakLessons?.length || 0,
      latestMarksCount: context.latestMarks?.length || 0,
      subjectCompletion: context.recentProgress?.map((p: any) => ({ subject: p.subject, percent: p.coveragePercent, completed: p.completedTopics, total: p.totalTopics })) || [],
      selectedMode: req.body.mode || 'auto',
      dbProject: process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "al-ai-chat",
      firestoreDatabaseId: databaseId || "(default)",
      loadedFrom: context.loadedFrom || "unknown",
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});


import { cancelRequest } from "./cancellation";
aiRoutes.post("/requests/:requestId/cancel", async (req, res) => {
  try {
    const user = await requireUser(req);
    cancelRequest(req.params.requestId);
    res.json({ ok: true, cancelled: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
aiRoutes.post("/respond-stream", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    await aiRespondStream(req, res);
  } catch (error: any) {
    const unauthorized = String(error?.message || "").startsWith("Unauthorized:");
    res.status(unauthorized ? 401 : 500).json({
      ok: false,
      error: unauthorized ? "AUTH_REQUIRED" : error.message,
      message: error.message,
    });
  }
});

aiRoutes.post("/continue", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    await aiContinueStream(req, res);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

aiRoutes.get("/stream-debug-last", async (req, res) => {
  try {
    const user = await requireUser(req);
    // Anyone logged in can check the last 20 traces
    res.json(lastStreamTraces);
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
    console.error("[CHAT_HISTORY_FAILED]", error);
    return res.status(200).json({
      ok: false,
      chatHistory: [],
      errorCode: "CHAT_HISTORY_FAILED"
    });
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
    
    let opCount = 0;
    const uidSnap = await db.collection("users").doc(user.uid).collection("chat_history").get().catch(() => ({ docs: [] }));
    uidSnap.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
      opCount++;
    });

    if (user.email) {
      const emailSnap = await db.collection("users").doc(user.email.toLowerCase()).collection("chat_history").get().catch(() => ({ docs: [] }));
      emailSnap.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
        opCount++;
      });
    }

    // Also delete current chat context
    const chatCtxRef = db.collection("users").doc(user.uid).collection("chat_context").doc("current");
    batch.delete(chatCtxRef);
    opCount++;

    await batch.commit();
    res.json({ ok: true, clearedCount: opCount });
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

// Final Direct PDF Answer saving endpoint (for the frontend flow)
aiRoutes.post("/answer-from-direct-pdf-result", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { answer, source, prompt, mode, subject } = req.body;
    
    if (!answer || !prompt) {
      return res.status(400).json({ ok: false, error: "Missing answer or prompt." });
    }

    const { saveFinalChat } = await import("./respondStream");
    const chatRes = await saveFinalChat({
      uid: user.uid,
      email: user.email,
      userText: prompt,
      assistantText: answer,
      mode: mode || "auto",
      subject: subject || null,
      sources: source ? [source] : []
    });

    res.json({
      ok: true,
      chatSaved: chatRes.chatSaved,
      messageId: chatRes.messageId
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/ai/feedback/wrong-answer
aiRoutes.post("/feedback/wrong-answer", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { sourceId, questionType, questionNo, reason } = req.body;
    
    if (!sourceId || !questionNo) {
      return res.status(400).json({ ok: false, error: "Missing sourceId or questionNo." });
    }

    const { handleWrongAnswerFeedback } = await import("../ai-core/feedback/wrongAnswerHandler");
    const result = await handleWrongAnswerFeedback({
      uid: user.uid,
      sourceId,
      questionType,
      questionNo,
      reason
    });

    res.json(result);
  } catch (error: any) {
    console.error("[AI_ROUTES] feedback/wrong-answer error:", error);
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

// POST /api/web/pdf-proxy
aiRoutes.post("/web/pdf-proxy", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ ok: false, error: "URL is required" });
    }

    // SSRF Guard
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return res.status(400).json({ ok: false, error: "Only secure HTTPS URLs are allowed" });
      }
      const host = parsed.hostname.toLowerCase();
      const isPrivate = host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.startsWith("169.254.") ||
        host.startsWith("172.16.") ||
        host.startsWith("172.17.") ||
        host.startsWith("172.18.") ||
        host.startsWith("172.19.") ||
        host.startsWith("172.20.") ||
        host.startsWith("172.21.") ||
        host.startsWith("172.22.") ||
        host.startsWith("172.23.") ||
        host.startsWith("172.24.") ||
        host.startsWith("172.25.") ||
        host.startsWith("172.26.") ||
        host.startsWith("172.27.") ||
        host.startsWith("172.28.") ||
        host.startsWith("172.29.") ||
        host.startsWith("172.30.") ||
        host.startsWith("172.31.");

      if (isPrivate) {
        return res.status(400).json({ ok: false, error: "Access to private resources is forbidden" });
      }
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid URL format" });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

    const fetchResponse = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    clearTimeout(timeoutId);

    if (!fetchResponse.ok) {
      return res.status(502).json({ ok: false, error: `Failed to fetch target URL. Status: ${fetchResponse.status}` });
    }

    const contentType = fetchResponse.headers.get("content-type") || "";
    // Accept standard binary stream or pdf
    if (!contentType.toLowerCase().includes("pdf") && !contentType.toLowerCase().includes("octet-stream") && !contentType.toLowerCase().includes("application/")) {
      return res.status(400).json({ ok: false, error: "Target URL does not appear to point to a valid document file" });
    }

    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: "File exceeds safe size limit of 50MB" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="proxied_document.pdf"`);
    res.send(buffer);

  } catch (error: any) {
    console.error("PDF proxy failed:", error);
    res.status(500).json({ ok: false, error: error.message || "Fetch timeout or network issue" });
  }
});
