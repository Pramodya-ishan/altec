import { getAdminDb } from "../../firebase/admin";
import { isVertexAiEnabled } from "../../ai/client";
import { getSubjectSyllabusGroundingPdf } from "../../pdf/syllabusGrounding";
import { loadPdfSourceBuffer, storageGsUri } from "../../pdf/sourceBuffer";
import { getSourceInventory } from "../../sources/sourceInventoryService";
import { normalizePredictionSubject } from "./predictionPolicy";

export interface SyllabusCorpusDocument {
  sourceId: string;
  title: string;
  storagePath?: string | null;
  method: string;
  gcsUri?: string;
  buffer?: Buffer;
}

function isSyllabusSource(source: any) {
  const text = `${source?.resourceType || ""} ${source?.sourceType || ""} ${source?.sourceScope || ""} ${source?.title || ""} ${source?.fileName || ""}`.toLowerCase();
  return /syllabus|curriculum|විෂය\s*නිර්දේශ/.test(text);
}

function syllabusSourceScore(source: any) {
  const text = `${source?.title || ""} ${source?.fileName || ""}`.toLowerCase();
  let score = 0;
  if (source?.visibility === "official") score += 100;
  if (source?.published === true) score += 60;
  if (/official|national|nie|department|salsyl/.test(text)) score += 80;
  if (/syllabus|curriculum/.test(text)) score += 40;
  if (source?.textIndexed === true) score += 20;
  return score;
}

async function loadInventoryDocument(source: any): Promise<SyllabusCorpusDocument | null> {
  const sourceId = String(source?.sourceId || source?.id || "").trim();
  const storagePath = String(source?.storagePath || "").trim();
  if (!sourceId || !storagePath) return null;
  const gcsUri = isVertexAiEnabled() ? storageGsUri(storagePath) : "";
  if (gcsUri) {
    return { sourceId, title: String(source.title || source.fileName || "Syllabus PDF"), storagePath, method: "vertex_gcs_uri", gcsUri };
  }
  const loaded = await loadPdfSourceBuffer({ source, storagePath }).catch(() => null);
  return loaded?.buffer
    ? { sourceId, title: String(source.title || source.fileName || "Syllabus PDF"), storagePath, method: loaded.method, buffer: loaded.buffer }
    : null;
}

export async function loadSubjectSyllabusCorpus(params: {
  uid: string;
  subject: unknown;
  isAdmin?: boolean;
  maxDocuments?: number;
}) {
  const subject = normalizePredictionSubject(params.subject);
  const maxDocuments = Math.max(1, Math.min(30, Number(params.maxDocuments || 24)));
  const inventory = await getSourceInventory({ uid: params.uid, subject, isAdmin: params.isAdmin === true });
  const candidates = (inventory.all || [])
    .filter(isSyllabusSource)
    .sort((left: any, right: any) => syllabusSourceScore(right) - syllabusSourceScore(left));
  const selected = candidates.slice(0, maxDocuments);
  const primary = await getSubjectSyllabusGroundingPdf(params.uid, subject).catch(() => null);
  const documents: SyllabusCorpusDocument[] = [];
  if (primary) {
    documents.push({
      sourceId: String(primary.sourceId || `primary_${subject.toLowerCase()}_syllabus`),
      title: `Authoritative ${subject} syllabus`,
      method: String(primary.method || "primary"),
      gcsUri: primary.gcsUri || undefined,
      buffer: primary.buffer || undefined,
    });
  }

  const loaded = await Promise.all(selected.map((source: any) => loadInventoryDocument(source)));
  const seen = new Set(documents.map((document) => `${document.sourceId}|${document.gcsUri || ""}|${document.storagePath || ""}`));
  let inlineBytes = documents.reduce((sum, document) => sum + Number(document.buffer?.length || 0), 0);
  const MAX_INLINE_BYTES = 72 * 1024 * 1024;
  for (const document of loaded.filter(Boolean) as SyllabusCorpusDocument[]) {
    const key = `${document.sourceId}|${document.gcsUri || ""}|${document.storagePath || ""}`;
    if (seen.has(key)) continue;
    if (document.buffer && inlineBytes + document.buffer.length > MAX_INLINE_BYTES) continue;
    if (document.buffer) inlineBytes += document.buffer.length;
    seen.add(key);
    documents.push(document);
  }

  const db = getAdminDb();
  const indexedSourceIds = [...new Set(selected.map((source: any) => String(source.sourceId || source.id || "")).filter(Boolean))];
  const chunkGroups = await Promise.all(indexedSourceIds.map(async (sourceId) => {
    const snapshot = await db.collection("rag_chunks").where("sourceId", "==", sourceId).limit(80).get().catch(() => null);
    if (!snapshot) return [];
    return snapshot.docs.map((document: any) => ({ id: document.id, sourceId, ...document.data() }));
  }));
  const chunks = chunkGroups.flat().sort((left: any, right: any) => Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0));
  const syllabusEntries = chunks.map((chunk: any): [string, any] => {
    const lesson = String(chunk.lesson || chunk.lessonTitle || chunk.topic || "").trim();
    const subtopic = String(chunk.subtopic || chunk.point || chunk.heading || "").trim();
    const key = `${lesson.toLowerCase()}|${subtopic.toLowerCase()}`;
    return [key, {
      subject,
      lesson: lesson || "Indexed syllabus",
      topic: subtopic || lesson || "Indexed syllabus point",
      subtopic: subtopic || null,
      weight: Number(chunk.syllabusWeight || chunk.weight || 0.5),
      sourceId: chunk.sourceId,
    }];
  }).filter(([key]: [string, any]) => key !== "|");
  const syllabusNodes = [...new Map<string, any>(syllabusEntries).values()];
  const indexedText = chunks
    .map((chunk: any) => `[${chunk.sourceId}] ${String(chunk.text || chunk.content || "").trim()}`)
    .filter((text) => text.length > 3)
    .join("\n\n")
    .slice(0, 120_000);

  return {
    subject,
    documents,
    sources: selected.map((source: any) => ({
      sourceId: String(source.sourceId || source.id),
      title: source.title || source.fileName || "Syllabus PDF",
      visibility: source.visibility || null,
      published: source.published === true,
      textIndexed: source.textIndexed === true,
    })),
    syllabusNodes,
    indexedText,
    coverage: {
      discoveredDocuments: candidates.length + (primary ? 1 : 0),
      attachedDocuments: documents.length,
      indexedSources: indexedSourceIds.length,
      indexedChunks: chunks.length,
      skippedByDocumentLimit: Math.max(0, candidates.length - selected.length),
      inlineBytes,
      completeWithinTechnicalLimits: candidates.length <= selected.length && loaded.filter(Boolean).length === selected.length,
    },
  };
}

export function syllabusCorpusParts(corpus: Awaited<ReturnType<typeof loadSubjectSyllabusCorpus>>): any[] {
  return corpus.documents.flatMap<any>((document) => {
    const sourceLabel = { text: `OFFICIAL SYLLABUS SOURCE ${document.sourceId}: ${document.title}. Treat it as an allowed-scope authority, not as a prediction guarantee.` };
    if (document.gcsUri) return [{ fileData: { fileUri: document.gcsUri, mimeType: "application/pdf" } }, sourceLabel];
    if (document.buffer?.length) return [{ inlineData: { mimeType: "application/pdf", data: document.buffer.toString("base64") } }, sourceLabel];
    return [];
  });
}
