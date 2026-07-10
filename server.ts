import "dotenv/config";

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


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

import { requireUser, getAdminDb } from "./server/firebase/admin";

// API Routes

app.use("/api/rag", ragRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/exam-intel", examIntelRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/reports", reportRoutes);


import { getSourceInventory } from "./server/sources/sourceInventoryService";

app.get("/api/sources/inventory", async (req, res) => {
  try {
    const user = await requireUser(req);
    const uid = user.uid;
    const userEmail = (user.email || "").toLowerCase();
    const isAdmin = userEmail === "26002ishan@gmail.com";

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
// Dummy routes for compatibility
app.get("/api/notifications", (req, res) => res.json({ notifications: [] }));
app.post("/api/notifications/trigger", (req, res) => res.json({ success: true }));
app.post("/api/notifications/read", (req, res) => res.json({ success: true }));
app.post("/api/notifications/delete", (req, res) => res.json({ success: true }));

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

app.get("/api/data", async (req, res) => {
  try {
    const user = await requireUser(req);
    const email = (req.query.email as string || user.email || "").toLowerCase();
    
    const db = getAdminDb();
    let appData: any = null;

    // 1. Try to fetch from progress/data under users/{uid}
    const uidRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    const uidSnap = await uidRef.get();
    if (uidSnap.exists) {
      appData = uidSnap.data()?.data || uidSnap.data();
    }

    // 2. Try to fetch from progress/data under users/{email}
    if (!appData && email) {
      const emailRef = db.collection("users").doc(email).collection("progress").doc("data");
      const emailSnap = await emailRef.get();
      if (emailSnap.exists) {
        appData = emailSnap.data()?.data || emailSnap.data();
      }
    }

    // 3. Try to fetch from root users/{uid} (field data/appData)
    if (!appData) {
      const rootUidSnap = await db.collection("users").doc(user.uid).get();
      if (rootUidSnap.exists) {
        appData = rootUidSnap.data()?.appData || rootUidSnap.data()?.data;
      }
    }

    // 4. Try to fetch from root users/{email} (field data/appData)
    if (!appData && email) {
      const rootEmailSnap = await db.collection("users").doc(email).get();
      if (rootEmailSnap.exists) {
        appData = rootEmailSnap.data()?.appData || rootEmailSnap.data()?.data;
      }
    }

    res.json({ ok: true, data: appData || null });
  } catch (error: any) {
    res.status(401).json({ ok: false, error: error.message });
  }
});

app.post("/api/data", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { email, data } = req.body;
    const targetEmail = (email || user.email || "").toLowerCase();

    const db = getAdminDb();
    const batch = db.batch();

    const payload = {
      email: targetEmail,
      data: data || {},
      updatedAt: new Date().toISOString()
    };

    // Set inside users/{uid}/progress/data
    const uidDocRef = db.collection("users").doc(user.uid).collection("progress").doc("data");
    batch.set(uidDocRef, payload, { merge: true });

    // Backup to root
    batch.set(db.collection("users").doc(user.uid), { appData: data || {} }, { merge: true });

    // Set inside users/{email}/progress/data
    if (targetEmail) {
      const emailDocRef = db.collection("users").doc(targetEmail).collection("progress").doc("data");
      batch.set(emailDocRef, payload, { merge: true });
      batch.set(db.collection("users").doc(targetEmail), { appData: data || {} }, { merge: true });
    }

    await batch.commit();
    res.json({ success: true, ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/quota", async (req, res) => {
  res.json({ ok: true, quota: 104857600, usage: Math.floor(Math.random() * 5000000) });
});


app.post("/api/send-email", async (req, res) => {
  res.json({ ok: true });
});

app.post("/api/quiz", async (req, res) => {
  res.json({ ok: true, quiz: { title: "Mock Quiz", questions: [] } });
});

app.post("/api/lesson-optimizer", async (req, res) => {
  res.json({ ok: true, plan: "Mock optimization plan." });
});

app.get("/api/past-papers/local/:id", async (req, res) => {
  res.status(404).json({ ok: false, error: "Not found locally." });
});

app.get("/api/cookies", (req, res) => res.json({}));

app.use('/api/auth', authRoutes);

import aiCoreRoutes from './server/ai-core/routes';
app.use('/api', aiCoreRoutes);

app.use(['/api/ai', '/api'], aiRoutes);

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

app.post("/api/ai/model-test", async (req, res) => {
  try {
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
     res.status(500).json({ ok: false, error: e.message });
  }
});

// Old api routes handled by consolidated array mounting above

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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

export default app;
