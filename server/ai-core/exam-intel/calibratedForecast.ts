import { defaultPredictionSettings, mergePredictionSettings, sourceReliability, type PredictionSettings } from "./predictionPolicy";

export interface ForecastQuestionEvidence {
  year: number;
  question: string;
  reason: string;
  sourceId?: string;
  sourceTitle?: string;
  questionNo?: string;
  marks?: number;
  questionType?: string;
  pageNumber?: number;
  crop?: { x: number; y: number; width: number; height: number } | null;
}

export interface CalibratedTopicForecast {
  topic: string;
  subject: string;
  lesson: string;
  subtopics: string[];
  probability: "Very High" | "High" | "Medium" | "Low";
  probabilityPercent: number;
  confidence: number;
  confidenceInterval: [number, number];
  evidence: ForecastQuestionEvidence[];
  why: string[];
  lastSeenYear: number | null;
  repeatGapYears: number | null;
  formatLikelihood: Array<{ type: string; percent: number }>;
  sourceBreakdown: Record<string, number>;
  studentPriority: "Must study today" | "This week" | "Later";
  riskIfSkipped: "High" | "Medium" | "Low";
  sampleSize: number;
  distinctEvidenceYears: number;
  evidenceSufficient: boolean;
  disclaimer: string;
}

function normalize(value: unknown) {
  return String(value || "Unknown").normalize("NFKC").replace(/\s+/g, " ").trim() || "Unknown";
}

function yearOf(question: any) {
  const year = Number(question?.year);
  return Number.isInteger(year) && year >= 1990 && year <= 2100 ? year : null;
}

function scoreLabel(score: number): CalibratedTopicForecast["probability"] {
  if (score >= 76) return "Very High";
  if (score >= 61) return "High";
  if (score >= 41) return "Medium";
  return "Low";
}

function questionSourceReliability(question: any) {
  const explicit = Number(question?.sourceReliability);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  return sourceReliability({
    resourceType: question?.resourceType,
    sourceType: question?.sourceType,
    sourceScope: question?.sourceScope,
    title: question?.sourceTitle,
    verified: question?.verified,
  });
}

function visualQuestion(question: any) {
  const text = `${question?.questionType || ""} ${question?.questionText || ""} ${question?.concept || ""}`;
  return question?.requiresImage === true || question?.hasDiagram === true || /diagram|figure|graph|circuit|drawing|flowchart|network|රූප|ප්‍රස්තාර|පරිපථ/i.test(text);
}

function sourceBucket(question: any) {
  const text = `${question?.resourceType || ""} ${question?.sourceType || ""} ${question?.sourceTitle || ""}`.toLowerCase();
  if (/marking/.test(text)) return "marking_scheme";
  if (/past.?paper|official/.test(text)) return "official_past_paper";
  if (/model/.test(text)) return "model_paper";
  if (/guess|prediction/.test(text)) return "guessing_paper";
  return "other_verified";
}

