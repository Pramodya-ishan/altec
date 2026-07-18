import { getAdminDb } from "../firebase/admin";
import { isVertexAiEnabled } from "../ai/client";
import { loadPdfSourceBuffer, storageGsUri, storageObjectPath, validatedPdfDownloadUrl } from "./sourceBuffer";

type GroundingPdf = { buffer?: Buffer | null; gcsUri?: string; sourceId: string; method: string };
type SupportedSubject = "SFT" | "ET" | "ICT";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: Promise<GroundingPdf | null> }>();

function normalizeSubject(value: unknown): SupportedSubject | null {
  const subject = String(value || "").trim().toUpperCase();
  return subject === "SFT" || subject === "ET" || subject === "ICT" ? subject : null;
}

function configuredSyllabusUrl(subject: SupportedSubject) {
  return String(process.env[`${subject}_SYLLABUS_PDF_URL`] || "").trim();
}

function configuredSyllabusPath(subject: SupportedSubject) {
  return String(process.env[`${subject}_SYLLABUS_STORAGE_PATH`] || "").trim();
}

async function findSubjectSyllabusSource(uid: string, subject: SupportedSubject) {
  const db = getAdminDb();
  const snapshots = await Promise.allSettled([
    db.collection("users").doc(uid).collection("syllabus_resources").where("subject", "==", subject).limit(30).get(),
    db.collection("rag_sources").where("subject", "==", subject).where("sourceScope", "==", "owner_syllabus").limit(30).get(),
    db.collection("rag_sources").where("subject", "==", subject).where("resourceType", "==", "syllabus").limit(30).get(),
  ]);

  const candidates: Array<Record<string, any>> = [];
  for (const snapshot of snapshots) {
    if (snapshot.status !== "fulfilled") continue;
    snapshot.value.docs.forEach((doc: any) => candidates.push({ id: doc.id, ...doc.data() }));
  }

  const visibleCandidates = candidates.filter((source) => {
    const visibility = String(source.visibility || "").toLowerCase();
    return source.ownerUid === uid
      || source.createdBy === uid
      || source.published === true
      || ["public", "official", "shared", "class"].includes(visibility)
      || source.sourceScope === "owner_syllabus";
  });

  return visibleCandidates.find((source) => {
    const text = `${source.title || ""} ${source.fileName || ""} ${source.storagePath || ""}`.toLowerCase();
    return /syllabus|syl_|curriculum|විෂය නිර්දේශ/.test(text);
  }) || visibleCandidates[0] || null;
}

async function loadGroundingPdf(uid: string, subject: SupportedSubject): Promise<GroundingPdf | null> {
  const configuredUrl = configuredSyllabusUrl(subject);
  const configuredPath = storageObjectPath(configuredSyllabusPath(subject));
  if (configuredUrl || configuredPath) {
    const storagePath = storageObjectPath(configuredUrl) || configuredPath;
    const verifiedUrl = configuredUrl ? validatedPdfDownloadUrl(configuredUrl, storagePath) : "";
    if (!storagePath || !/\.pdf$/i.test(storagePath) || (configuredUrl && !verifiedUrl)) {
      console.warn(`[${subject}_SYLLABUS] Ignoring invalid configured syllabus location.`);
    } else {
      const gcsUri = isVertexAiEnabled()
        ? storageGsUri(configuredUrl || configuredSyllabusPath(subject), storagePath)
        : "";
      if (gcsUri) {
        return { buffer: null, gcsUri, sourceId: `configured_${subject.toLowerCase()}_syllabus`, method: "vertex_gcs_uri" };
      }
      const loaded = await loadPdfSourceBuffer({
        source: verifiedUrl ? { downloadUrl: verifiedUrl } : null,
        storagePath,
        submittedDownloadUrl: verifiedUrl,
      });
      return { buffer: loaded.buffer, sourceId: `configured_${subject.toLowerCase()}_syllabus`, method: loaded.method };
    }
  }

  const source = await findSubjectSyllabusSource(uid, subject);
  if (!source?.storagePath && !source?.downloadUrl && !source?.url) return null;
  const gcsUri = isVertexAiEnabled() ? storageGsUri(source.storagePath || source.downloadUrl || source.url) : "";
  if (gcsUri) {
    return {
      buffer: null,
      gcsUri,
      sourceId: source.id || source.sourceId || `${subject.toLowerCase()}_syllabus`,
      method: "vertex_gcs_uri",
    };
  }
  const loaded = await loadPdfSourceBuffer({ source, storagePath: source.storagePath });
  return {
    buffer: loaded.buffer,
    sourceId: source.id || source.sourceId || `${subject.toLowerCase()}_syllabus`,
    method: loaded.method,
  };
}

export async function getSubjectSyllabusGroundingPdf(uid: string, subjectValue: unknown) {
  const subject = normalizeSubject(subjectValue);
  if (!subject) return null;
  const configuredLocation = configuredSyllabusUrl(subject) || configuredSyllabusPath(subject) ? "configured" : "library";
  const key = `${uid}:${subject}:${configuredLocation}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = loadGroundingPdf(uid, subject).catch((error) => {
    console.warn(`[${subject}_SYLLABUS] Grounding PDF unavailable; continuing with indexed syllabus evidence:`, String(error?.message || error));
    return null;
  });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

// Backward-compatible export used by older call sites.
export async function getSftSyllabusGroundingPdf(uid: string, subject: unknown) {
  return getSubjectSyllabusGroundingPdf(uid, subject);
}
