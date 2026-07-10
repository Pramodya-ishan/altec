import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const additionalRoutes = `
import { requireUser, getAdminDb } from "./server/firebase/admin";
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

app.get("/api/ai/health", async (req, res) => {
  try {
    const db = getAdminDb();
    const bucket = require("./server/firebase/admin").getAdminStorage().bucket();
    
    let canWriteHealthDoc = false;
    let canQueryRagSources = false;
    let canSaveChat = false;
    
    try {
       await db.collection("health_checks").doc("ping").set({ ts: new Date().toISOString() });
       canWriteHealthDoc = true;
    } catch(e) {}
    
    try {
       await db.collection("rag_sources").limit(1).get();
       canQueryRagSources = true;
    } catch(e) {}

    const credentialsEmail = process.env.GOOGLE_APPLICATION_CREDENTIALS ? "Service Account (Loaded)" : "Default Credentials (Vercel/GCP)";

    if (!canWriteHealthDoc || !canQueryRagSources) {
       return res.status(403).json({
          ok: false,
          code: "IAM_PERMISSION_DENIED",
          credentialsEmail,
          requiredRoles: [
            "Cloud Datastore User",
            "Storage Object Admin",
            "Vertex AI User"
          ],
          tests: { canWriteHealthDoc, canQueryRagSources }
       });
    }

    res.json({
       ok: true,
       projectId: process.env.GOOGLE_CLOUD_PROJECT,
       firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
       storageBucket: bucket.name,
       credentialsEmail,
       tests: {
          canWriteHealthDoc,
          canQueryRagSources,
          canSaveChat: canWriteHealthDoc,
          canUploadStorage: true
       },
       models: {
          pro: AI_MODELS.pro,
          default: AI_MODELS.default,
          fast: AI_MODELS.fast,
          search: AI_MODELS.search,
          urlContext: AI_MODELS.urlContext,
          activeFallbacks: require("./server/ai/client").getModelFallbackChain()
       },
       errors: []
    });
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
`;

code = code.replace(/app\.use\('\/api\/ai', aiRoutes\);/, `app.use('/api/ai', aiRoutes);\n${additionalRoutes}`);

fs.writeFileSync('server.ts', code);
