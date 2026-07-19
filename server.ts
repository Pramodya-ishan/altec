import "dotenv/config";
import { env, logEnvConfig } from "./server/utils/env";
logEnvConfig();

import { prepareGoogleCredentials } from "./server/ai/client";
// Initialize credentials for ADC first
prepareGoogleCredentials();

import { getAdminApp } from "./server/firebase/admin";
getAdminApp();
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";
import { aiRoutes } from "./server/ai/routes";
import { ragRoutes } from "./server/rag/routes";
import { syllabusRoutes } from "./server/syllabus/routes";
import { authRoutes } from "./server/auth/routes";
import { pdfRoutes } from "./server/pdf/routes";
import examIntelRoutes from "./server/routes/examIntelRoutes";
import studentRoutes from "./server/routes/studentRoutes";
import reportRoutes from "./server/routes/reportRoutes";
import learningRoutes from "./server/routes/learningRoutes";
import platformRoutes from "./server/platform/routes";


import { ttsRoutes } from "./server/tts/routes";
import { voiceRoutes } from "./server/voice/routes";
import { videoRoutes } from "./server/video/routes";
import { lessonResourceRoutes } from "./server/lessonResources/routes";
import { patchProgressMeta, readProgressData, summarizeProgressForAudit, writeProgressData } from "./server/firebase/progressStore";
import { invalidateUserAIContext } from "./server/firebase/userContext";

import { restoreVercelApiPathMiddleware } from "./server/utils/vercelApiPath";

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const incoming = req.header("x-request-id");
  const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  (req as any).requestId = requestId;
  next();
});
// Restore the original nested API path before security headers, parsers, rate
// limiters, authentication, and Express routers inspect req.path.
app.use(restoreVercelApiPathMiddleware);
const PORT = env.PORT;
const videoCdnOrigin = (() => {
  try { return env.VIDEO_CDN_BASE_URL ? new URL(env.VIDEO_CDN_BASE_URL).origin : ""; }
  catch { return ""; }
})();

// Strict Content Security Policy & Security Headers Middleware
app.use((req, res, next) => {
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://api.dicebear.com https://*.firebaseapp.com https://*.firebasestorage.app",
    `connect-src 'self' https://*.googleapis.com https://storage.googleapis.com https://*.storage.googleapis.com https://*.firebasestorage.app https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseapp.com https://*.run.app wss://*.run.app ${videoCdnOrigin}`.trim(),
    `media-src 'self' blob: https://storage.googleapis.com https://*.storage.googleapis.com https://*.googleapis.com https://*.firebasestorage.app ${videoCdnOrigin}`.trim(),
    "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://accounts.google.com",
    "object-src 'none'",
    "frame-ancestors 'self'"
  ].join("; ");

  res.setHeader("Content-Security-Policy", cspHeader);

  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), autoplay=(self), clipboard-write=(self), fullscreen=(self)");

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }

  next();
});

const vercelRuntimeOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((host) => `https://${String(host).replace(/^https?:\/\//, "")}`);
const productionOriginDefaults = [
  "https://tecal.vercel.app",
  "https://a-l-tech-blueprint-807408268472.us-west1.run.app",
];
const developmentOriginDefaults = [
  ...productionOriginDefaults,
  "http://localhost:5173",
  "http://localhost:3000",
];
const configuredOrigins = env.ALLOWED_ORIGINS.length > 0
  ? env.ALLOWED_ORIGINS
  : (env.NODE_ENV === "production" ? productionOriginDefaults : developmentOriginDefaults);
