export type NormalizedZHistoryEntry = {
  date?: string;
  overall: number;
  sft?: number;
  et?: number;
  ict?: number;
  source: string;
  official?: boolean;
  [key: string]: unknown;
};

function finiteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateMillis(value: unknown): number {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourcePriority(source: string): number {
  const normalized = source.toLowerCase();
  if (/actual_saved_paper_marks|saved[_ -]?paper|paper_marks/.test(normalized)) return 4;
  if (/official/.test(normalized)) return 5;
  if (/history_array|legacy/.test(normalized)) return 3;
  if (/predictor|syllabus-completion/.test(normalized)) return 1;
  return 2;
}

export function normalizeZHistoryEntry(entry: any, fallbackSource = "history_array"): NormalizedZHistoryEntry | null {
  const overall = finiteNumber(entry?.overall ?? entry?.zScore ?? entry?.overallZScore);
  if (overall === undefined) return null;
  const rawDate = entry?.date ?? entry?.createdAt ?? entry?.timestamp ?? entry?.updatedAt;
  const parsedDate = dateMillis(rawDate);
  return {
    ...entry,
    date: parsedDate > 0 ? new Date(parsedDate).toISOString() : undefined,
    overall,
    sft: finiteNumber(entry?.sft ?? entry?.sftZ ?? entry?.subjectZScores?.sft),
    et: finiteNumber(entry?.et ?? entry?.etZ ?? entry?.subjectZScores?.et),
    ict: finiteNumber(entry?.ict ?? entry?.ictZ ?? entry?.subjectZScores?.ict),
    source: String(entry?.source ?? entry?.calculationBasis ?? fallbackSource),
    official: entry?.official === true,
  };
}

function entryKey(entry: NormalizedZHistoryEntry): string {
  const explicitFingerprint = String(entry.fingerprint || "").trim();
  if (explicitFingerprint) return explicitFingerprint;
  const timestamp = String(entry.date || "unknown").slice(0, 16);
  const sourceGroup = sourcePriority(entry.source) >= 4 ? "actual" : sourcePriority(entry.source) <= 1 ? "predictor" : entry.source;
  return `${timestamp}:${sourceGroup}:${entry.overall}:${entry.sft ?? ""}:${entry.et ?? ""}:${entry.ict ?? ""}`;
}

export function mergeZScoreHistory(...collections: any[][]): NormalizedZHistoryEntry[] {
  const byKey = new Map<string, NormalizedZHistoryEntry>();
  for (const collection of collections) {
    for (const raw of Array.isArray(collection) ? collection : []) {
      const entry = normalizeZHistoryEntry(raw);
      if (!entry) continue;
      const key = entryKey(entry);
      const previous = byKey.get(key);
      if (!previous) {
        byKey.set(key, entry);
        continue;
      }
      const priorityDifference = sourcePriority(entry.source) - sourcePriority(previous.source);
      if (priorityDifference > 0 || (priorityDifference === 0 && dateMillis(entry.date) >= dateMillis(previous.date))) {
        byKey.set(key, entry);
      }
    }
  }
  return Array.from(byKey.values())
    .sort((left, right) => dateMillis(left.date) - dateMillis(right.date))
    .slice(-1000);
}

export function pickLatestZScoreEntry(history: NormalizedZHistoryEntry[]): NormalizedZHistoryEntry | null {
  if (!history.length) return null;
  const actual = history.filter((entry) => sourcePriority(entry.source) >= 4);
  const pool = actual.length > 0 ? actual : history;
  return [...pool].sort((left, right) => dateMillis(right.date) - dateMillis(left.date))[0] || null;
}