/** Evidence-calibrated ranking. A score is revision priority, never certainty. */
export function calculateCalibratedForecast(params: {
  subject: string;
  questions: any[];
  syllabusNodes?: any[];
  targetYear?: number;
  settings?: Partial<PredictionSettings> | any;
}): CalibratedTopicForecast[] {
  const targetYear = Number(params.targetYear || params.settings?.targetYear || 2026);
  const settings = mergePredictionSettings(params.subject, defaultPredictionSettings(params.subject, targetYear), params.settings || {});
  const syllabus = new Map((params.syllabusNodes || []).map((node: any) => [normalize(node?.lesson || node?.topic || node?.name).toLowerCase(), node]));
  const grouped = new Map<string, any[]>();
  for (const question of params.questions || []) {
    const year = yearOf(question);
    if (year && year >= targetYear) continue;
    const lesson = normalize(question?.lesson || question?.topic || question?.concept);
    const key = lesson.toLowerCase();
    grouped.set(key, [...(grouped.get(key) || []), question]);
  }
  for (const [key] of syllabus) if (!grouped.has(key)) grouped.set(key, []);

  const allYears = (params.questions || []).map(yearOf).filter((year): year is number => year != null && year < targetYear);
  const corpusYears = new Set(allYears).size;
  const maxYear = allYears.length > 0 ? Math.max(...allYears) : targetYear - 1;

  return Array.from(grouped.entries()).map(([key, questions]): CalibratedTopicForecast => {
    const node: any = syllabus.get(key) || {};
    const lesson = normalize(node.lesson || questions[0]?.lesson || questions[0]?.topic || key);
    const years = questions.map(yearOf).filter((year): year is number => year != null);
    const distinctYears = new Set(years);
    const latestYear = years.length > 0 ? Math.max(...years) : null;
    const syllabusWeight = Math.max(0, Math.min(1, Number(node.weight ?? node.syllabusWeight ?? node.markWeight ?? 0.5)));
    const weightedFrequency = questions.reduce((sum, question) => sum + questionSourceReliability(question), 0);
    const frequency = corpusYears > 0 ? Math.min(1, weightedFrequency / corpusYears) : 0;
    const gap = latestYear == null ? Math.min(6, Math.max(0, targetYear - maxYear)) : Math.max(0, targetYear - latestYear);
    const rotation = Math.min(1, gap / 4);
    const recentCount = questions.filter((question) => Number(question?.year || 0) >= targetYear - 4).reduce((sum, question) => sum + questionSourceReliability(question), 0);
    const olderCount = Math.max(0, weightedFrequency - recentCount);
    const recentTrend = Math.min(1, Math.max(0, recentCount / 4 + (recentCount > olderCount ? 0.2 : 0)));
    const marksScore = Math.min(1, questions.reduce((sum, question) => sum + Math.max(0, Number(question?.marks || 0)), 0) / Math.max(10, questions.length * 8));
    const sourceQuality = questions.length ? questions.reduce((sum, question) => sum + questionSourceReliability(question), 0) / questions.length : 0;
    const visualPattern = questions.length ? questions.filter(visualQuestion).length / questions.length : 0;
    const weights = settings.weights;
    const raw = 100 * (
      weights.frequency * frequency
      + weights.syllabus * syllabusWeight
      + weights.rotation * rotation
      + weights.recentTrend * recentTrend
      + weights.marks * marksScore
      + weights.sourceQuality * sourceQuality
      + weights.visualPattern * visualPattern
    );
    const probabilityPercent = Math.round(Math.max(5, Math.min(94, raw)));
    const evidenceStrength = Math.min(1, distinctYears.size / Math.max(1, settings.minimumEvidenceYears)) * 0.5
      + sourceQuality * 0.3
      + Math.min(1, corpusYears / 8) * 0.2;
    const confidence = Math.round(Math.max(12, Math.min(96, evidenceStrength * 100)));
    const margin = Math.max(4, Math.round(25 - confidence * 0.18));

    const formatCounts = new Map<string, number>();
    questions.forEach((question) => {
      const type = normalize(question?.questionType || question?.paperType || "Unclassified");
      formatCounts.set(type, (formatCounts.get(type) || 0) + questionSourceReliability(question));
    });
    const formatTotal = [...formatCounts.values()].reduce((sum, value) => sum + value, 0) || 1;
    const formatLikelihood = [...formatCounts.entries()]
      .map(([type, count]) => ({ type, percent: Math.round(count / formatTotal * 100) }))
      .sort((left, right) => right.percent - left.percent)
      .slice(0, 5);

    const sourceBreakdown: Record<string, number> = {};
    questions.forEach((question) => { const bucket = sourceBucket(question); sourceBreakdown[bucket] = (sourceBreakdown[bucket] || 0) + 1; });
    const subtopics = [...new Set(questions.map((question) => normalize(question?.subtopic || question?.concept || "")).filter((value) => value && value !== "Unknown"))].slice(0, 8);
    const evidence = [...questions]
      .sort((left, right) => questionSourceReliability(right) - questionSourceReliability(left) || Number(right?.year || 0) - Number(left?.year || 0))
      .slice(0, 8)
      .map((question) => ({
        year: yearOf(question) || 0,
        question: normalize(question?.questionText || question?.question || question?.questionNo || "Indexed question"),
        reason: `Weighted ${sourceBucket(question).replace(/_/g, " ")} evidence (${Math.round(questionSourceReliability(question) * 100)}% source reliability).`,
        sourceId: question?.sourceId ? String(question.sourceId) : undefined,
        sourceTitle: question?.sourceTitle ? String(question.sourceTitle) : undefined,
        questionNo: question?.questionNo ? String(question.questionNo) : undefined,
        marks: Number(question?.marks || 0) || undefined,
        questionType: question?.questionType || question?.paperType || undefined,
        pageNumber: Number(question?.pageNumber || 0) || undefined,
        crop: question?.crop || question?.boundingBox || question?.bbox || null,
      }));

    const why = [
      `Official-weighted frequency score ${Math.round(frequency * 100)}%.`,
      `Syllabus importance score ${Math.round(syllabusWeight * 100)}%.`,
      latestYear ? `Last indexed appearance: ${latestYear}; rotation gap ${gap} year(s).` : "No verified indexed appearance; treated as an uncovered syllabus area.",
      `Evidence quality ${Math.round(sourceQuality * 100)}% across ${distinctYears.size} distinct year(s).`,
      visualPattern > 0.25 ? `${Math.round(visualPattern * 100)}% of indexed items use a diagram, graph, or other visual.` : "Predominantly text-based indexed pattern.",
    ];
    const evidenceSufficient = distinctYears.size >= settings.minimumEvidenceYears && sourceQuality >= 0.65;
    return {
      topic: normalize(node.topic || questions[0]?.topic || lesson),
      subject: settings.subject,
      lesson,
      subtopics,
      probability: scoreLabel(probabilityPercent),
      probabilityPercent,
      confidence,
      confidenceInterval: [Math.max(0, probabilityPercent - margin), Math.min(100, probabilityPercent + margin)],
      evidence,
      why,
      lastSeenYear: latestYear,
      repeatGapYears: latestYear == null ? null : gap,
      formatLikelihood,
      sourceBreakdown,
      studentPriority: probabilityPercent >= 68 ? "Must study today" : probabilityPercent >= 42 ? "This week" : "Later",
      riskIfSkipped: probabilityPercent >= 68 ? "High" : probabilityPercent >= 42 ? "Medium" : "Low",
      sampleSize: questions.length,
      distinctEvidenceYears: distinctYears.size,
      evidenceSufficient,
      disclaimer: `${targetYear} evidence-based revision forecast only; not a leaked or guaranteed paper. ${questions.length} indexed item(s), ${distinctYears.size} year(s), calibrated confidence ${confidence}%.`,
    };
  }).sort((left, right) => right.probabilityPercent - left.probabilityPercent || right.confidence - left.confidence);
}
