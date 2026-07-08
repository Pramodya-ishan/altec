import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { aiRoutes } from "./server/ai/routes";
import { authRoutes } from "./server/auth/routes";
import { prepareGoogleCredentials } from "./server/ai/client";
import { getAdminDb, requireUser } from "./server/firebase/admin";

if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "al-ai-chat",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  });
}

prepareGoogleCredentials();

export const app = express();
const PORT = Number(process.env.PORT || 3000);

function cleanStoragePath(input: unknown) {
  const raw = String(input || `files/${Date.now()}_upload.bin`);
  return raw
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .join("/")
    .slice(0, 240);
}

app.post("/api/upload-proxy", express.raw({ type: "*/*", limit: "25mb" }), async (req, res) => {
  try {
    if (!req.headers.authorization && req.headers["x-firebase-auth"]) {
      req.headers.authorization = `Bearer ${req.headers["x-firebase-auth"]}`;
    }
    const user = await requireUser(req);
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (!body.length) {
      return res.status(400).json({ ok: false, error: "Upload body is empty" });
    }
    if (body.length > 25 * 1024 * 1024) {
      return res.status(413).json({ ok: false, error: "File is too large. Maximum size is 25MB." });
    }

    const contentType = String(req.headers["content-type"] || "application/octet-stream");
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
      "application/octet-stream",
    ];
    if (!allowed.some((type) => contentType.includes(type))) {
      return res.status(415).json({ ok: false, error: "Only PDF, image, or text uploads are allowed." });
    }

    const storagePath = cleanStoragePath(req.query.name);
    const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
    const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
    const file = bucket.file(storagePath);
    await file.save(body, { metadata: { contentType } });

    let url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    try {
      await file.makePublic();
    } catch {
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 30,
      });
      url = signedUrl;
    }

    await getAdminDb().collection("users").doc(user.uid).collection("files").doc().set({
      path: storagePath,
      url,
      contentType,
      size: body.length,
      createdAt: new Date().toISOString(),
    }).catch(() => null);

    res.json({ ok: true, url, path: storagePath, size: body.length });
  } catch (error: any) {
    res.status(error.message?.startsWith("Unauthorized") ? 401 : 500).json({
      ok: false,
      error: error.message || "Upload failed",
    });
  }
});

app.use(express.json({ limit: "50mb" }));

app.get("/api/notifications", (_req, res) => res.json({ notifications: [] }));
app.post("/api/notifications/trigger", (_req, res) => res.json({ success: true }));
app.post("/api/notifications/read", (_req, res) => res.json({ success: true }));
app.post("/api/notifications/delete", (_req, res) => res.json({ success: true }));

app.get("/api/profile", async (req, res) => {
  try {
    const user = await requireUser(req);
    const db = getAdminDb();
    const email = user.email?.toLowerCase();
    const [uidRoot, uidProfile, emailRoot, emailProfile] = await Promise.all([
      db.collection("users").doc(user.uid).get().catch(() => null),
      db.collection("users").doc(user.uid).collection("profile").doc("main").get().catch(() => null),
      email ? db.collection("users").doc(email).get().catch(() => null) : null,
      email ? db.collection("users").doc(email).collection("profile").doc("info").get().catch(() => null) : null,
    ]);

    const profile = {
      ...(emailRoot?.exists ? emailRoot.data() : {}),
      ...(emailProfile?.exists ? emailProfile.data() : {}),
      ...(uidRoot?.exists ? uidRoot.data() : {}),
      ...(uidProfile?.exists ? uidProfile.data() : {}),
    };
    res.json({ ok: true, profile });
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
    batch.set(db.collection("users").doc(user.uid).collection("profile").doc("main"), profileData, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { email: user.email || profileData.email || null, updatedAt: new Date().toISOString() }, { merge: true });
    if (user.email) {
      batch.set(db.collection("users").doc(user.email.toLowerCase()).collection("profile").doc("info"), profileData, { merge: true });
    }
    await batch.commit();
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/data", async (req, res) => {
  try {
    const user = await requireUser(req);
    const email = ((req.query.email as string) || user.email || "").toLowerCase();
    const db = getAdminDb();
    const [uidProgress, emailProgress, uidRoot, emailRoot] = await Promise.all([
      db.collection("users").doc(user.uid).collection("progress").doc("data").get().catch(() => null),
      email ? db.collection("users").doc(email).collection("progress").doc("data").get().catch(() => null) : null,
      db.collection("users").doc(user.uid).get().catch(() => null),
      email ? db.collection("users").doc(email).get().catch(() => null) : null,
    ]);

    const uidProgressData = uidProgress?.exists ? (uidProgress.data()?.data || uidProgress.data()) : null;
    const emailProgressData = emailProgress?.exists ? (emailProgress.data()?.data || emailProgress.data()) : null;
    const appData = uidProgressData
      || emailProgressData
      || uidRoot?.data()?.appData
      || uidRoot?.data()?.data
      || emailRoot?.data()?.appData
      || emailRoot?.data()?.data
      || null;

    if (!uidProgressData && emailProgressData) {
      await db.collection("users").doc(user.uid).collection("progress").doc("data").set({
        data: emailProgressData,
        migratedFromEmail: email,
        migratedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => null);
    }

    res.json({ ok: true, data: appData });
  } catch (error: any) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.post("/api/data", async (req, res) => {
  try {
    const user = await requireUser(req);
    const email = ((req.body.email as string) || user.email || "").toLowerCase();
    const db = getAdminDb();
    const payload = {
      email,
      data: req.body.data || {},
      updatedAt: new Date().toISOString(),
    };
    const batch = db.batch();
    batch.set(db.collection("users").doc(user.uid).collection("progress").doc("data"), payload, { merge: true });
    batch.set(db.collection("users").doc(user.uid), { appData: payload.data, email }, { merge: true });
    if (email) {
      batch.set(db.collection("users").doc(email).collection("progress").doc("data"), payload, { merge: true });
      batch.set(db.collection("users").doc(email), { appData: payload.data, migratedToUid: user.uid }, { merge: true });
    }
    await batch.commit();
    res.json({ success: true, ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/cookies", async (req, res) => {
  try {
    const user = await requireUser(req);
    const snap = await getAdminDb().collection("users").doc(user.uid).collection("bypass").doc("config").get();
    res.json({ ok: true, cookies: snap.exists ? snap.data()?.cookies || "" : "" });
  } catch {
    res.json({ ok: true, cookies: "" });
  }
});

app.post("/api/cookies", async (req, res) => {
  try {
    const user = await requireUser(req);
    const cookies = String(req.body.cookies || "");
    await getAdminDb().collection("users").doc(user.uid).collection("bypass").doc("config").set({
      cookies,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.post("/api/send-email", async (req, res) => {
  try {
    await requireUser(req);
    const { to, subject, html, text } = req.body || {};
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ ok: false, error: "to, subject, and html/text are required" });
    }
    if (!process.env.SEND_EMAIL_WEBHOOK_URL) {
      return res.status(501).json({
        ok: false,
        code: "EMAIL_NOT_CONFIGURED",
        error: "Email sending is not configured on this server.",
      });
    }
    const response = await fetch(process.env.SEND_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, text }),
    });
    res.status(response.ok ? 200 : 502).json({ ok: response.ok });
  } catch (error: any) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", aiRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const serveBuiltClient = process.env.NODE_ENV === "production" || fs.existsSync(path.join(distPath, "index.html"));

  if (!serveBuiltClient) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (process.env.VERCEL !== "1" && process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
}

export default app;
