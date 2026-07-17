import { getAdminDb } from "../firebase/admin";

export function normalizeLessonId(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export type LessonResourceRecord = {
  id: string;
  sourceId: string;
  subject: string;
  lessonId: string;
  lessonTitle: string;
  resourceType: string;
  mediaKind: string;
  title: string;
  fileName: string;
  storagePath?: string | null;
  videoId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  visibility: "private" | "class" | "public" | "official";
  published: boolean;
  processingStatus: string;
  needsOcr: boolean;
  textIndexed: boolean;
  createdBy: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
};

export async function upsertLessonResource(input: Partial<LessonResourceRecord> & {
  id: string;
  sourceId: string;
  subject: string;
  lessonTitle: string;
  title: string;
  createdBy: string;
}) {
  const now = new Date().toISOString();
  const record: LessonResourceRecord = {
    id: input.id,
    sourceId: input.sourceId,
    subject: String(input.subject || "").toUpperCase(),
    lessonId: input.lessonId || normalizeLessonId(input.lessonTitle),
    lessonTitle: String(input.lessonTitle || "General"),
    resourceType: input.resourceType || "paper_structure",
    mediaKind: input.mediaKind || "pdf",
    title: String(input.title || input.fileName || "Lesson resource"),
    fileName: String(input.fileName || input.title || "resource"),
    storagePath: input.storagePath || null,
    videoId: input.videoId || null,
    mimeType: input.mimeType || null,
    sizeBytes: Number(input.sizeBytes || 0) || null,
    visibility: input.visibility || "class",
    published: input.published !== false,
    processingStatus: input.processingStatus || "queued",
    needsOcr: input.needsOcr === true,
    textIndexed: input.textIndexed === true,
    createdBy: input.createdBy,
    ownerUid: input.ownerUid || input.createdBy,
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
  await getAdminDb().collection("lesson_resources").doc(record.id).set(record, { merge: true });
  return record;
}

export async function updateLessonResourceProcessing(sourceId: string, update: Record<string, unknown>) {
  const db = getAdminDb();
  const direct = await db.collection("lesson_resources").doc(sourceId).get();
  if (direct.exists) {
    await direct.ref.set({ ...update, updatedAt: new Date().toISOString() }, { merge: true });
    return;
  }
  const matches = await db.collection("lesson_resources").where("sourceId", "==", sourceId).limit(10).get();
  await Promise.all(matches.docs.map((document: any) => document.ref.set({ ...update, updatedAt: new Date().toISOString() }, { merge: true })));
}
