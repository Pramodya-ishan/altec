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
import { aiRoutes } from "./server/ai/routes";
import { ragRoutes } from "./server/rag/routes";
import { syllabusRoutes } from "./server/syllabus/routes";
import { authRoutes } from "./server/auth/routes";
import { pdfRoutes } from "./server/pdf/routes";
import examIntelRoutes from "./server/routes/examIntelRoutes";
import studentRoutes from "./server/routes/studentRoutes";
import reportRoutes from "./server/routes/reportRoutes";


import { ttsRoutes } from "./server/tts/routes";
import { voiceRoutes } from "./server/voice/routes";
import { videoRoutes } from "./server/video/routes";

import { globalLimiter, aiLimiter, adminLimiter } from "./server/utils/rateLimiter";

const app = express();
const PORT = env.PORT;
const videoCdnOrigin = (() => {
  try { return env.VIDEO_CDN_BASE_URL ? new URL(env.VIDEO_CDN_BASE_URL).origin : ""; }
  catch { return ""; }
})();

// Strict Content Security Policy & Security Headers Middleware
app.use((req, res, next) => {
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://api.dicebear.com https://*.firebaseapp.com https://*.firebasestorage.app",
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseapp.com https://*.run.app wss://*.run.app ${videoCdnOrigin}`.trim(),
    `media-src 'self' blob: ${videoCdnOrigin}`.trim(),
    "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://accounts.google.com",
    "object-src 'none'",
    "frame-ancestors 'self' https://ai.studio https://*.google.com"
  ].join("; ");

  res.setHeader("Content-Security-Policy", cspHeader);

  if (env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), autoplay=(self), clipboard-write=(self), fullscreen=(self)");

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }

  next();
});

const vercelRuntimeOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((host) => `https://${String(host).replace(/^https?:\/\//, "")}`);
const allowedOrigins = [...new Set([...(env.ALLOWED_ORIGINS.length > 0 ? env.ALLOWED_ORIGINS : [
  "https://tecal.vercel.app",
  "https://a-l-tech-blueprint-807408268472.us-west1.run.app",
  "http://localhost:5173",
  "http://localhost:3000"
]), ...vercelRuntimeOrigins])];

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
import { requireUser, getAdminDb } from "./server/firebase/admin";

// Global limiter on all API routes
app.use("/api", globalLimiter);


// API Routes

app.use("/api/rag", ragRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/exam-intel", examIntelRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api", videoRoutes);


import { getSourceInventory } from "./server/sources/sourceInventoryService";

app.get("/api/sources/inventory", async (req, res) => {
  try {
    const user = await requireUser(req);
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
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Secure, authenticated Notification Routes with Firestore Storage
app.get("/api/notifications", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    const snap = await db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").orderBy("timestamp", "desc").limit(50).get();
    const notifications = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json({ ok: true, notifications });
  } catch (error: any) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_FETCH_FAILED", message: error.message });
  }
});

app.post("/api/notifications/trigger", requireFirebaseUser, adminLimiter, async (req: any, res) => {
  try {
    const user = req.user;
    const { notification } = req.body;
    if (!notification || !notification.title || !notification.message) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "Missing title or message" });
    }
    const db = getAdminDb();
    const id = notification.id || db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").doc().id;
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
    await db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").doc(id).set(newNotif, { merge: true });
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
    const coll = db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications");

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
    await db.collection("users").doc(user.email?.toLowerCase() || user.uid).collection("notifications").doc(notificationId).delete();
    res.json({ ok: true, success: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, code: "NOTIFICATIONS_DELETE_FAILED", message: error.message });
  }
});

