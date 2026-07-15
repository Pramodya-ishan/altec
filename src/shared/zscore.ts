export type ZScoreSubject = "sft" | "et" | "ict";

type PaperMarkLike = {
  title?: string;
  total?: number | null;
  time?: number | string | null;
};

type SubjectPracticeResult = {
  mark: number | null;
  z: number | null;
  sampleCount: number;
  latestRecordedAt: string | null;
};

export type PracticeZSnapshot = {
  calculationBasis: "actual_saved_paper_marks";
  official: false;
  complete: boolean;
  overall: number | null;
  subjects: Record<ZScoreSubject, SubjectPracticeResult>;
  reliability: "insufficient" | "low" | "medium";
  message: string;
};

const CURVES: Record<ZScoreSubject, Array<{ x: number; y: number }>> = {
  sft: [
    { x: 95, y: 2.9 }, { x: 89, y: 2.71 }, { x: 80, y: 2.15 },
    { x: 75, y: 1.8 }, { x: 65, y: 1.25 }, { x: 55, y: 0.8 },
    { x: 35, y: 0.05 }, { x: 0, y: -2.3 },
  ],
  et: [
    { x: 95, y: 2.9 }, { x: 87, y: 2.68 }, { x: 80, y: 2.1 },
    { x: 75, y: 1.6 }, { x: 65, y: 1 }, { x: 55, y: 0.5 },
    { x: 35, y: -0.05 }, { x: 0, y: -2.3 },
  ],
  ict: [
    { x: 95, y: 2.9 }, { x: 89, y: 2.77 }, { x: 80, y: 2.2 },
    { x: 75, y: 1.8 }, { x: 65, y: 1.25 }, { x: 55, y: 0.85 },
    { x: 35, y: 0.25 }, { x: 0, y: -2.3 },
  ],
};

export function estimateSubjectZFromMark(subject: ZScoreSubject, mark: number): number {
  const finalMark = Math.min(95, Math.max(0, Number(mark)));
  const points = CURVES[subject];
  for (let index = 0; index < points.length - 1; index += 1) {
    const upper = points[index];
    const lower = points[index + 1];
    if (finalMark <= upper.x && finalMark >= lower.x) {
      const ratio = (finalMark - lower.x) / (upper.x - lower.x);
      const computed = lower.y + ratio * (upper.y - lower.y);
      return Number(Math.min(3, Math.max(-2.5, computed)).toFixed(4));
    }
  }
  return -2.3;
}

function timestamp(value: PaperMarkLike["time"]): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function summarizeSavedPaperMarks(marks: PaperMarkLike[] | undefined): {
  average: number | null;
  sampleCount: number;
  latestRecordedAt: string | null;
} {
  const valid = (Array.isArray(marks) ? marks : [])
    .filter((mark) => {
      const total = Number(mark?.total);
      const title = String(mark?.title || "").trim();
      return Number.isFinite(total) && total > 0 && total <= 100 && !/^untitled(?:\s+paper)?$/i.test(title);
    })
    .sort((left, right) => timestamp(left.time) - timestamp(right.time))
    .slice(-5);

  if (valid.length === 0) {
    return { average: null, sampleCount: 0, latestRecordedAt: null };
  }

  let weightedTotal = 0;
  let totalWeight = 0;
  valid.forEach((mark, index) => {
    const weight = index + 1;
    weightedTotal += Number(mark.total) * weight;
    totalWeight += weight;
  });

  const latestTime = timestamp(valid[valid.length - 1].time);
  return {
    average: Number((weightedTotal / totalWeight).toFixed(2)),
    sampleCount: valid.length,
    latestRecordedAt: latestTime > 0 ? new Date(latestTime).toISOString() : null,
  };
}

export function buildPracticeZSnapshot(appData: any): PracticeZSnapshot {
  const subjects = {} as Record<ZScoreSubject, SubjectPracticeResult>;
  for (const subject of ["sft", "et", "ict"] as const) {
    const summary = summarizeSavedPaperMarks(appData?.[subject]?.paperMarks);
    subjects[subject] = {
      mark: summary.average,
      z: summary.average === null ? null : estimateSubjectZFromMark(subject, summary.average),
      sampleCount: summary.sampleCount,
      latestRecordedAt: summary.latestRecordedAt,
    };
  }

  const subjectValues = [subjects.sft.z, subjects.et.z, subjects.ict.z];
  const complete = subjectValues.every((value) => value !== null);
  const overall = complete
    ? Number((subjectValues.reduce<number>((sum, value) => sum + Number(value), 0) / 3).toFixed(4))
    : null;
  const minimumSamples = Math.min(subjects.sft.sampleCount, subjects.et.sampleCount, subjects.ict.sampleCount);
  const reliability = !complete ? "insufficient" : minimumSamples >= 3 ? "medium" : "low";

  return {
    calculationBasis: "actual_saved_paper_marks",
    official: false,
    complete,
    overall,
    subjects,
    reliability,
    message: complete
      ? "Practice estimate from actual saved paper totals. Official exam cohort statistics are not available."
      : "Your Exam Score Predictor estimate will become more stable as you add marks and lesson progress.",
  };
}

export function calculateOfficialZ(mark: number, cohortMean: number, cohortStandardDeviation: number): number | null {
  if (![mark, cohortMean, cohortStandardDeviation].every(Number.isFinite) || cohortStandardDeviation <= 0) return null;
  return Number(((mark - cohortMean) / cohortStandardDeviation).toFixed(4));
}

export function appendPracticeZHistory<T extends Record<string, any>>(appData: T, reason: string): T {
  const nextData = structuredClone(appData);
  const snapshot = buildPracticeZSnapshot(nextData);
  const existing = Array.isArray((nextData as any).zScoreHistory)
    ? (nextData as any).zScoreHistory.filter((entry: any) => entry?.calculationBasis === "actual_saved_paper_marks")
    : [];

  if (!snapshot.complete || snapshot.overall === null) {
    (nextData as any).zScoreHistory = existing;
    return nextData;
  }

  const subjectZScores = {
    sft: Number(snapshot.subjects.sft.z),
    et: Number(snapshot.subjects.et.z),
    ict: Number(snapshot.subjects.ict.z),
  };
  const rawPaperAverages = {
    sft: Number(snapshot.subjects.sft.mark),
    et: Number(snapshot.subjects.et.mark),
    ict: Number(snapshot.subjects.ict.mark),
  };
  const sampleCounts = {
    sft: snapshot.subjects.sft.sampleCount,
    et: snapshot.subjects.et.sampleCount,
    ict: snapshot.subjects.ict.sampleCount,
  };
  const fingerprint = [
    rawPaperAverages.sft,
    rawPaperAverages.et,
    rawPaperAverages.ict,
    sampleCounts.sft,
    sampleCounts.et,
    sampleCounts.ict,
  ].join(":");
  const recordedAt = [
    snapshot.subjects.sft.latestRecordedAt,
    snapshot.subjects.et.latestRecordedAt,
    snapshot.subjects.ict.latestRecordedAt,
  ].filter(Boolean).sort().pop() || new Date().toISOString();
  const point = {
    date: recordedAt,
    zScore: snapshot.overall,
    subjectZScores,
    rawPaperAverages,
    sampleCounts,
    calculationBasis: "actual_saved_paper_marks" as const,
    official: false as const,
    fingerprint,
    reason,
  };
  const duplicateIndex = existing.findIndex((entry: any) => entry?.fingerprint === fingerprint);
  if (duplicateIndex >= 0) existing[duplicateIndex] = point;
  else existing.push(point);
  (nextData as any).zScoreHistory = existing.slice(-60);
  return nextData;
}
