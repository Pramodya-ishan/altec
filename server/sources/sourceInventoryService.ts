import { getAdminDb } from "../firebase/admin";

interface CacheEntry {
  data: any;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

export function extractTitleYear(...values: unknown[]) {
  for (const value of values) {
    const match = String(value || "").match(/\b(20\d{2})\b/);
    if (match) return match[1];
  }
  return "";
}

export function inferSubject(...values: unknown[]) {
  const text = values.map((value) => String(value || "")).join(" ");
  if (/\b(?:SFT|SCIENCE\s+FOR\s+TECHNOLOGY|67\s*S(?:\s|[-_/])*I{1,2})\b|තාක්ෂණවේදය\s+සඳහා\s+විද්(?:‍ය|ය)ාව/iu.test(text)) return "SFT";
  if (/\b(?:ICT|INFORMATION\s+(?:AND|&)\s+COMMUNICATION\s+TECHNOLOGY)\b|තොරතුරු\s+හා\s+සන්නිවේදන/iu.test(text)) return "ICT";
  if (/\b(?:ET|ENGINEERING\s+TECHNOLOGY)\b|ඉංජිනේරු\s+තාක්ෂණවේදය/iu.test(text)) return "ET";
  return "";
}

export function inferResourceType(src: any) {
  const explicit = String(src.resourceType || src.sourceType || "").trim().toLowerCase();
  const text = `${src.title || ""} ${src.fileName || ""} ${src.storagePath || ""}`.toLowerCase();

  if (explicit === "marking" || explicit === "marking_scheme") return "marking_scheme";
  if (/marking[ _-]*scheme|\bfull\s*sm\b|\banswers?\b|පිළිතුරු\s*පත්‍ර|ලකුණු\s*සම්මුතිය/.test(text)) return "marking_scheme";
  if (explicit === "paper_structure" || /paper[ _-]*structure|ප්‍රශ්න\s*පත්‍ර\s*ව්‍යුහ/.test(text)) return "paper_structure";
  if (explicit === "syllabus" || /\bsyllabus\b|විෂය\s*නිර්දේශ/.test(text)) return "syllabus";
  if (explicit === "past_paper" || /past[ _-]*paper|official[ _-]*paper|\b(?:sft|et|ict)\s*paper\b|විභාග\s*ප්‍රශ්න\s*පත්‍ර/.test(text)) return "past_paper";
  if (explicit === "image" || explicit === "image_upload") return explicit;
  return explicit || "uploaded_pdf";
}

function normalizedUrl(value: unknown) {
  return String(value || "").trim();
}

function canonicalSourceKey(src: any) {
  const title = String(src.title || src.fileName || "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[^a-z0-9\u0d80-\u0dff]+/g, " ")
    .trim();
  if (title.length >= 6 && (src.subject || src.year || src.resourceType !== "uploaded_pdf")) {
    return `meta:${src.subject || ""}:${src.year || ""}:${src.resourceType || ""}:${title}`;
  }

  const storage = String(src.storagePath || "").replace(/^gs:\/\/[^/]+\//, "").toLowerCase();
  if (storage) return `storage:${storage}`;

  const downloadUrl = normalizedUrl(src.downloadUrl || src.firebaseDownloadUrl || src.url)
    .replace(/[?&]token=[^&]+/i, "")
    .toLowerCase();
  if (downloadUrl) return `url:${downloadUrl}`;
  return `meta:${src.subject || ""}:${src.year || ""}:${src.resourceType || ""}:${title}`;
}

function sourceQuality(src: any) {
  return (src.storagePath ? 40 : 0)
    + (src.downloadUrl || src.url ? 25 : 0)
    + (Number(src.chunkCount || 0) > 0 ? 20 : 0)
    + (src.visibility === "official" || src.sourceScope === "official" ? 15 : 0)
    + (src.subject ? 5 : 0)
    + (src.year ? 5 : 0);
}

function mergeSources(left: any, right: any) {
  const primary = sourceQuality(right) > sourceQuality(left) ? right : left;
  const secondary = primary === right ? left : right;
  return {
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    sourceId: primary.sourceId || primary.id || secondary.sourceId || secondary.id,
    title: primary.title || secondary.title,
    fileName: primary.fileName || secondary.fileName,
    storagePath: primary.storagePath || secondary.storagePath || null,
    downloadUrl: primary.downloadUrl || secondary.downloadUrl || null,
    firebaseDownloadUrl: primary.firebaseDownloadUrl || secondary.firebaseDownloadUrl || null,
    url: primary.url || secondary.url || null,
    chunkCount: Math.max(Number(left.chunkCount || 0), Number(right.chunkCount || 0)),
    tags: [...new Set([...(Array.isArray(left.tags) ? left.tags : []), ...(Array.isArray(right.tags) ? right.tags : [])])],
    duplicateSourceIds: [...new Set([
      ...(Array.isArray(left.duplicateSourceIds) ? left.duplicateSourceIds : [left.sourceId || left.id]),
      ...(Array.isArray(right.duplicateSourceIds) ? right.duplicateSourceIds : [right.sourceId || right.id]),
    ].filter(Boolean))],
  };
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

  const subjectQuery = subject ? String(subject).toUpperCase() : null;
  const yearQuery = year ? String(year) : null;
  const typeQuery = resourceType ? String(resourceType).toLowerCase() : null;

  const canonicalSources = new Map<string, any>();

  function addSource(src: any) {
    if (!src) return;
    const sId = src.sourceId || src.id;
    if (!sId) return;

    // Normalize fields
    const title = src.title || src.fileName || "Untitled PDF";
    const fileName = src.fileName || src.title || "untitled.pdf";
    const explicitSubject = String(src.subject || "").trim().toUpperCase();
    const normSubject = (["SFT", "ET", "ICT"].includes(explicitSubject) ? explicitSubject : "")
      || inferSubject(title, fileName, src.storagePath, src.tags);
    const titleYear = extractTitleYear(title, fileName, src.storagePath);
    const explicitYear = String(src.year || "").trim();
    // File titles are a stronger signal than stale manually-entered metadata.
    const normYear = titleYear || explicitYear;
    const normResourceType = inferResourceType(src);
    const normSourceScope = String(src.sourceScope || "").trim().toLowerCase();

    // Subject Filter
    if (subjectQuery && normSubject !== subjectQuery) return;
    // Year Filter
    if (yearQuery && normYear !== yearQuery) return;
    // Type Filter
    if (typeQuery && normResourceType !== typeQuery) return;

    // Access Filter: must be owner, or admin, or public/shared/official
    const isOwner = src.ownerUid === uid;
    const isPublic = ["official", "shared", "public"].includes(String(src.visibility || "").toLowerCase())
      || ["official", "shared", "public"].includes(normSourceScope);
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
    const normalized = {
      id: sId,
      sourceId: sId,
      title,
      fileName,
      subject: normSubject || null,
      lesson: src.lesson || src.topic || lessonFromStoragePath(src.storagePath) || null,
      year: normYear || null,
      metadataYear: explicitYear || null,
      resourceType: normResourceType || "uploaded_pdf",
      sourceScope: normSourceScope || null,
      storagePath: src.storagePath || null,
      downloadUrl: src.downloadUrl || src.firebaseDownloadUrl || null,
      firebaseDownloadUrl: src.firebaseDownloadUrl || src.downloadUrl || null,
      url: src.url || src.downloadUrl || src.firebaseDownloadUrl || null,
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
      duplicateSourceIds: [sId],
    };

    const key = canonicalSourceKey(normalized);
    const existing = canonicalSources.get(key);
    canonicalSources.set(key, existing ? mergeSources(existing, normalized) : normalized);
  }

  // Process C (Syllabus resources)
  syllabusDocs.forEach((doc: any) => {
    addSource({ ...doc, resourceType: "syllabus", sourceScope: "owner_syllabus" });
  });

  // Process A (Past papers)
  ppDocs.forEach((doc: any) => {
    addSource({
      ...doc,
      resourceType: inferResourceType(doc) === "uploaded_pdf" ? "past_paper" : inferResourceType(doc),
      sourceScope: doc.sourceScope || "official",
      visibility: doc.visibility || "official",
    });
  });

  // Process B (RAG sources)
  ragDocs.forEach((doc: any) => {
    addSource(doc);
  });

  const allSources = [...canonicalSources.values()];

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

  const sortByYearAndTitle = (a: any, b: any) => {
    const yearDiff = Number(b.year || 0) - Number(a.year || 0);
    return yearDiff || String(a.title || "").localeCompare(String(b.title || ""));
  };
  Object.values(groups).forEach((list: any) => list.sort(sortByYearAndTitle));

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
