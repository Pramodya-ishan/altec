import { Router } from "express";
import { requireUser, getAdminDb, getAdminBucket } from "../firebase/admin";
import crypto from "crypto";

export const ttsRoutes = Router();

const TTS_MAX_CHARS = parseInt(process.env.TTS_MAX_CHARS || "4500", 10);
const DAILY_TTS_LIMIT_PER_USER = 20;

function createTextHash(text: string, language: string, voice: string) {
  const normalized = text.trim().toLowerCase();
  return crypto.createHash("sha256").update(`${normalized}_${language}_${voice}`).digest("hex");
}

ttsRoutes.post("/generate", async (req, res) => {
  try {
    const user = await requireUser(req);
    const { text, languageCode, voice = "auto", format = "mp3" } = req.body;
    
    if (process.env.ENABLE_TTS === "false") {
      return res.status(403).json({ ok: false, code: "TTS_DISABLED", message: "TTS is disabled" });
    }

    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "Text is required" });
    }

    const cleanText = text.replace(/```json[\s\S]*?```/g, "").replace(/\[.*?\]/g, "").trim();

    if (cleanText.length > TTS_MAX_CHARS) {
      return res.status(400).json({ ok: false, code: "TTS_TEXT_TOO_LONG", message: `Text exceeds ${TTS_MAX_CHARS} characters` });
    }

    const lang = languageCode || process.env.TTS_DEFAULT_LANGUAGE || "si-LK";
    
    const adminDb = getAdminDb();
    
    // Cache check
    const textHash = createTextHash(cleanText, lang, voice);
    const cacheRef = adminDb.collection("tts_cache").doc(textHash);
    
    if (process.env.ENABLE_TTS_CACHE === "true") {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const data = cacheDoc.data();
        if (data?.storagePath) {
          return res.json({ ok: true, cached: true, storagePath: data.storagePath, provider: data.provider, voice: data.voice });
        }
      }
    }

    // Check Daily Limit
    const today = new Date().toISOString().split("T")[0];
    const usageRef = adminDb.collection("users").doc(user.uid).collection("usage").doc(`tts_${today}`);
    let dailyUsage = 0;
    
    if (process.env.ENABLE_TTS_LIMITS === "true") {
      const usageDoc = await usageRef.get();
      dailyUsage = usageDoc.exists ? (usageDoc.data()?.count || 0) : 0;
      if (dailyUsage >= DAILY_TTS_LIMIT_PER_USER) {
        return res.status(429).json({ ok: false, code: "TTS_DAILY_LIMIT", message: "Daily TTS limit reached." });
      }
    }

    // Call Google Cloud TTS (use our generateGoogleTts but upload to bucket)
    const { generateGoogleTts } = await import("./googleTts");
    const audioData = await generateGoogleTts({ text: cleanText, languageCode: lang, voice });

    const requestId = crypto.randomUUID();
    const storagePath = `users/${user.uid}/tts/${requestId}/voice.mp3`;
    
    const storageBucket = getAdminBucket();
    const file = storageBucket.file(storagePath);
    await file.save(audioData.buffer, {
      contentType: "audio/mpeg",
    });

    const metadata = {
      id: requestId,
      ownerUid: user.uid,
      ownerEmail: user.email || "",
      textHash,
      language: lang,
      voice: audioData.voiceName || voice,
      provider: "google_cloud",
      storagePath,
      contentType: "audio/mpeg",
      chars: cleanText.length,
      createdAt: new Date().toISOString()
    };
    await adminDb.collection("tts_outputs").doc(requestId).set(metadata);
    
    if (process.env.ENABLE_TTS_CACHE === "true") {
      await cacheRef.set({ storagePath, provider: "google_cloud", voice: audioData.voiceName || voice, createdAt: new Date().toISOString() });
    }
    
    if (process.env.ENABLE_TTS_LIMITS === "true") {
      await usageRef.set({ count: dailyUsage + 1 }, { merge: true });
    }

    let audioUrl = "";
    try {
      const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 });
      audioUrl = signedUrl;
    } catch (e) {
      // ignore
    }

    res.json({
      ok: true,
      audioUrl,
      storagePath,
      chars: cleanText.length,
      provider: "google_cloud",
      voice: audioData.voiceName || voice
    });

  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ 
      ok: false, 
      code: error.code || "TTS_FAILED", 
      message: error.message,
      providerError: error.providerError
    });
  }
});
