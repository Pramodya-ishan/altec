import { getAdminDb } from "../firebase/admin";

interface CacheEntry {
  data: any;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

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
    const normSubject = String(src.subject || "").trim().toUpperCase();
    const normYear = String(src.year || "").trim();
    const normResourceType = String(src.resourceType || src.sourceType || "").trim().toLowerCase();
    const normSourceScope = String(src.sourceScope || "").trim().toLowerCase();

    // Subject Filter
    if (subjectQuery && normSubject !== subjectQuery) return;
    // Year Filter
    if (yearQuery && normYear !== yearQuery) return;
    // Type Filter
    if (typeQuery && normResourceType !== typeQuery) return;

    // Access Filter: must be owner, or admin, or public/shared/official
    const isOwner = src.ownerUid === uid;
    const isPublic = ["official", "shared", "public"].includes(src.visibility);
    if (!isOwner && !isPublic && !isAdmin) return;

    const calcStatus = computeIndexStatus({
      chunkCount: Number(src.chunkCount || 0),
      needsOcr: src.needsOcr === true,
      needsLegacyConversion: src.needsLegacyConversion === true,
      textEncoding: src.textEncoding,
      indexStatus: src.indexStatus
    });

    const hasLegacyTextLayer = String(src.textEncoding || "").startsWith("legacy_");
    const normalizedNeedsOcr = !hasLegacyTextLayer && src.needsOcr === true;
    allSources.push({
      id: sId,
      sourceId: sId,
      title: src.title || src.fileName || "Untitled PDF",
      fileName: src.fileName || src.title || "untitled.pdf",
      subject: normSubject || null,
      lesson: src.lesson || src.topic || lessonFromStoragePath(src.storagePath) || null,
      year: normYear || null,
      resourceType: normResourceType || "uploaded_pdf",
      sourceScope: normSourceScope || null,
      storagePath: src.storagePath || null,
      ownerUid: src.ownerUid || null,
      chunkCount: Number(src.chunkCount || 0),
      needsOcr: normalizedNeedsOcr,
      needsLegacyConversion: src.needsLegacyConversion === true,
      textEncoding: src.textEncoding || "unknown",
      indexStatus: calcStatus,
      visibility: src.visibility || "private",
      sourceType: src.sourceType || normResourceType || null,
      tags: Array.isArray(src.tags) ? src.tags : [],
      textIndexed: Number(src.chunkCount || 0) > 0 && !normalizedNeedsOcr,
      createdAt: src.createdAt || null,
    });
  }

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
    images: []
  };

  allSources.forEach(src => {
    const rt = src.resourceType;
    const ss = src.sourceScope;

    if (rt === "marking_scheme" || rt === "marking") {
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
