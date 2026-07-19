import { getAdminDb } from "./admin";

export type MistakeRecord = {
  id: string;
  ownerPath?: "uid" | "legacy_email";
  subject?: string;
  lesson?: string;
  questionText?: string;
  errorText?: string;
  correctAnswer?: string;
  studentAnswer?: string;
  explanation?: string;
  imageStoragePath?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  repeatCount?: number;
  mastered?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastAttemptAt?: string;
  retryDate?: string;
  [key: string]: unknown;
};

function valueToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof (value as any)?.toDate === "function") {
    const date = (value as any).toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }
  if (typeof (value as any)?.seconds === "number") return Number((value as any).seconds) * 1000;
  return 0;
}

export function mistakeTimestamp(record: Partial<MistakeRecord>): number {
  return Math.max(
    valueToMillis(record.updatedAt),
    valueToMillis(record.lastAttemptAt),
    valueToMillis(record.createdAt),
    valueToMillis(record.retryDate),
  );
}

export function normalizeMistakeRecord(
  id: string,
  data: Record<string, unknown> | undefined,
  ownerPath?: MistakeRecord["ownerPath"],
): MistakeRecord {
  const source = data || {};
  const errorText = String(source.errorText || source.reason || source.errorReason || source.questionText || "").trim();
  const questionText = String(source.questionText || source.question || source.prompt || errorText).trim();
  return {
    ...source,
    id,
    ownerPath,
    subject: String(source.subject || "").trim().toUpperCase() || undefined,
    lesson: String(source.lesson || source.topic || source.concept || "").trim() || undefined,
    questionText: questionText || undefined,
    errorText: errorText || undefined,
    correctAnswer: String(source.correctAnswer || source.answer || "").trim() || undefined,
    studentAnswer: String(source.studentAnswer || source.userAnswer || "").trim() || undefined,
    explanation: String(source.explanation || source.feedback || "").trim() || undefined,
    repeatCount: Number.isFinite(Number(source.repeatCount)) ? Number(source.repeatCount) : 0,
    mastered: source.mastered === true,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : undefined,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined,
    lastAttemptAt: typeof source.lastAttemptAt === "string" ? source.lastAttemptAt : undefined,
    retryDate: typeof source.retryDate === "string" ? source.retryDate : undefined,
  };
}

function mistakeIdentity(record: MistakeRecord): string {
  const semantic = [
    record.subject,
    record.lesson,
    record.questionText,
    record.errorText,
    record.imageStoragePath,
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
  return semantic.replace(/\s+/g, " ") || `${record.ownerPath || "uid"}:${record.id}`;
}

export function mergeMistakeRecords(records: MistakeRecord[], limit = 100): MistakeRecord[] {
  const byIdentity = new Map<string, MistakeRecord>();
  for (const record of records) {
    const key = mistakeIdentity(record);
    const previous = byIdentity.get(key);
    if (!previous || mistakeTimestamp(record) >= mistakeTimestamp(previous)) {
      byIdentity.set(key, record);
    }
  }
  return Array.from(byIdentity.values())
    .sort((left, right) => mistakeTimestamp(right) - mistakeTimestamp(left))
    .slice(0, Math.max(1, limit));
}

export function isMistakeReviewIntent(prompt: string): boolean {
  const normalized = String(prompt || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  return [
    /\bmistakes?\b/i,
    /\bwrong answers?\b/i,
    /\berror\s*logs?\b/i,
    /\berr+o+r+\s*logs?\b/i,
    /\bmistake\s*notebook\b/i,
    /\bquiz me on my recent/i,
    /වැරදි|වරද|වැරදුණු|වැරදුන|වෙරදි|අඩුපාඩු/u,
    /w[aeyi]r(?:a|e)d(?:i|ina|una)|wrdina|waradina|weradina|errorlog|erorrlog/i,
  ].some((pattern) => pattern.test(normalized) || pattern.test(compact));
}

async function readPath(ref: any, ownerPath: MistakeRecord["ownerPath"], limit: number): Promise<MistakeRecord[]> {
  // Intentionally avoid orderBy. Older manually-created records only have createdAt,
  // while quiz-created records may only have updatedAt/lastAttemptAt. Ordering on one
  // field silently excludes the other records in Firestore.
  const snapshot = await ref.collection("mistake_notebook").limit(Math.max(limit * 2, 100)).get();
  return snapshot.docs.map((document: any) => normalizeMistakeRecord(document.id, document.data(), ownerPath));
}

export async function loadMistakeRecords(uid: string, email?: string, limit = 100): Promise<MistakeRecord[]> {
  const db = getAdminDb();
  const uidRef = db.collection("users").doc(uid);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [uidRecords, legacyRecords] = await Promise.all([
    readPath(uidRef, "uid", limit).catch(() => []),
    normalizedEmail && normalizedEmail !== uid
      ? readPath(db.collection("users").doc(normalizedEmail), "legacy_email", limit).catch(() => [])
      : Promise.resolve([]),
  ]);
  return mergeMistakeRecords([...uidRecords, ...legacyRecords], limit);
}