const allowedOrigins = [...new Set([...configuredOrigins, ...vercelRuntimeOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.trim().toLowerCase();
    const isAllowed = allowedOrigins.some(allowed => allowed.trim().toLowerCase() === cleanOrigin);
    const isDevPreview = env.NODE_ENV !== "production" && cleanOrigin.endsWith(".run.app");

    if (isAllowed || isDevPreview) {
      callback(null, true);
    } else {
      callback(new Error('CORS_BLOCKED: Origin not allowed by security policy.'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Firebase-AppCheck", "X-Device-ID"]
}));

app.use(express.json({ limit: `${env.MAX_BODY_LIMIT_MB}mb` }));

import { requireFirebaseUser, optionalFirebaseUser } from "./server/firebase/authMiddleware";
import { requireFirebaseAppCheck } from "./server/firebase/appCheckMiddleware";
import { requireUser, getAdminAuth, getAdminDb } from "./server/firebase/admin";


// Authentication endpoints establish/clear the HttpOnly session cookie and are
// intentionally mounted before App Check enforcement. Every other API route
// requires a valid application attestation in production.
app.use('/api/auth', authRoutes);
app.use('/api', requireFirebaseAppCheck);

// API Routes

app.use("/api/rag", ragRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/exam-intel", examIntelRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api", videoRoutes);
app.use("/api", lessonResourceRoutes);


import { getSourceInventory } from "./server/sources/sourceInventoryService";

app.get("/api/sources/inventory", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const uid = user.uid;
    const userEmail = (user.email || "").toLowerCase();
    const isAdmin = !!(user.admin || (user.roles && user.roles.includes("admin")));

    const subjectQuery = req.query.subject ? String(req.query.subject).toUpperCase() : undefined;
    const yearQuery = req.query.year ? String(req.query.year) : undefined;
    const typeQuery = req.query.resourceType ? String(req.query.resourceType).toLowerCase() : undefined;

    const inventory = await getSourceInventory({
      uid,
      subject: subjectQuery,
      year: yearQuery,
      resourceType: typeQuery,
      isAdmin
    });

    res.json({
      ok: true,
      groups: inventory.groups,
      total: inventory.total
    });
  } catch (error: any) {
    console.error("[SOURCE_INVENTORY] Failed", { requestId: (req as any).requestId, code: error?.code });
    res.status(500).json({ ok: false, error: "Source inventory could not be loaded." });
  }
});

// Secure, authenticated Notification Routes with Firestore Storage
app.get("/api/notifications", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    const snap = await db.collection("users").doc(user.uid).collection("notifications").orderBy("timestamp", "desc").limit(50).get();
    const notifications = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json({ ok: true, notifications });
  } catch (error: any) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_FETCH_FAILED", message: error.message });
  }
});

app.post("/api/notifications/trigger", requireFirebaseUser, requireRole("admin", "ops"), async (req: any, res) => {
  try {
    const user = req.user;
    const { notification, targetUid } = req.body;
    if (!notification || !notification.title || !notification.message || !targetUid) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing targetUid, title, or message" });
    }
    const db = getAdminDb();
    const targetRef = db.collection("users").doc(String(targetUid));
    const target = await targetRef.get();
    if (!target.exists) {
      return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "The target user was not found." });
    }
    const id = notification.id || targetRef.collection("notifications").doc().id;
    const newNotif = {
      id,
      title: notification.title,
      message: notification.message,
      type: notification.type || "announcement",
      senderEmail: notification.senderEmail || user.email || "system@alblueprint.com",
      senderName: notification.senderName || user.name || "System Admin",
      read: false,
      timestamp: notification.timestamp || new Date().toISOString()
    };
    await db.collection("users").doc(String(targetUid)).collection("notifications").doc(id).set(newNotif, { merge: false });
    res.json({ ok: true, success: true, notification: newNotif });
  } catch (error: any) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_TRIGGER_FAILED", message: error.message });
  }
});

