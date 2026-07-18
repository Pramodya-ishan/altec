import { readFile } from "node:fs/promises";
import { getAdminDb } from "../firebase/admin";
import { isVertexAiEnabled } from "../ai/client";
import { loadPdfSourceBuffer, storageGsUri, storageObjectPath, validatedPdfDownloadUrl } from "./sourceBuffer";

type GroundingPdf = { buffer?: Buffer | null; gcsUri?: string; sourceId: string; method: string };
type SupportedSubject = "SFT" | "ET" | "ICT";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: Promise<GroundingPdf | null> }>();
const DEFAULT_SFT_SYLLABUS_STORAGE_PATH = "users/7kUEmzikv8hat7KQg8pCNGR1ZUd2/syllabus/SFT/syllabus/general/2deba588-86ac-4393-b001-c6fe657a48c3/sALSyl_SFT.pdf";

function normalizeSubject(value: unknown): SupportedSubject | null {
  const subject = String(value || "").trim().toUpperCase();
  return subject === "SFT" || subject === "ET" || subject === "ICT" ? subject : null;
}

function configuredSyllabusUrl(subject: SupportedSubject) {
  return String(process.env[`${subject}_SYLLABUS_PDF_URL`] || "").trim();
}

function configuredSyllabusPath(subject: SupportedSubject) {
  const configured = String(process.env[`${subject}_SYLLABUS_STORAGE_PATH`] || "").trim();
  if (configured) return configured;
  return subject === "SFT" ? DEFAULT_SFT_SYLLABUS_STORAGE_PATH : "";
}

async function loadBundledSftSyllabus(): Promise<GroundingPdf | null> {
  const runtimeBase = (globalThis as any).__ALTEC_RUNTIME_URL__ || import.meta.url;
  const candidates = [
    new URL("./authoritative/sft/sALSyl_SFT.pdf", runtimeBase),
    new URL("../../assets/authoritative/sft/sALSyl_SFT.pdf", import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      const buffer = await readFile(candidate);
      if (buffer.length > 10_000) {
        return { buffer, sourceId: "bundled_sft_syllabus", method: "bundled_authoritative_pdf" };
      }
    } catch {
      // Try the next local/runtime location.
    }
  }
  return null;
}

async function findSubjectSyllabusSource(uid: string, subject: SupportedSubject) {
  const db = getAdminDb();
  const snapshots = await Promise.allSettled([
    db.collection("users").doc(uid).collection("syllabus_resources").where("subject", "==", subject).limit(50).get(),
    db.collection("rag_sources").where("subject", "==", subject).where("sourceScope", "==", "owner_syllabus").limit(50).get(),
    db.collection("rag_sources").where("subject", "==", subject).where("resourceType", "==", "syllabus").limit(50).get(),
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

  const ranked = visibleCandidates.sort((left, right) => {
    const score = (source: any) => {
      const text = `${source.title || ""} ${source.fileName || ""} ${source.storagePath || ""}`.toLowerCase();
      let value = 0;
      if (/salsyl_sft|salsyl|official.*syllabus|sft.*syllabus/.test(text)) value += 100;
      if (/syllabus|curriculum|විෂය නිර්දේශ/.test(text)) value += 50;
      if (source.visibility === "official") value += 20;
      if (source.published === true) value += 10;
      return value;
    };
    return score(right) - score(left);
  });
  return ranked[0] || null;
}

async function loadConfiguredGroundingPdf(subject: SupportedSubject): Promise<GroundingPdf | null> {
  const configuredUrl = configuredSyllabusUrl(subject);
  const configuredPath = storageObjectPath(configuredSyllabusPath(subject));
  if (!configuredUrl && !configuredPath) return null;

  const storagePath = storageObjectPath(configuredUrl) || configuredPath;
  const verifiedUrl = configuredUrl ? validatedPdfDownloadUrl(configuredUrl, storagePath) : "";
  if (!storagePath || !/\.pdf$/i.test(storagePath) || (configuredUrl && !verifiedUrl)) {
    console.warn(`[${subject}_SYLLABUS] Ignoring invalid configured syllabus location.`);
    return null;
  }

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

async function loadGroundingPdf(uid: string, subject: SupportedSubject): Promise<GroundingPdf | null> {
  try {
    const configured = await loadConfiguredGroundingPdf(subject);
    if (configured) return configured;
  } catch (error) {
    console.warn(`[${subject}_SYLLABUS] Configured syllabus unavailable:`, String((error as any)?.message || error));
  }

  const source = await findSubjectSyllabusSource(uid, subject).catch(() => null);
  if (source?.storagePath || source?.downloadUrl || source?.url) {
    try {
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
    } catch (error) {
      console.warn(`[${subject}_SYLLABUS] Library syllabus unavailable:`, String((error as any)?.message || error));
    }
  }

  if (subject === "SFT") return loadBundledSftSyllabus();
  return null;
}

export async function getSubjectSyllabusGroundingPdf(uid: string, subjectValue: unknown) {
  const subject = normalizeSubject(subjectValue);
  if (!subject) return null;
  const configuredLocation = configuredSyllabusUrl(subject) || configuredSyllabusPath(subject) ? "configured" : "library";
  const key = `${uid}:${subject}:${configuredLocation}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = loadGroundingPdf(uid, subject).catch((error) => {
    console.warn(`[${subject}_SYLLABUS] Grounding PDF unavailable:`, String(error?.message || error));
    return null;
  });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

export async function getSftSyllabusGroundingPdf(uid: string, subject: unknown) {
  return getSubjectSyllabusGroundingPdf(uid, subject);
}
