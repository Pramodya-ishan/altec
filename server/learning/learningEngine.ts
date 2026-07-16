export type LearningMistakeType =
  | "concept_misconception"
  | "formula_misuse"
  | "unit_conversion"
  | "calculation_step"
  | "significant_figures"
  | "answer_structure"
  | "guessing"
  | "careless_selection"
  | "unknown";

export interface LearningAttemptInput {
  subject: string;
  lesson: string;
  questionId?: string | null;
  questionType?: "MCQ" | "Structured" | "Essay" | "Calculation" | "Diagram" | string;
  correct: boolean;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
  responseTimeMs?: number | null;
  confidence?: number | null;
  working?: string | null;
  expectedUnit?: string | null;
  submittedUnit?: string | null;
  expectedSignificantFigures?: number | null;
  submittedSignificantFigures?: number | null;
  previousErrorCount?: number | null;
  difficulty?: number | null;
  now?: Date;
}

export interface LearningAttemptAnalysis {
  mistakeTypes: LearningMistakeType[];
  guessed: boolean;
  masteryDelta: number;
  difficultyAdjustment: -1 | 0 | 1;
  nextReviewAt: string;
  intervalDays: number;
  easeFactor: number;
  recommendations: string[];
}

export interface RevisionItem {
  id: string;
  subject: string;
  lesson: string;
  weaknessScore: number;
  errorCount?: number;
  lastAttemptAt?: string | null;
  nextReviewAt?: string | null;
  estimatedMinutes?: number;
}

export interface RevisionPlanDay {
  day: number;
  date: string;
  totalMinutes: number;
  tasks: Array<{
    id: string;
    subject: string;
    lesson: string;
    minutes: number;
    activity: "review" | "practice" | "recall" | "mock";
    reason: string;
  }>;
}

export interface GradeAnswerInput {
  studentAnswer: string;
  modelAnswer?: string | null;
  markingPoints: Array<string | { text: string; marks?: number; alternatives?: string[] }>;
  maxMarks: number;
  expectedUnit?: string | null;
  submittedUnit?: string | null;
  expectedSignificantFigures?: number | null;
  submittedSignificantFigures?: number | null;
}

export interface GradeAnswerResult {
  awardedMarks: number;
  maxMarks: number;
  percentage: number;
  matchedPoints: string[];
  missingPoints: string[];
  alternativeMatches: string[];
  issues: Array<{ type: LearningMistakeType; message: string }>;
  feedback: string[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeComparableText(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/ප්ර/g, "ප්‍ර")
    .replace(/ක්ර/g, "ක්‍ර")
    .replace(/ත්ර/g, "ත්‍ර")
    .replace(/ද්ර/g, "ද්‍ර")
    .replace(/ශ්ර/g, "ශ්‍ර")
    .replace(/[^\p{L}\p{M}\p{N}.+\-*/=]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: unknown): Set<string> {
  return new Set(normalizeComparableText(value).split(" ").filter((token) => token.length > 1));
}

function textSimilarity(a: unknown, b: unknown): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  // Marking-point evaluation is directional: a longer student answer should
  // still match when it contains most of the shorter marking point.
  return intersection / Math.max(1, Math.min(left.size, right.size));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function analyseLearningAttempt(input: LearningAttemptInput): LearningAttemptAnalysis {
  const confidence = clamp(Number(input.confidence ?? 0.5), 0, 1);
  const responseTimeMs = Math.max(0, Number(input.responseTimeMs || 0));
  const previousErrorCount = Math.max(0, Number(input.previousErrorCount || 0));
  const difficulty = clamp(Number(input.difficulty ?? 0.5), 0, 1);
  const working = normalizeComparableText(input.working);
  const mistakeTypes: LearningMistakeType[] = [];
  const recommendations: string[] = [];

  const guessed = Boolean(
    (!input.correct && confidence >= 0.75) ||
    (input.correct && confidence <= 0.25) ||
    (responseTimeMs > 0 && responseTimeMs < 2_500 && String(input.questionType).toUpperCase() === "MCQ"),
  );

  if (!input.correct) {
    if (guessed) mistakeTypes.push("guessing");
    if (input.expectedUnit && normalizeComparableText(input.expectedUnit) !== normalizeComparableText(input.submittedUnit)) {
      mistakeTypes.push("unit_conversion");
      recommendations.push("ඒකකය වෙනම පරීක්ෂා කර අවසන් පිළිතුරට නිවැරදි SI ඒකකය ලියන්න.");
    }
    if (
      input.expectedSignificantFigures != null &&
      input.submittedSignificantFigures != null &&
      input.expectedSignificantFigures !== input.submittedSignificantFigures
    ) {
      mistakeTypes.push("significant_figures");
      recommendations.push("අවසාන අගය ප්‍රශ්නයේ ඉල්ලා ඇති significant figures ගණනට වට කරන්න.");
    }
    if (/\b(?:f|ma|v|u|s|t|p|e|q)\s*=/.test(working) && /(?:wrong formula|formula error|සූත්‍ර)/.test(working)) {
      mistakeTypes.push("formula_misuse");
    } else if (String(input.questionType).toLowerCase().includes("calculation") || /[=+\-*/]/.test(working)) {
      mistakeTypes.push("calculation_step");
    } else if (String(input.questionType).toLowerCase().includes("essay") || String(input.questionType).toLowerCase().includes("structured")) {
      mistakeTypes.push("answer_structure");
    } else if (!guessed) {
      mistakeTypes.push("concept_misconception");
    }
  } else if (guessed) {
    mistakeTypes.push("guessing");
    recommendations.push("පිළිතුර නිවැරදි වුවත් විශ්වාසය අඩුයි. එකම concept එකේ තවත් ප්‍රශ්නයක් කරන්න.");
  }

  if (mistakeTypes.length === 0 && !input.correct) mistakeTypes.push("unknown");

  const quality = input.correct
    ? confidence >= 0.7 ? 5 : confidence >= 0.4 ? 4 : 3
    : confidence <= 0.35 ? 2 : 1;
  const oldEase = clamp(2.5 - previousErrorCount * 0.12, 1.3, 2.5);
  const easeFactor = clamp(oldEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)), 1.3, 2.7);
  const baseIntervals = input.correct ? [1, 3, 7, 14, 30, 60] : [1, 1, 2, 4, 7, 14];
  const intervalIndex = clamp(previousErrorCount, 0, baseIntervals.length - 1);
  const intervalDays = Math.max(1, Math.round(baseIntervals[intervalIndex] * (input.correct ? easeFactor / 2.2 : 1)));
  const now = input.now || new Date();