app.post("/api/notifications/read", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { notificationId, readAll } = req.body;
    const db = getAdminDb();
    const coll = db.collection("users").doc(user.uid).collection("notifications");

    if (readAll) {
      const snap = await coll.where("read", "==", false).get();
      const batch = db.batch();
      snap.docs.forEach((doc: any) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
    } else if (notificationId) {
      await coll.doc(notificationId).update({ read: true });
    } else {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing notificationId or readAll flag" });
    }
    res.json({ ok: true, success: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_READ_FAILED", message: error.message });
  }
});

app.post("/api/notifications/delete", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { notificationId } = req.body;
    if (!notificationId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing notificationId" });
    }
    const db = getAdminDb();
    await db.collection("users").doc(user.uid).collection("notifications").doc(notificationId).delete();
    res.json({ ok: true, success: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_DELETE_FAILED", message: error.message });
  }
});

// Canonical UID-based profile routes. Email is metadata, never a document key.
app.get("/api/profile", requireFirebaseUser, async (req: any, res, next) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    const profileDoc = await db.collection("users").doc(user.uid).collection("profile").doc("main").get();
    const rootDoc = await db.collection("users").doc(user.uid).get();
    const rootData = rootDoc.exists ? rootDoc.data() : {};
    const profile = profileDoc.exists
      ? profileDoc.data()
      : {
          email: user.email || "",
          username: user.name || user.email?.split("@")[0] || "Student",
          picture: rootData?.picture || "",
          bio: rootData?.bio || "",
          updatedAt: rootData?.updatedAt || new Date().toISOString(),
        };
    res.json({ ok: true, profile });
  } catch (error) {
    next(error);
  }
});

app.post("/api/profile", requireFirebaseUser, async (req: any, res, next) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    const input = req.body?.profile || req.body || {};
    const allowedKeys = new Set(["username", "picture", "bio", "nic", "mobileNumber", "bday", "gender"]);
    const profile: Record<string, unknown> = {
      email: user.email || "",
      updatedAt: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(input)) {
      if (allowedKeys.has(key)) profile[key] = value;
    }
    await db.collection("users").doc(user.uid).collection("profile").doc("main").set(profile, { merge: true });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

import { createAuditEvent } from "./server/utils/authContext";
import { requireRole } from "./server/utils/authGuards";

app.get("/api/data", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const progress = await readProgressData(user.uid, user.email);
    res.json({
      ok: true,
      data: progress.data,
      revision: progress.revision,
      updatedAt: progress.updatedAt,
      source: progress.source,
      migrated: progress.migrated,
    });
  } catch (error: any) {
    console.error("[PROGRESS_LOAD_FAILED]", {
      requestId: req.requestId,
      uid: req.user?.uid,
      code: error?.code,
      message: error?.message,
    });
    res.status(503).json({
      ok: false,
      code: "PROGRESS_LOAD_FAILED",
      message: "Progress is temporarily unavailable. The app will retry automatically.",
      requestId: req.requestId,
    });
  }
});

app.post("/api/data", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { data } = req.body || {};

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "A valid progress payload is required.",
      });
    }
    if (data.role || data.roles || data.admin || data.uid) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Modifying security-related fields is strictly prohibited.",
      });
    }

    const result = await writeProgressData(user.uid, user.email, data);
    invalidateUserAIContext(user.uid);
    res.json({
      success: true,
      ok: true,
      revision: result.revision,
      updatedAt: result.updatedAt,
    });
  } catch (error: any) {
    console.error("[PROGRESS_SAVE_FAILED]", {
      requestId: req.requestId,
      uid: req.user?.uid,
      code: error?.code,
      message: error?.message,
    });
    const tooLarge = String(error?.message || "").toLowerCase().includes("too large")
      || String(error?.code || "").includes("invalid-argument");
    res.status(tooLarge ? 413 : 503).json({
      ok: false,
      code: tooLarge ? "PROGRESS_PAYLOAD_TOO_LARGE" : "PROGRESS_SAVE_FAILED",
      message: tooLarge
        ? "Progress contains too much embedded resource data. Remove duplicated local resource metadata and retry."
        : "Progress could not be saved right now. The app will retry automatically.",
      requestId: req.requestId,
    });
  }
});

