import { getAdminDb } from "../firebase/admin";
import { isStudentVisibleSource } from "../utils/contentPermissions";

interface CacheEntry {
  data: any;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

function inventoryText(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTitleYear(value: unknown): string | null {
  return inventoryText(value).match(/\b(20\d{2})\b/)?.[1] || null;
}

export function inferSubject(value: unknown): "SFT" | "ET" | "ICT" | null {
  const text = inventoryText(
    typeof value === "object" && value !== null
      ? `${(value as any).subject || ""} ${(value as any).title || ""} ${(value as any).fileName || ""}`
      : value,
  );
  if (/\bSFT\b|SCIENCE\s+FOR\s+TECHNOLOGY|තාක්ෂණවේදය\s+සඳහා\s+විද්‍යාව/i.test(text)) return "SFT";
  if (/\bICT\b|INFORMATION\s+(?:AND|&)\s+COMMUNICATION\s+TECHNOLOGY|තොරතුරු\s+හා\s+සන්නිවේදන/i.test(text)) return "ICT";
  if (/\bET\b|ENGINEERING\s+TECHNOLOGY|ඉංජිනේරු\s+තාක්ෂණවේදය/i.test(text)) return "ET";
  return null;
}

export function inferResourceType(source: unknown): string {
  const record = typeof source === "object" && source !== null ? source as Record<string, unknown> : {};
  const explicit = inventoryText(record.resourceType || record.sourceType).toLowerCase();
  if (explicit) return explicit;

  const text = inventoryText(`${record.title || source || ""} ${record.fileName || ""}`).toLowerCase();
  if (/marking\s*scheme|answer\s*scheme|\bfull\s+sm\b|\bsm\b|පිළිතුරු/.test(text)) return "marking_scheme";
  if (/past\s*paper|official\s*paper|model\s*paper|\bpaper\b|විභාග/.test(text)) return "past_paper";
  if (/syllabus|curriculum/.test(text)) return "syllabus";
  if (/\.(?:png|jpe?g|webp|gif)\b/.test(text)) return "image";
  return "uploaded_pdf";
}

function lessonFromStoragePath(storagePath: unknown) {
  const path = String(storagePath || "").replace(/^gs:\/\/[^/]+\//, "");
  const parts = path.split("/").filter(Boolean);
  const marker = parts.indexOf("paper_structure");
  if (marker < 0 || !parts[marker + 2]) return null;
  try {
    return decodeURIComponent(parts[marker + 2]).replace(/_/g, " ").trim() || null;
  } catch {
    return parts[marker + 2].replace(/_/g, " ").trim() || null;
  }
}

export function invalidateInventoryCache(uid: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${uid}:`) || key.startsWith("all:") || key.startsWith("admin:")) {
      cache.delete(key);
    }
  }
}

export function computeIndexStatus(src: {
  chunkCount?: number;
  needsOcr?: boolean;
  needsLegacyConversion?: boolean;
  textEncoding?: string;
  indexStatus?: string;
}) {
  const chunkCount = Number(src.chunkCount || 0);
  const currentStatus = String(src.indexStatus || "").toLowerCase();
  const hasLegacyTextLayer = String(src.textEncoding || "").startsWith("legacy_");
  const needsOcr = !hasLegacyTextLayer && (src.needsOcr === true || src.indexStatus === "needs_ocr");
  const needsLegacy = src.needsLegacyConversion === true || src.indexStatus === "needs_legacy_conversion";

  if (["queued", "running", "processing", "indexing"].includes(currentStatus)) return currentStatus;
  if (currentStatus === "failed") return "failed";
  if (chunkCount > 0 && (src.needsOcr === false || src.indexStatus === "ready")) {
    return "ready";
  }
  if (needsLegacy) {
    return "needs_legacy_conversion";
  }
  if (needsOcr) return "needs_ocr";
  if (chunkCount === 0) return "not_indexed";
  return "not_indexed";
}

export async function getSourceInventory(params: {
  uid: string;
  subject?: string;
  year?: string;
  resourceType?: string;
  isAdmin?: boolean;
}) {
  const { uid, subject, year, resourceType, isAdmin } = params;

  // Key format: uid:subject:year:resourceType:isAdmin
  const cacheKey = `${uid}:${subject || "all"}:${year || "all"}:${resourceType || "all"}:${isAdmin ? "admin" : "user"}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && cached.expiry > now) {
    return cached.data;
  }

  const db = getAdminDb();

  // A. Query past_papers collection
  let ppQuery = db.collection("past_papers");
  const ppSnap = await ppQuery.get();
  const ppDocs = ppSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // B. Query rag_sources collection
  let ragQuery = db.collection("rag_sources");
  const ragSnap = await ragQuery.get();
  const ragDocs = ragSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // C. Query users/{uid}/syllabus_resources
  let syllabusDocs: any[] = [];
  try {
    const sylSnap = await db.collection("users").doc(uid).collection("syllabus_resources").get();
    syllabusDocs = sylSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn("Failed to query syllabus_resources for inventory", e);
  }

  // D. Query authoritative shared lesson resources. These records own
  // publication/visibility metadata while rag_sources owns extracted text.
  let lessonResourceDocs: any[] = [];
  try {
    const lessonSnapshot = await db.collection("lesson_resources").get();
    lessonResourceDocs = lessonSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.warn("Failed to query lesson_resources for inventory", e);
  }

  const ragBySourceId = new Map<string, any>();
  for (const source of ragDocs) {
    const key = String(source.sourceId || source.id || "");
    if (key) ragBySourceId.set(key, source);
  }

  const subjectQuery = subject ? String(subject).toUpperCase() : null;
  const yearQuery = year ? String(year) : null;
  const typeQuery = resourceType ? String(resourceType).toLowerCase() : null;

  const allSources: any[] = [];
  const sourceIds = new Set();

  function addSource(src: any) {
    if (!src) return;
    const sId = src.sourceId || src.id;
    if (!sId) return;
    if (sourceIds.has(sId)) return;
    sourceIds.add(sId);

    // Normalize fields
    const normSubject = String(src.subject || inferSubject(src) || "").trim().toUpperCase();
    const normYear = String(src.year || extractTitleYear(src.title || src.fileName) || "").trim();
    const normResourceType = inferResourceType(src);
    const normSourceScope = String(src.sourceScope || "").trim().toLowerCase();

    // Subject Filter
    if (subjectQuery && normSubject !== subjectQuery) return;
    // Year Filter
    if (yearQuery && normYear !== yearQuery) return;
    // Type Filter
    if (typeQuery && normResourceType !== typeQuery) return;

    // Access filter. Legacy administrator resources may still say
    // visibility=private, but their shared sourceScope proves they were meant
    // for students. Personal/chat uploads never pass isStudentVisibleSource.
    const isOwner = src.ownerUid === uid || src.createdBy === uid;
    const isVisibleToStudents = isStudentVisibleSource(src);
    if (!isOwner && !isVisibleToStudents && !isAdmin) return;
    if (String(src.processingStatus || "").toLowerCase() === "archived") return;

    const calcStatus = computeIndexStatus({
      chunkCount: Number(src.chunkCount || 0),
      needsOcr: src.needsOcr === true,
      needsLegacyConversion: src.needsLegacyConversion === true,
      textEncoding: src.textEncoding,
      indexStatus: src.indexStatus || src.processingStatus
    });

    const hasLegacyTextLayer = String(src.textEncoding || "").startsWith("legacy_");
    const normalizedNeedsOcr = !hasLegacyTextLayer && src.needsOcr === true;
    allSources.push({
      id: sId,
      sourceId: sId,
      title: src.title || src.fileName || "Untitled PDF",
      fileName: src.fileName || src.title || "untitled.pdf",
      subject: normSubject || null,
      lesson: src.lessonTitle || src.lesson || src.topic || lessonFromStoragePath(src.storagePath) || null,
      lessonId: src.lessonId || null,
      lessonTitle: src.lessonTitle || src.lesson || src.topic || null,
      year: normYear || null,
      resourceType: normResourceType || "uploaded_pdf",
      sourceScope: normSourceScope || null,
      storagePath: src.storagePath || null,
      ownerUid: src.ownerUid || src.createdBy || null,
      chunkCount: Number(src.chunkCount || 0),
      needsOcr: normalizedNeedsOcr,
      needsLegacyConversion: src.needsLegacyConversion === true,
      textEncoding: src.textEncoding || "unknown",
      indexStatus: calcStatus,
      processingStatus: src.processingStatus || calcStatus,
      visibility: src.visibility || "private",
      published: src.published === true,
      mediaKind: src.mediaKind || (normResourceType === "image" ? "image" : "pdf"),
      videoId: src.videoId || null,
      sourceType: src.sourceType || normResourceType || null,
      tags: Array.isArray(src.tags) ? src.tags : [],
      textIndexed: src.textIndexed === true || (Number(src.chunkCount || 0) > 0 && !normalizedNeedsOcr),
      createdAt: src.createdAt || null,
    });
  }

  // Process D first so shared publication metadata wins over legacy private
  // rag_sources rows with the same sourceId.
  lessonResourceDocs.forEach((doc: any) => {
    const sourceId = String(doc.sourceId || doc.id || "");
    const extracted = ragBySourceId.get(sourceId) || {};
    addSource({
      ...extracted,
      ...doc,
      id: sourceId || doc.id,
      sourceId: sourceId || doc.id,
      indexStatus: extracted.indexStatus || doc.processingStatus,
      chunkCount: Number(extracted.chunkCount || doc.chunkCount || 0),
      textEncoding: extracted.textEncoding || doc.textEncoding,
      needsLegacyConversion: extracted.needsLegacyConversion === true,
      needsOcr: doc.needsOcr === true || extracted.needsOcr === true,
      textIndexed: doc.textIndexed === true || extracted.textIndexed === true || Number(extracted.chunkCount || 0) > 0,
    });
  });

  // Process C (Syllabus resources)
  syllabusDocs.forEach((doc: any) => {
    addSource({ ...doc, resourceType: "syllabus", sourceScope: "owner_syllabus" });
  });

  // Process A (Past papers)
  ppDocs.forEach((doc: any) => {
    addSource(doc);
  });

  // Process B (RAG sources)
  ragDocs.forEach((doc: any) => {
    addSource(doc);
  });

  // Now group them
  const groups: any = {
    pastPapers: [],
    markingSchemes: [],
    syllabus: [],
    paperStructure: [],
    uploadedPdfs: [],
    images: [],
    videos: []
  };

  allSources.forEach(src => {
    const rt = src.resourceType;
    const ss = src.sourceScope;

    if (src.mediaKind === "video") {
      groups.videos.push(src);
    } else if (rt === "marking_scheme" || rt === "marking") {
      groups.markingSchemes.push(src);
    } else if (rt === "syllabus" || ss === "owner_syllabus") {
      groups.syllabus.push(src);
    } else if (rt === "paper_structure" || ss === "paper_structure") {
      groups.paperStructure.push(src);
    } else if (rt === "image" || rt === "image_upload") {
      groups.images.push(src);
    } else if (rt === "past_paper") {
      groups.pastPapers.push(src);
    } else {
      groups.uploadedPdfs.push(src);
    }
  });

  const result = {
    groups,
    total: allSources.length,
    all: allSources
  };

  // Cache for 5 minutes (300,000 ms)
  cache.set(cacheKey, {
    data: result,
    expiry: now + 5 * 60 * 1000
  });

  return result;
}