  if (!input.correct && recommendations.length === 0) {
    recommendations.push("වැරදුණු concept එක මිනිත්තු 10ක් recall කර සමාන MCQ දෙකක් නැවත කරන්න.");
  }
  if (input.correct && !guessed) recommendations.push("මට්ටම රඳවා ගැනීමට ඊළඟ review එකේ වඩා අමාරු ප්‍රශ්නයක් කරන්න.");

  return {
    mistakeTypes: [...new Set(mistakeTypes)],
    guessed,
    masteryDelta: input.correct ? (guessed ? 2 : Math.round(6 + difficulty * 4)) : -Math.round(5 + confidence * 5),
    difficultyAdjustment: input.correct && confidence >= 0.7 ? 1 : !input.correct ? -1 : 0,
    nextReviewAt: addDays(now, intervalDays).toISOString(),
    intervalDays,
    easeFactor: Number(easeFactor.toFixed(2)),
    recommendations,
  };
}

export function calculateMasteryScore(attempts: LearningAttemptInput[]): number {
  if (attempts.length === 0) return 0;
  const recent = attempts.slice(-20);
  let weightedTotal = 0;
  let weightSum = 0;
  recent.forEach((attempt, index) => {
    const recencyWeight = 1 + index / Math.max(recent.length - 1, 1);
    const confidence = clamp(Number(attempt.confidence ?? 0.5), 0, 1);
    const correctness = attempt.correct ? 1 : 0;
    weightedTotal += (correctness * 0.8 + confidence * 0.2) * recencyWeight;
    weightSum += recencyWeight;
  });
  return Math.round(clamp(weightedTotal / Math.max(weightSum, 1), 0, 1) * 100);
}

