import { Router } from "express";
import { getAdminDb, requireUser } from "../firebase/admin";
import {
  FEATURE_CATEGORY_LABELS,
  PLATFORM_FEATURES,
  summarizeFeatureCatalog,
  type FeatureCategory,
  type FeatureDeliveryState,
} from "../../shared/platform/featureCatalog";

const router = Router();

function isAdminUser(user: any) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return Boolean(user?.admin || roles.includes("admin") || roles.includes("ops"));
}

router.get("/capabilities", async (req, res) => {
  try {
    const user = await requireUser(req);
    const category = String(req.query.category || "") as FeatureCategory;
    const state = String(req.query.state || "") as FeatureDeliveryState;
    const query = String(req.query.q || "").trim().toLowerCase();
    const admin = isAdminUser(user);

    let features = PLATFORM_FEATURES;
    if (category && category in FEATURE_CATEGORY_LABELS) features = features.filter((feature) => feature.category === category);
    if (["available", "foundation", "planned"].includes(state)) features = features.filter((feature) => feature.state === state);
    if (query) features = features.filter((feature) => `${feature.id} ${feature.title} ${feature.key}`.toLowerCase().includes(query));

    // Implementation file references are useful to maintainers but are not
    // exposed to ordinary students.
    const visibleFeatures = features.map((feature) => admin
      ? feature
      : { ...feature, implementationRefs: [] });

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      admin,
      categoryLabels: FEATURE_CATEGORY_LABELS,
      summary: summarizeFeatureCatalog(PLATFORM_FEATURES),
      filteredSummary: summarizeFeatureCatalog(features),
      features: visibleFeatures,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "CAPABILITY_CATALOG_FAILED", message: error.message });
  }
});

router.get("/health", async (req, res) => {
  try {
    const user = await requireUser(req);
    const admin = isAdminUser(user);
    const services = {
      firebaseAdmin: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_CLIENT_EMAIL),
      firebaseAppCheck: process.env.ENABLE_FIREBASE_APP_CHECK === "true",
      cloudVisionOcr: process.env.ENABLE_CLOUD_VISION_OCR === "true",
      geminiPdfOcr: Boolean(process.env.GEMINI_PDF_QA_MODEL || process.env.GEMINI_DEFAULT_MODEL),
      googleSearchGrounding: process.env.ENABLE_GOOGLE_SEARCH_GROUNDING === "true",
      secureVideoHls: Boolean(process.env.VIDEO_CDN_BASE_URL && process.env.VIDEO_SIGNING_KEY),
      tts: process.env.ENABLE_TTS === "true",
      liveVoice: process.env.ENABLE_GEMINI_LIVE === "true",
    };
    const configured = Object.values(services).filter(Boolean).length;
    return res.json({
      ok: true,
      status: configured >= 4 ? "operational" : "degraded",
      checkedAt: new Date().toISOString(),
      services,
      catalog: summarizeFeatureCatalog(),
      admin,
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "PLATFORM_HEALTH_FAILED", message: error.message });
  }
});

router.get("/source-review-queue", async (req, res) => {
  try {
    const user = await requireUser(req);
    if (!isAdminUser(user)) return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "Admin access is required." });
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const snap = await getAdminDb().collection("rag_sources").orderBy("updatedAt", "desc").limit(250).get();
    const sources = snap.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((source: any) => source.needsTextReview || source.indexStatus === "needs_ocr" || source.documentQuality?.corruptionRisk !== "low")
      .slice(0, limit)
      .map((source: any) => ({
        id: source.id,
        title: source.title || source.fileName,
        subject: source.subject || null,
        year: source.year || null,
        indexStatus: source.indexStatus || null,
        needsTextReview: Boolean(source.needsTextReview),
        lowConfidencePages: source.lowConfidencePages || [],
        documentQuality: source.documentQuality || null,
        duplicateOfSourceId: source.duplicateOfSourceId || null,
        updatedAt: source.updatedAt || null,
      }));
    return res.json({ ok: true, sources, total: sources.length });
  } catch (error: any) {
    return res.status(500).json({ ok: false, code: "SOURCE_REVIEW_QUEUE_FAILED", message: error.message });
  }
});

export default router;
