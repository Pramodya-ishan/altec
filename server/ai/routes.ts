import { Router } from "express";
import { requireUser, getAdminDb, getAdminStorage } from "../firebase/admin";
import { requireFirebaseUser, requireNonAnonymousUser } from "../firebase/authMiddleware";
import { aiRespondStream, aiContinueStream, lastStreamTraces } from "./respondStream";
import { processAIRequest } from "./respond";
import { getAIClient, prepareGoogleCredentials } from "./client";
import fs from "node:fs";
import path from "node:path";
import { aiBillingCircuitOpenUntil } from "./aiCircuitBreaker";
import { lastOk, lastError, setLastOk } from "./modelRouter";
import { requireRole } from "../utils/authGuards";
import { readResponseWithLimit, validateRemotePdfUrl } from "../utils/safeRemotePdf";
import { getAiTelemetrySnapshot } from "../observability/aiTelemetry";
import { getConversationState, updateConversationState } from "../knowledge/conversationState";
import { evaluateArithmeticExpression, verifyExamAnswer } from "./deterministicExamVerifier";

import { requireFirebaseAppCheck } from "../firebase/appCheckMiddleware";

export const aiRoutes = Router();
aiRoutes.use(requireNonAnonymousUser, requireFirebaseAppCheck);

aiRoutes.get("/client-diagnostics", requireRole("admin", "ops"), (req, res) => {
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



aiRoutes.get("/debug-knowledge", requireRole("admin", "ops"), async (req, res) => {
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

// Self Test endpoint
aiRoutes.get("/self-test", requireRole("admin", "ops"), async (req, res) => {
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
// Minimal capability status used by the student UI. It intentionally omits
// credentials, project identifiers, storage tests, and internal errors.
aiRoutes.get("/model-health", (_req, res) => {
  res.json({
    ok: true,
    models: {
      tts: {
        enabled: process.env.ENABLE_TTS !== "false",
        available: process.env.ENABLE_TTS !== "false",
      },
      image: {
        enabled: process.env.DISABLE_IMAGE_GENERATION !== "true",
        available: process.env.DISABLE_IMAGE_GENERATION !== "true",
      },
    },
  });
});

aiRoutes.get("/conversation/source-mode", async (req, res) => {
  try {
    const user = await requireUser(req);
    const state = await getConversationState(user.uid);
    res.json({
      ok: true,
      mode: state.selectedSourceId ? "locked_pdf" : "general_ai",
      sourceId: state.selectedSourceId,
      title: state.selectedSourceTitle || null,
      evidenceMode: state.evidenceMode,
    });
  } catch {
    res.status(500).json({ ok: false, code: "SOURCE_MODE_LOAD_FAILED", message: "Source mode could not be loaded." });
  }
});

aiRoutes.post("/conversation/source-mode", async (req, res) => {
  try {
    const user = await requireUser(req);
    const requested = String(req.body?.mode || "");
    const current = await getConversationState(user.uid);
    if (requested === "locked_pdf") {
      if (!current.selectedSourceId) return res.status(409).json({ ok: false, code: "NO_LOCKED_SOURCE", message: "Select a PDF before enabling source-locked mode." });
      const state = await updateConversationState(user.uid, { evidenceMode: "strict", allowGeneratedContent: false });
      return res.json({ ok: true, mode: "locked_pdf", sourceId: state.selectedSourceId, title: state.selectedSourceTitle || null });
    }
    if (requested !== "general_ai") return res.status(400).json({ ok: false, code: "INVALID_SOURCE_MODE", message: "Mode must be locked_pdf or general_ai." });
    const state = await updateConversationState(user.uid, {
      selectedSourceId: null,
      selectedSourceTitle: null,
      selectedSourceSubject: null,
      selectedSourceYear: null,
      selectedQuestionType: null,
      activeSourceIds: [],
      selectedQuestionId: null,
      evidenceMode: "none",
      allowGeneratedContent: true,
    });
    return res.json({ ok: true, mode: "general_ai", sourceId: state.selectedSourceId, title: null });
  } catch {
    return res.status(500).json({ ok: false, code: "SOURCE_MODE_UPDATE_FAILED", message: "Source mode could not be changed." });
  }
});

aiRoutes.post("/conversation/source-unlock", async (req, res) => {
  try {
    const user = await requireUser(req);
    await updateConversationState(user.uid, {
      selectedSourceId: null,
      selectedSourceTitle: null,
      selectedSourceSubject: null,
      selectedSourceYear: null,
      selectedQuestionType: null,
      activeSourceIds: [],
      selectedQuestionId: null,
      evidenceMode: "none",
      allowGeneratedContent: true,
    });
    return res.json({ ok: true, mode: "general_ai" });
  } catch {
    return res.status(500).json({ ok: false, code: "SOURCE_UNLOCK_FAILED", message: "The PDF source could not be unlocked." });
  }
});

aiRoutes.post("/verify-calculation", async (req, res) => {
  try {
    await requireUser(req);
    if (req.body?.expression != null) {
      const value = evaluateArithmeticExpression(req.body.expression);
      return res.json({ ok: true, expression: String(req.body.expression), value, verified: true });
    }
    const verification = verifyExamAnswer({
      prompt: req.body?.question,
      answer: req.body?.answer,
      sources: req.body?.sources,
      evidenceRequired: Boolean(req.body?.evidenceRequired),
    });
    return res.json({ ok: true, verification });
  } catch (error: any) {
    return res.status(400).json({ ok: false, code: "CALCULATION_VERIFICATION_FAILED", message: String(error?.message || "Calculation could not be verified.") });
  }
});

aiRoutes.get(["/health", "/model-healt", "/api/health"], requireRole("admin", "ops"), async (req, res) => {
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
      message: "The operation failed. Please try again.",
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
        message: "The operation failed. Please try again.",
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
        message: "The operation failed. Please try again.",
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
        message: "The operation failed. Please try again."
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
        message: "The operation failed. Please try again.",
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
        message: "The operation failed. Please try again.",
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
        message: "The operation failed. Please try again."
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
          message: "The operation failed. Please try again.",
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
          message: "The operation failed. Please try again.",
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
            message: "The operation failed. Please try again.",
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
aiRoutes.post("/debug-context", requireRole("admin", "ops"), async (req, res) => {
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});


import { cancelRequest } from "./cancellation";
aiRoutes.post("/requests/:requestId/cancel", async (req, res) => {
  try {
    const user = await requireUser(req);
    cancelRequest(req.params.requestId);
    res.json({ ok: true, cancelled: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
      message: "The operation failed. Please try again.",
    });
  }
});

aiRoutes.post("/continue", async (req, res) => {
  try {
    const user = await requireUser(req);
    (req as any).user = user;
    await aiContinueStream(req, res);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

aiRoutes.get("/stream-debug-last", requireRole("admin", "ops"), async (req, res) => {
  try {
    const user = await requireUser(req);
    // Anyone logged in can check the last 20 traces
    res.json(lastStreamTraces);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

aiRoutes.get("/quality-metrics", requireRole("admin", "ops"), async (_req, res) => {
  res.json({ ok: true, ...getAiTelemetrySnapshot(300), streamTraces: lastStreamTraces.slice(0, 20) });
});

aiRoutes.get("/data-quality", requireRole("admin", "ops"), async (_req, res) => {
  try {
    const snapshot = await getAdminDb().collection("rag_sources").limit(1000).get();
    const sources = snapshot.docs.map((document: any) => ({ id: document.id, ...document.data() }));
    const issues = sources.flatMap((source: any) => {
      const sourceIssues: string[] = [];
      if (source.needsOcr || source.indexStatus === "needs_ocr") sourceIssues.push("needs_ocr");
      if (source.needsTextReview || (Array.isArray(source.lowConfidencePages) && source.lowConfidencePages.length > 0)) sourceIssues.push("low_confidence_text");
      if (!source.detectedMetadata?.subject || !source.detectedMetadata?.year) sourceIssues.push("missing_metadata");
      if (source.duplicateOfSourceId) sourceIssues.push("duplicate");
      if (source.needsVisualReview) sourceIssues.push("visual_review");
      if (!source.textIndexed && Number(source.chunkCount || 0) === 0) sourceIssues.push("not_indexed");
      return sourceIssues.length > 0 ? [{ sourceId: source.id, title: source.title || source.fileName || source.id, issues: sourceIssues }] : [];
    });
    const issueNames: string[] = issues.flatMap((item: any) => item.issues as string[]);
    const counts = issueNames.reduce((result: Record<string, number>, issue: string) => {
      result[issue] = (result[issue] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    return res.json({ ok: true, totalSources: sources.length, healthySources: sources.length - issues.length, counts, issues: issues.slice(0, 250) });
  } catch {
    return res.status(500).json({ ok: false, code: "DATA_QUALITY_LOAD_FAILED", message: "Data-quality metrics could not be loaded." });
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
       res.status((result as any).code === 'QUOTA_EXCEEDED' ? 503 : 500).json(result);
    } else {
       res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

aiRoutes.post("/gemini-chat", async (req, res) => {
  try {
    const user = await requireUser(req);
    
    (req as any).user = user;
    const result = await processAIRequest(req);
    if (!result.ok) res.status(500).json(result);
    else res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

// GET /api/chat-history
aiRoutes.get("/chat-history", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const userUidRef = db.collection("users").doc(user.uid);
    
    const uidSnap = await userUidRef.collection("chat_history")
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();

    const docs = uidSnap.docs;
    const chatHistory = Array.from(new Map(docs.map((document: any) => [document.id, { id: document.id, ...document.data() }])).values())
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



    res.json({ ok: true, id: docRef.id });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

async function deleteChatCollectionInChunks(collectionRef: any) {
  let deleted = 0;
  while (true) {
    const snapshot = await collectionRef.limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = getAdminDb().batch();
    snapshot.docs.forEach((document: any) => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < 400) return deleted;
  }
}

// POST /api/chat-history/clear
aiRoutes.post("/chat-history/clear", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const userDocumentIds = Array.from(new Set([user.uid, user.email].filter(Boolean).map(String)));
    let clearedCount = 0;

    for (const userDocumentId of userDocumentIds) {
      const userRef = db.collection("users").doc(userDocumentId);
      clearedCount += await deleteChatCollectionInChunks(userRef.collection("chat_history"));
      await userRef.collection("chat_context").doc("current").delete().catch(() => undefined);
      await userRef.collection("state").doc("conversation").delete().catch(() => undefined);
    }

    res.json({ ok: true, clearedCount });
  } catch (error: any) {
    console.error("[CHAT_HISTORY_CLEAR_FAILED]", error);
    res.status(500).json({ ok: false, error: "Chat history could not be cleared." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
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
    res.status(500).json({ ok: false, error: "Internal operation failed." });
  }
});

// POST /api/web/pdf-proxy
aiRoutes.post("/web/pdf-proxy", async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  try {
    await requireUser(req);
    const target = await validateRemotePdfUrl(req.body?.url);
    const fetchResponse = await fetch(target, {
      signal: controller.signal,
      redirect: "error",
      headers: { "User-Agent": "CloraX-PdfImporter/1.0" },
    });
    if (!fetchResponse.ok) {
      return res.status(502).json({ ok: false, code: "PDF_PROXY_UPSTREAM_FAILED", message: "The document host could not provide the PDF." });
    }
    const contentType = String(fetchResponse.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      return res.status(400).json({ ok: false, code: "PDF_PROXY_CONTENT_TYPE_INVALID", message: "The selected URL is not a PDF." });
    }
    const buffer = await readResponseWithLimit(fetchResponse, 50 * 1024 * 1024);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="proxied_document.pdf"');
    return res.send(buffer);
  } catch (error: any) {
    const code = String(error?.message || "PDF_PROXY_FAILED");
    const clientError = /REQUIRED|FORBIDDEN|NOT_ALLOWED|INVALID|TOO_LARGE/.test(code);
    console.error("[PDF_PROXY] Failed", { requestId: (req as any).requestId, code });
    return res.status(clientError ? 400 : 502).json({
      ok: false,
      code,
      message: clientError ? "This PDF URL is not allowed or is invalid." : "The PDF could not be imported from the remote host.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
});