export function buildRevisionPlan(
  items: RevisionItem[],
  options: { days?: number; dailyMinutes?: number; startDate?: Date; examDate?: Date | null } = {},
): RevisionPlanDay[] {
  const days = clamp(Math.round(options.days || 7), 1, 60);
  const dailyMinutes = clamp(Math.round(options.dailyMinutes || 120), 20, 900);
  const startDate = options.startDate || new Date();
  const examDate = options.examDate || null;

  const ranked = [...items]
    .map((item) => ({
      ...item,
      weaknessScore: clamp(Number(item.weaknessScore || 0), 0, 100),
      estimatedMinutes: clamp(Math.round(item.estimatedMinutes || 25), 10, 90),
    }))
    .sort((a, b) => {
      const aDue = a.nextReviewAt && new Date(a.nextReviewAt).getTime() <= startDate.getTime() ? 20 : 0;
      const bDue = b.nextReviewAt && new Date(b.nextReviewAt).getTime() <= startDate.getTime() ? 20 : 0;
      return (b.weaknessScore + bDue + Number(b.errorCount || 0) * 3) - (a.weaknessScore + aDue + Number(a.errorCount || 0) * 3);
    });

  if (ranked.length === 0) return [];

  const result: RevisionPlanDay[] = [];
  let cursor = 0;
  for (let day = 0; day < days; day += 1) {
    const date = addDays(startDate, day);
    const tasks: RevisionPlanDay["tasks"] = [];
    let used = 0;
    let guard = 0;
    while (used < dailyMinutes && guard < ranked.length * 3) {
      const item = ranked[cursor % ranked.length];
      cursor += 1;
      guard += 1;
      const remaining = dailyMinutes - used;
      if (remaining < 10) break;
      const minutes = Math.min(item.estimatedMinutes || 25, remaining);
      const isExamNear = examDate ? (examDate.getTime() - date.getTime()) / 86_400_000 <= 3 : false;
      const activity: RevisionPlanDay["tasks"][number]["activity"] =
        isExamNear ? "mock" : item.weaknessScore >= 75 ? "practice" : day % 3 === 2 ? "recall" : "review";
      tasks.push({
        id: item.id,
        subject: item.subject,
        lesson: item.lesson,
        minutes,
        activity,
        reason: item.weaknessScore >= 70
          ? `Weakness ${item.weaknessScore}% සහ වැරදි ${item.errorCount || 0}`
          : "Scheduled spaced-repetition review",
      });
      used += minutes;
    }
    result.push({ day: day + 1, date: date.toISOString().slice(0, 10), totalMinutes: used, tasks });
  }
  return result;
}

export function gradeAnswer(input: GradeAnswerInput): GradeAnswerResult {
  const student = normalizeComparableText(input.studentAnswer);
  const model = normalizeComparableText(input.modelAnswer);
  const points = input.markingPoints.map((point) => typeof point === "string"
    ? { text: point, marks: undefined as number | undefined, alternatives: [] as string[] }
    : { text: point.text, marks: point.marks, alternatives: point.alternatives || [] });
  const defaultPointMarks = points.length > 0 ? input.maxMarks / points.length : 0;
  const matchedPoints: string[] = [];
  const missingPoints: string[] = [];
  const alternativeMatches: string[] = [];
  let awarded = 0;

  for (const point of points) {
    const mainSimilarity = textSimilarity(student, point.text);
    const matchedAlternative = point.alternatives.find((alternative) => textSimilarity(student, alternative) >= 0.55);
    const matched = mainSimilarity >= 0.5 || Boolean(matchedAlternative);
    if (matched) {
      matchedPoints.push(point.text);
      if (matchedAlternative) alternativeMatches.push(matchedAlternative);
      awarded += point.marks ?? defaultPointMarks;
    } else {
      missingPoints.push(point.text);
    }
  }

  // A strong model-answer match can recover a small amount of partial credit,
  // but never bypass explicit marking points.
  if (points.length > 0 && awarded === 0 && model && textSimilarity(student, model) >= 0.45) {
    awarded = Math.min(input.maxMarks * 0.25, defaultPointMarks);
  }

  const issues: GradeAnswerResult["issues"] = [];
  if (input.expectedUnit && normalizeComparableText(input.expectedUnit) !== normalizeComparableText(input.submittedUnit)) {
    issues.push({ type: "unit_conversion", message: `Expected unit: ${input.expectedUnit}` });
    awarded = Math.max(0, awarded - Math.min(1, input.maxMarks * 0.1));
  }
  if (
    input.expectedSignificantFigures != null && input.submittedSignificantFigures != null &&
    input.expectedSignificantFigures !== input.submittedSignificantFigures
  ) {
    issues.push({ type: "significant_figures", message: `Use ${input.expectedSignificantFigures} significant figures.` });
    awarded = Math.max(0, awarded - Math.min(1, input.maxMarks * 0.1));
  }
  if (student.length < 20 && input.maxMarks >= 5) {
    issues.push({ type: "answer_structure", message: "Answer is too short for the allocated marks." });
  }

  const awardedMarks = Number(clamp(awarded, 0, input.maxMarks).toFixed(2));
  const feedback: string[] = [];
  if (matchedPoints.length) feedback.push(`Matched ${matchedPoints.length}/${points.length} marking points.`);
  if (missingPoints.length) feedback.push("Missing marking points are shown for targeted correction.");
  if (!issues.length && awardedMarks === input.maxMarks) feedback.push("All supplied marking points are present.");

  return {
    awardedMarks,
    maxMarks: input.maxMarks,
    percentage: input.maxMarks > 0 ? Math.round((awardedMarks / input.maxMarks) * 100) : 0,
    matchedPoints,
    missingPoints,
    alternativeMatches,
    issues,
    feedback,
  };
}