// Real Profile & AppData routes with Firebase Admin Firestore
app.get("/api/profile", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const uidDoc = await db.collection("users").doc(user.uid).get();
    let profileData = uidDoc.exists ? uidDoc.data() : {};

    if (user.email) {
      const emailDoc = await db.collection("users").doc(user.email.toLowerCase()).get();
      if (emailDoc.exists) {
        profileData = { ...emailDoc.data(), ...profileData };
      }
    }
    res.json({ ok: true, profile: profileData });
  } catch (error: any) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.post("/api/profile", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const profileData = req.body.profile || req.body;

    const batch = db.batch();
    batch.set(db.collection("users").doc(user.uid), profileData, { merge: true });
    if (user.email) {
      batch.set(db.collection("users").doc(user.email.toLowerCase()), profileData, { merge: true });
    }
    await batch.commit();
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

import { createAuditEvent } from "./server/utils/authContext";
import { requireRole } from "./server/utils/authGuards";

app.get("/api/data", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    const db = getAdminDb();
    let appData: any = null;

    // 1. Fetch from progress/data under users/{uid} (canonical path)
    const uidRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    const uidSnap = await uidRef.get();
    if (uidSnap.exists) {
      appData = uidSnap.data()?.data || uidSnap.data();
    }

    // 2. Compatibility Adapter fallback to root users/{uid}
    if (!appData) {
      const rootUidSnap = await db.collection("users").doc(user.uid).get();
      if (rootUidSnap.exists) {
        appData = rootUidSnap.data()?.appData || rootUidSnap.data()?.data;
      }
    }

    // 3. Compatibility Adapter fallback to legacy email documents
    if (!appData && user.email) {
      const legacyEmail = user.email.toLowerCase();
      const emailRef = db.collection("users").doc(legacyEmail).collection("progress").doc("data");
      const emailSnap = await emailRef.get();
      if (emailSnap.exists) {
        appData = emailSnap.data()?.data || emailSnap.data();
      }

      if (!appData) {
        const rootEmailSnap = await db.collection("users").doc(legacyEmail).get();
        if (rootEmailSnap.exists) {
          appData = rootEmailSnap.data()?.appData || rootEmailSnap.data()?.data;
        }
      }

      // If legacy data was found, migrate it synchronously to the canonical UID path
      if (appData) {
        console.log(`[DATA MIGRATION] Migrating data for user ${user.uid} from legacy email ${legacyEmail}`);
        const batch = db.batch();
        const payload = {
          email: legacyEmail,
          data: appData,
          updatedAt: new Date().toISOString()
        };
        batch.set(uidRef, payload, { merge: true });
        batch.set(db.collection("users").doc(user.uid), { appData }, { merge: true });
        await batch.commit();
      }
    }

    res.json({ ok: true, data: appData || null });
  } catch (error: any) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.post("/api/data", requireFirebaseUser, async (req: any, res) => {
  try {
    const user = req.user;
    // Strictly ignore client-supplied 'email' or 'uid' or role fields to prevent role/admin forgery
    const { data } = req.body;

    // Validate schema - prevent role/admin/ownership fields from being written
    if (data && (data.role || data.roles || data.admin || data.uid)) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Modifying security-related fields is strictly prohibited."
      });
    }

    const db = getAdminDb();
    const batch = db.batch();

    const payload = {
      email: user.email?.toLowerCase() || "",
      data: data || {},
      updatedAt: new Date().toISOString()
    };

    // Set inside canonical path: users/{uid}/progress/data
    const uidDocRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    batch.set(uidDocRef, payload, { merge: true });

    // Backup to root: users/{uid}
    batch.set(db.collection("users").doc(user.uid), { appData: data || {} }, { merge: true });

    await batch.commit();
    res.json({ success: true, ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Separate, explicit, audited Admin Support & Impersonation endpoint
app.post("/api/admin/support/data", requireFirebaseUser, requireRole("admin"), adminLimiter, async (req: any, res) => {
  try {
    const adminUser = req.user;
    const { targetUid, operation, reason, data } = req.body;

    if (!targetUid || !operation || !reason) {
      return res.status(400).json({
        ok: false,
        code: "VALIDATION_FAILED",
        message: "Missing targetUid, operation, or reason for administrative action."
      });
    }

    const db = getAdminDb();
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return res.status(404).json({ ok: false, error: "Target user profile not found." });
    }

    let previousStateSummary = {};
    if (targetSnap.exists) {
      previousStateSummary = { appData: targetSnap.data()?.appData || {} };
    }

    if (operation === "view") {
      // Fetch target's progress data
      let targetData: any = null;
      const progRef = targetRef.collection("progress").doc("data");
      const progSnap = await progRef.get();
      if (progSnap.exists) {
        targetData = progSnap.data()?.data || progSnap.data();
      } else {
        targetData = targetSnap.data()?.appData || targetSnap.data()?.data;
      }

      await createAuditEvent({
        actorUid: adminUser.uid,
        actorRoles: adminUser.roles || ["admin"],
        operation: "admin_view_user_data",
        targetType: "user_data",
        targetId: targetUid,
        previousState: previousStateSummary,
        newState: { action: "viewed" },
        reason,
        result: "success"
      });

      return res.json({ ok: true, data: targetData });
    } else if (operation === "edit") {
      if (!data) {
        return res.status(400).json({ ok: false, error: "Missing data payload for edit operation." });
      }

      const batch = db.batch();
      const payload = {
        data,
        updatedAt: new Date().toISOString()
      };
      batch.set(targetRef.collection("progress").doc("data"), payload, { merge: true });
      batch.set(targetRef, { appData: data }, { merge: true });
      await batch.commit();

      await createAuditEvent({
        actorUid: adminUser.uid,
        actorRoles: adminUser.roles || ["admin"],
        operation: "admin_edit_user_data",
        targetType: "user_data",
        targetId: targetUid,
        previousState: previousStateSummary,
        newState: { appData: data },
        reason,
        result: "success"
      });

      return res.json({ ok: true, message: "User data updated successfully by admin." });
    } else {
      return res.status(400).json({ ok: false, error: `Unsupported administrative operation: ${operation}` });
    }
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/quota", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});


app.post("/api/send-email", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});

app.post("/api/quiz", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});

app.post("/api/lesson-optimizer", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});

app.get("/api/past-papers/local/:id", async (req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented" });
});

app.get("/api/cookies", (req, res) => res.json({}));

app.use('/api/auth', authRoutes);

import { startOcrWorker } from "./server/ocr/ocrWorker";
startOcrWorker();
import aiCoreRoutes from './server/ai-core/routes';
app.use('/api', aiCoreRoutes);

app.use(['/api/ai', '/api'], aiRoutes);
import realtimeRoutes from "./server/realtime/routes";
app.use("/api/realtime", realtimeRoutes);

import { AI_MODELS, getAIClient } from "./server/ai/client";

app.post("/api/profile/target-zscore", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { targetZScore } = req.body;

    if (targetZScore === undefined || typeof targetZScore !== 'number' || targetZScore < 0 || targetZScore > 4) {
       return res.status(400).json({ ok: false, error: "Invalid targetZScore" });
    }

    const db = getAdminDb();
    const batch = db.batch();

    // Write to profile/main
    const uidRef = db.collection("users").doc(user.uid).collection("profile").doc("main");
    batch.set(uidRef, { targetZScore, updatedAt: new Date().toISOString() }, { merge: true });

    // Also write to progress/data for consistency
    const progRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    batch.set(progRef, { targetZScore, updatedAt: new Date().toISOString() }, { merge: true });

    if (user.email) {
       const emailRef = db.collection("users").doc(user.email.toLowerCase()).collection("profile").doc("main");
       batch.set(emailRef, { targetZScore, updatedAt: new Date().toISOString() }, { merge: true });
    }

    await batch.commit();

    // Re-fetch context
    const { loadUserAIContext } = await import("./server/firebase/userContext");
    const ctx = await loadUserAIContext(user.uid, user.email);

    res.json({ ok: true, targetZScore, zScoreContext: ctx?.zScoreContext });
  } catch(e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/ai/model-test", requireFirebaseUser, adminLimiter, async (req: any, res, next) => {
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
app.get(["/pdf.worker.min.mjs", "/pdf.worker.min.js"], (req, res) => {
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
          console.log(`Server running on port ${PORT}`);
        });
      }
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
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