app.get("/api/admin/users/resolve", requireFirebaseUser, requireRole("admin"), async (req: any, res, next) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "A valid email address is required." });
    }
    const record = await getAdminAuth().getUserByEmail(email);
    return res.json({ ok: true, uid: record.uid, email: record.email || email });
  } catch (error: any) {
    if (error?.code === "auth/user-not-found") {
      return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "The user was not found." });
    }
    next(error);
  }
});

// Separate, explicit, audited Admin Support & Impersonation endpoint
app.post("/api/admin/support/data", requireFirebaseUser, requireRole("admin"), async (req: any, res) => {
  try {
    const adminUser = req.user;
    const { targetUid, operation, reason, data } = req.body || {};

    if (!targetUid || !operation || !reason) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Missing targetUid, operation, or reason for administrative action.",
      });
    }

    let targetAuth: any = null;
    try {
      targetAuth = await getAdminAuth().getUser(String(targetUid));
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") {
        return res.status(404).json({ ok: false, code: "USER_NOT_FOUND", message: "Target user not found." });
      }
      throw error;
    }

    const current = await readProgressData(String(targetUid), targetAuth.email || undefined);
    const previousStateSummary = summarizeProgressForAudit(current.data);

    if (operation === "view") {
      await createAuditEvent({
        actorUid: adminUser.uid,
        actorRoles: adminUser.roles || ["admin"],
        operation: "admin_view_user_data",
        targetType: "user_data",
        targetId: String(targetUid),
        previousState: previousStateSummary,
        newState: { action: "viewed", progressRevision: current.revision },
        reason,
        result: "success",
      });
      return res.json({
        ok: true,
        data: current.data,
        revision: current.revision,
        updatedAt: current.updatedAt,
      });
    }

    if (operation === "edit") {
      if (!data || typeof data !== "object") {
        return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing data payload for edit operation." });
      }
      const saved = await writeProgressData(String(targetUid), targetAuth.email || undefined, data);
      invalidateUserAIContext(String(targetUid));
      await createAuditEvent({
        actorUid: adminUser.uid,
        actorRoles: adminUser.roles || ["admin"],
        operation: "admin_edit_user_data",
        targetType: "user_data",
        targetId: String(targetUid),
        previousState: previousStateSummary,
        newState: {
          ...summarizeProgressForAudit(data),
          progressRevision: saved.revision,
        },
        reason,
        result: "success",
      });
      return res.json({
        ok: true,
        message: "User data updated successfully by admin.",
        revision: saved.revision,
        updatedAt: saved.updatedAt,
      });
    }

    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `Unsupported administrative operation: ${operation}` });
  } catch (error: any) {
    console.error("[ADMIN_SUPPORT_DATA] Failed", { requestId: req.requestId, code: error?.code });
    res.status(503).json({ ok: false, code: "ADMIN_SUPPORT_DATA_FAILED", message: "The administrative operation failed." });
  }
});

async function startBackgroundWorkersForStandaloneServer() {
  if (process.env.VERCEL || process.env.NODE_ENV === "test") return;
  if (String(process.env.ENABLE_BACKGROUND_WORKERS || "").toLowerCase() !== "true") return;
  const { startOcrWorker } = await import("./server/ocr/ocrWorker");
  startOcrWorker();
}
import aiCoreRoutes from './server/ai-core/routes';
app.use('/api', aiCoreRoutes);

app.use(['/api/ai', '/api'], aiRoutes);
import realtimeRoutes from "./server/realtime/routes";
app.use("/api/realtime", realtimeRoutes);

import { AI_MODELS, getAIClient } from "./server/ai/client";

