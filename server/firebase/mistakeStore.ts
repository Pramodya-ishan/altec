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
  masteryScore?: number;
  attemptCount?: number;
  correctStreak?: number;
  easinessFactor?: number;
  intervalDays?: number;
  nextReviewAt?: string;
  lastReviewQuality?: number;
  errorCategory?: "concept" | "calculation" | "reading" | "diagram" | "memory" | "unknown";
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
    masteryScore: Number.isFinite(Number(source.masteryScore)) ? Math.max(0, Math.min(100, Number(source.masteryScore))) : (source.mastered === true ? 100 : 0),
    attemptCount: Number.isFinite(Number(source.attemptCount)) ? Math.max(0, Number(source.attemptCount)) : Number(source.repeatCount || 0),
    correctStreak: Number.isFinite(Number(source.correctStreak)) ? Math.max(0, Number(source.correctStreak)) : 0,
    easinessFactor: Number.isFinite(Number(source.easinessFactor)) ? Math.max(1.3, Number(source.easinessFactor)) : 2.5,
    intervalDays: Number.isFinite(Number(source.intervalDays)) ? Math.max(0, Number(source.intervalDays)) : 0,
    nextReviewAt: typeof source.nextReviewAt === "string" ? source.nextReviewAt : (typeof source.retryDate === "string" ? source.retryDate : undefined),
    lastReviewQuality: Number.isFinite(Number(source.lastReviewQuality)) ? Math.max(0, Math.min(5, Number(source.lastReviewQuality))) : undefined,
    errorCategory: ["concept", "calculation", "reading", "diagram", "memory"].includes(String(source.errorCategory))
      ? source.errorCategory as MistakeRecord["errorCategory"]
      : "unknown",
  };
}

export function isMistakeDue(record: Partial<MistakeRecord>, now = Date.now()) {
  if (record.mastered === true && Number(record.masteryScore || 0) >= 95) return false;
  const due = valueToMillis(record.nextReviewAt || record.retryDate);
  return due === 0 || due <= now;
}

/** SM-2 inspired scheduling, bounded for exam revision rather than long-term language learning. */
export function buildMistakeReviewUpdate(record: Partial<MistakeRecord>, qualityValue: unknown, now = new Date()) {
  const quality = Math.max(0, Math.min(5, Math.round(Number(qualityValue) || 0)));
  const previousInterval = Math.max(0, Number(record.intervalDays || 0));
  const previousStreak = Math.max(0, Number(record.correctStreak || 0));
  const previousEase = Math.max(1.3, Number(record.easinessFactor || 2.5));
  const correct = quality >= 3;
  const correctStreak = correct ? previousStreak + 1 : 0;
  let intervalDays = 1;
  if (!correct) intervalDays = quality <= 1 ? 0.25 : 1;
  else if (correctStreak === 1) intervalDays = 1;
  else if (correctStreak === 2) intervalDays = 3;
  else intervalDays = Math.min(45, Math.max(4, Math.round(previousInterval * previousEase)));
  const easinessFactor = Math.max(1.3, Math.min(3, previousEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))));
  const oldMastery = Math.max(0, Math.min(100, Number(record.masteryScore || 0)));
  const masteryDelta = correct ? 8 + quality * 3 : -(12 + (2 - Math.min(2, quality)) * 6);
  const masteryScore = Math.max(0, Math.min(100, Math.round(oldMastery * 0.72 + Math.max(0, Math.min(100, oldMastery + masteryDelta)) * 0.28)));
  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    attemptCount: Math.max(0, Number(record.attemptCount || 0)) + 1,
    repeatCount: correct ? Number(record.repeatCount || 0) : Math.max(0, Number(record.repeatCount || 0)) + 1,
    correctStreak,
    easinessFactor: Number(easinessFactor.toFixed(2)),
    intervalDays,
    masteryScore,
    mastered: masteryScore >= 95 && correctStreak >= 3,
    lastReviewQuality: quality,
    lastAttemptAt: now.toISOString(),
    nextReviewAt,
    retryDate: nextReviewAt,
    updatedAt: now.toISOString(),
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
