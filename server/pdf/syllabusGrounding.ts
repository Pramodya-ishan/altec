import { getAdminDb } from "../firebase/admin";
import { isVertexAiEnabled } from "../ai/client";
import { loadPdfSourceBuffer, storageGsUri, storageObjectPath, validatedPdfDownloadUrl } from "./sourceBuffer";

type GroundingPdf = { buffer?: Buffer | null; gcsUri?: string; sourceId: string; method: string };

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: Promise<GroundingPdf | null> }>();

function configuredSftSyllabusUrl() {
  return String(process.env.SFT_SYLLABUS_PDF_URL || "").trim();
}

function configuredSftSyllabusPath() {
  return String(process.env.SFT_SYLLABUS_STORAGE_PATH || "").trim();
}

async function findSftSyllabusSource(uid: string) {
  const db = getAdminDb();
  const snapshots = await Promise.allSettled([
    db.collection("users").doc(uid).collection("syllabus_resources").where("subject", "==", "SFT").limit(20).get(),
    db.collection("rag_sources").where("subject", "==", "SFT").where("sourceScope", "==", "owner_syllabus").limit(20).get(),
  ]);

  const candidates: Array<Record<string, any>> = [];
  for (const snapshot of snapshots) {
    if (snapshot.status !== "fulfilled") continue;
    snapshot.value.docs.forEach((doc: any) => candidates.push({ id: doc.id, ...doc.data() }));
  }

  return candidates.find((source) => {
    const text = `${source.title || ""} ${source.fileName || ""} ${source.storagePath || ""}`.toLowerCase();
    return /syllabus|syl_|curriculum/.test(text);
  }) || candidates[0] || null;
}

async function loadGroundingPdf(uid: string): Promise<GroundingPdf | null> {
  const configuredUrl = configuredSftSyllabusUrl();
  const configuredPath = storageObjectPath(configuredSftSyllabusPath());
  if (configuredUrl || configuredPath) {
    const storagePath = storageObjectPath(configuredUrl) || configuredPath;
    const verifiedUrl = configuredUrl ? validatedPdfDownloadUrl(configuredUrl, storagePath) : "";
    if (!storagePath || !/\.pdf$/i.test(storagePath) || (configuredUrl && !verifiedUrl)) {
      console.warn("[SFT_SYLLABUS] Ignoring invalid configured SFT syllabus location.");
    } else {
      const gcsUri = isVertexAiEnabled()
        ? storageGsUri(configuredUrl || configuredSftSyllabusPath(), storagePath)
        : "";
      if (gcsUri) {
        // Vertex can read the object with the service-account identity. This
        // avoids moving the syllabus through the Vercel function entirely.
        return { buffer: null, gcsUri, sourceId: "configured_sft_syllabus", method: "vertex_gcs_uri" };
      }
      try {
        const loaded = await loadPdfSourceBuffer({
          source: verifiedUrl ? { downloadUrl: verifiedUrl } : null,
          storagePath,
          submittedDownloadUrl: verifiedUrl,
        });
        return { buffer: loaded.buffer, sourceId: "configured_sft_syllabus", method: loaded.method };
      } catch (error: any) {
        throw error;
      }
    }
  }

  const source = await findSftSyllabusSource(uid);
  if (!source?.storagePath) return null;
  const gcsUri = isVertexAiEnabled() ? storageGsUri(source.storagePath) : "";
  if (gcsUri) {
    // The source inventory has already been authorized for this user. Let
    // Vertex read the private object with service-account IAM instead of
    // proxying syllabus bytes through a short-lived Vercel function.
    return {
      buffer: null,
      gcsUri,
      sourceId: source.id || source.sourceId || "sft_syllabus",
      method: "vertex_gcs_uri",
    };
  }
  try {
    const loaded = await loadPdfSourceBuffer({ source, storagePath: source.storagePath });
    return { buffer: loaded.buffer, sourceId: source.id || source.sourceId || "sft_syllabus", method: loaded.method };
  } catch (error: any) {
    throw error;
  }
}

export async function getSftSyllabusGroundingPdf(uid: string, subject: unknown) {
  if (String(subject || "").trim().toUpperCase() !== "SFT") return null;
  const key = `${uid}:SFT:${configuredSftSyllabusUrl() || configuredSftSyllabusPath() ? "configured" : "library"}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = loadGroundingPdf(uid).catch((error) => {
    console.warn("[SFT_SYLLABUS] Grounding PDF unavailable; continuing without fabricated evidence:", String(error?.message || error));
    return null;
  });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