app.post("/api/profile/target-zscore", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const { targetZScore } = req.body;

    if (targetZScore === undefined || typeof targetZScore !== 'number' || targetZScore < 0 || targetZScore > 4) {
       return res.status(400).json({ ok: false, error: "Invalid targetZScore" });
    }

    const db = getAdminDb();
    const updatedAt = new Date().toISOString();
    const batch = db.batch();
    const uidRef = db.collection("users").doc(user.uid).collection("profile").doc("main");
    batch.set(uidRef, { targetZScore, updatedAt }, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { targetZScore, updatedAt }, { merge: true });
    await batch.commit();
    await patchProgressMeta(user.uid, { targetZ: targetZScore });
    invalidateUserAIContext(user.uid);

    // Re-fetch context
    const { loadUserAIContext } = await import("./server/firebase/userContext");
    const ctx = await loadUserAIContext(user.uid, user.email);

    res.json({ ok: true, targetZScore, zScoreContext: ctx?.zScoreContext });
  } catch(e: any) {
    console.error("[TARGET_ZSCORE] Failed", { requestId: req.requestId, code: e?.code });
    res.status(500).json({ ok: false, error: "The target Z-score could not be saved." });
  }
});

app.post("/api/ai/model-test", requireFirebaseUser, async (req: any, res, next) => {
  try {
     const user = req.user;
     const isAdmin = !!(user.admin || (user.roles && user.roles.includes("admin")));
     if (!isAdmin) {
       return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Admin access required" });
     }

     if (!env.ENABLE_MODEL_TEST_ROUTE || env.NODE_ENV === "production") {
       return res.status(501).json({ ok: false, code: "FEATURE_NOT_AVAILABLE", message: "This feature is not available in production." });
     }

     const ai = getAIClient();

     const testModel = async (modelName: string) => {
        try {
           const result = await ai.models.generateContent({
              model: modelName,
              contents: "Return only the word OK",
           });
           return { model: modelName, ok: true, response: result.text };
        } catch(e: any) {
           return { model: modelName, ok: false, error: e.message };
        }
     };

     const results = await Promise.all([
        testModel(AI_MODELS.pro),
        testModel(AI_MODELS.default),
        testModel(AI_MODELS.urlContext)
     ]);

     res.json({ ok: true, results });
  } catch(e: any) {
     next(e);
  }
});

// Old api routes handled by consolidated array mounting above

// Helpers to find assets in public or dist
function getPublicOrDistFile(fileName: string) {
  const distFile = path.join(process.cwd(), "dist", fileName);
  if (fs.existsSync(distFile)) return distFile;
  const publicFile = path.join(process.cwd(), "public", fileName);
  if (fs.existsSync(publicFile)) return publicFile;
  return null;
}

// Explicit manifest route to serve application/manifest+json
app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
  const file = getPublicOrDistFile("manifest.webmanifest");
  if (file) {
    res.type("application/manifest+json");
    return res.sendFile(file);
  }
  res.status(404).json({ error: "manifest not found" });
});

// Explicit PDF worker route to serve correct MIME type
app.get(["/pdf.worker.mjs", "/pdf.worker.min.mjs", "/pdf.worker.min.js"], (req, res) => {
  const file = getPublicOrDistFile(req.path.substring(1));
  if (file) {
    res.type("text/javascript");
    return res.sendFile(file);
  }
  res.status(404).send("worker not found");
});

// API routes 404 handler
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, code: "API_NOT_FOUND", message: "API endpoint not found" });
});

// Vite middleware setup
if (process.env.NODE_ENV !== "production") {
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      if (process.env.NODE_ENV !== ('test' as string) && !process.env.VERCEL) {
        app.listen(PORT, "0.0.0.0", () => {
          void startBackgroundWorkersForStandaloneServer();
      console.log(`Server running on port ${PORT}`);
        });
      }
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  // Do not turn a missing hashed JS/CSS chunk into index.html. Browsers reject
  // that response as a module MIME mismatch; the client can then perform its
  // one-time stale-cache recovery from a clean 404 instead.
  app.get('/assets/*', (req, res) => {
    res.status(404).type('text/plain').send('Static asset not found');
  });
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  if (process.env.NODE_ENV !== ('test' as string) && !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

// Global error handler to ensure all error responses are in JSON format
import { globalErrorHandler } from "./server/utils/errorHandler";
app.use(globalErrorHandler);

export default app;
