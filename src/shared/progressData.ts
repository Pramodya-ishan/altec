import type { AppData, LessonResource, SubjectData } from "../types";

export const PROGRESS_SCHEMA_VERSION = 2;
export const PROGRESS_SUBJECTS = ["sft", "et", "ict"] as const;
export type ProgressSubject = (typeof PROGRESS_SUBJECTS)[number];

const emptySubject = (): SubjectData => ({ topics: {}, paperMarks: [], questionMarks: {} });

export type ProgressSections = {
  sft: SubjectData;
  et: SubjectData;
  ict: SubjectData;
  meta: Omit<AppData, "sft" | "et" | "ict">;
};

const RESOURCE_KEYS = new Set([
  "id", "sourceId", "videoId", "url", "title", "type", "mimeType", "mediaKind",
  "resourceRole", "storagePath", "status", "thumbnailPath", "durationMs", "sizeBytes",
  "createdAt", "lessonId", "lessonTitle", "visibility", "published", "displayPriority",
]);

function normalizeResource(value: unknown): LessonResource | null {
  if (!value || typeof value !== "object") return null;
  const result: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (!RESOURCE_KEYS.has(key)) continue;
    if (typeof fieldValue === "string" && fieldValue.length > 20_000) continue;
    if (["string", "number", "boolean"].includes(typeof fieldValue) || fieldValue === null) {
      result[key] = fieldValue;
    }
  }
  return typeof result.url === "string" || typeof result.storagePath === "string" ? result as LessonResource : null;
}

function normalizeSubject(value: unknown): SubjectData {
  const source = value && typeof value === "object" ? value as Partial<SubjectData> : {};
  const rawTopics = source.topics && typeof source.topics === "object" ? source.topics : {};
  const topics = Object.fromEntries(Object.entries(rawTopics).map(([name, rawTopic]) => {
    const topic = rawTopic && typeof rawTopic === "object" ? rawTopic as Record<string, unknown> : {};
    const videos = Array.isArray(topic.videos) ? topic.videos.map(normalizeResource).filter((resource): resource is LessonResource => resource !== null) : [];
    const resources = Array.isArray(topic.resources) ? topic.resources.map(normalizeResource).filter((resource): resource is LessonResource => resource !== null) : undefined;
    const notes = typeof topic.notes === "string" ? topic.notes.slice(0, 100_000) : undefined;
    return [name, {
      checked: topic.checked === true,
      videos,
      ...(resources ? { resources } : {}),
      ...(notes !== undefined ? { notes } : {}),
    }];
  }));
  const questionMarks = source.questionMarks && typeof source.questionMarks === "object"
    ? Object.fromEntries(Object.entries(source.questionMarks).map(([key, entries]) => [
        key,
        Array.isArray(entries) ? entries.slice(-1000) : [],
      ]))
    : {};
  return {
    ...emptySubject(),
    topics,
    paperMarks: Array.isArray(source.paperMarks) ? source.paperMarks.slice(-1000) : [],
    questionMarks,
    lessonHistory: Array.isArray(source.lessonHistory) ? source.lessonHistory.slice(-5000) : [],
  };
}

export function normalizeZScoreHistory(value: unknown): NonNullable<AppData["zScoreHistory"]> {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<string, NonNullable<AppData["zScoreHistory"]>[number]>();

  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const zScore = Number((entry as any).zScore ?? (entry as any).overall);
    if (!Number.isFinite(zScore)) return;

    const parsedDate = new Date(String((entry as any).date || (entry as any).createdAt || ""));
    const date = Number.isFinite(parsedDate.getTime())
      ? parsedDate.toISOString()
      : new Date(Date.now() - Math.max(0, value.length - index - 1) * 86_400_000).toISOString();

    const normalized = {
      ...(entry as any),
      date,
      zScore: Number(zScore.toFixed(4)),
      official: false as const,
      calculationBasis: (entry as any).calculationBasis || "legacy_exam_score_predictor",
    } as NonNullable<AppData["zScoreHistory"]>[number];

    const key = String((entry as any).fingerprint || `${normalized.calculationBasis}:${date}:${normalized.zScore}`);
    deduped.set(key, normalized);
  });

  return Array.from(deduped.values())
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
    .slice(-1000);
}

export function normalizeProgressData(value: unknown): AppData {
  const source = value && typeof value === "object" ? value as Partial<AppData> : {};
  return {
    ...source,
    sft: normalizeSubject(source.sft),
    et: normalizeSubject(source.et),
    ict: normalizeSubject(source.ict),
    zScoreHistory: normalizeZScoreHistory(source.zScoreHistory),
  } as AppData;
}

export function splitProgressData(value: unknown): ProgressSections {
  const normalized = normalizeProgressData(value);
  const { sft, et, ict, ...meta } = normalized;
  return { sft, et, ict, meta };
}

export function combineProgressSections(value: Partial<ProgressSections> | null | undefined): AppData {
  const meta = value?.meta && typeof value.meta === "object" ? value.meta : {};
  return normalizeProgressData({
    ...meta,
    sft: value?.sft,
    et: value?.et,
    ict: value?.ict,
  });
}

export function hasMeaningfulProgress(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const normalized = normalizeProgressData(value);
  return PROGRESS_SUBJECTS.some((subject) => {
    const section = normalized[subject];
    return Object.keys(section.topics || {}).length > 0
      || section.paperMarks.length > 0
      || Object.keys(section.questionMarks || {}).length > 0;
  }) || Boolean(normalized.targetZ)
    || Boolean(normalized.studyPlan)
    || Boolean(normalized.zScoreHistory?.length);
}
