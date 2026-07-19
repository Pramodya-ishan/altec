export interface ForecastQuestionEvidence {
  year: number;
  question: string;
  reason: string;
}

export interface CalibratedTopicForecast {
  topic: string;
  subject: string;
  lesson: string;
  probability: "Very High" | "High" | "Medium" | "Low";
  probabilityPercent: number;
  confidence: number;
  confidenceInterval: [number, number];
  evidence: ForecastQuestionEvidence[];
  studentPriority: "Must study today" | "This week" | "Later";
  riskIfSkipped: "High" | "Medium" | "Low";
  sampleSize: number;
  disclaimer: string;
}

function normalize(value: unknown) {
  return String(value || "Unknown").normalize("NFKC").trim() || "Unknown";
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

/** Evidence-calibrated ranking, not an exam leak or certainty claim. */
export function calculateCalibratedForecast(params: {
  subject: string;
  questions: any[];
  syllabusNodes?: any[];
  targetYear?: number;
}): CalibratedTopicForecast[] {
  const targetYear = Number(params.targetYear || 2026);
  const syllabus = new Map((params.syllabusNodes || []).map((node: any) => [normalize(node?.lesson || node?.topic || node?.name).toLowerCase(), node]));
  const grouped = new Map<string, any[]>();
  for (const question of params.questions || []) {
    const lesson = normalize(question?.lesson || question?.topic || question?.concept);
    const key = lesson.toLowerCase();
    grouped.set(key, [...(grouped.get(key) || []), question]);
  }
  for (const [key, node] of syllabus) if (!grouped.has(key)) grouped.set(key, []);

  const allYears = (params.questions || []).map(yearOf).filter((year): year is number => year != null);
  const corpusYears = new Set(allYears).size;
  const maxYear = allYears.length > 0 ? Math.max(...allYears) : targetYear - 1;

  return Array.from(grouped.entries()).map(([key, questions]): CalibratedTopicForecast => {
    const node: any = syllabus.get(key) || {};
    const lesson = normalize(node.lesson || questions[0]?.lesson || questions[0]?.topic || key);
    const years = questions.map(yearOf).filter((year): year is number => year != null);
    const distinctYears = new Set(years);
    const latestYear = years.length > 0 ? Math.max(...years) : null;
    const syllabusWeight = Math.max(0, Math.min(1, Number(node.weight ?? node.syllabusWeight ?? 0.5)));
    const frequency = corpusYears > 0 ? Math.min(1, distinctYears.size / corpusYears) : 0;
    const coverage = Math.min(1, questions.length / 5);
    const gap = latestYear == null ? Math.min(6, Math.max(0, targetYear - maxYear)) : Math.max(0, targetYear - latestYear);
    const rotation = Math.min(1, gap / 4);
    const verifiedRatio = questions.length > 0
      ? questions.filter((question) => question?.verified !== false && (question?.sourceId || question?.sourceTitle)).length / questions.length
      : 0;
    const raw = 100 * (0.32 * frequency + 0.23 * syllabusWeight + 0.18 * rotation + 0.15 * coverage + 0.12 * verifiedRatio);
    const probabilityPercent = Math.round(Math.max(8, Math.min(92, raw)));
    const evidenceStrength = Math.min(1, distinctYears.size / 4) * 0.55 + verifiedRatio * 0.3 + Math.min(1, corpusYears / 6) * 0.15;
    const confidence = Math.round(Math.max(18, Math.min(95, evidenceStrength * 100)));
    const margin = Math.max(5, Math.round(24 - confidence * 0.17));
    const probability = scoreLabel(probabilityPercent);
    const evidence = [...questions]
      .sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0))
      .slice(0, 5)
      .map((question) => ({
        year: yearOf(question) || 0,
        question: normalize(question?.questionText || question?.question || question?.questionNo || "Indexed question"),
        reason: question?.verified === false ? "Indexed occurrence; source needs verification." : "Verified indexed occurrence used in the frequency/recency model.",
      }));
    return {
      topic: normalize(node.topic || questions[0]?.topic || lesson),
      subject: params.subject,
      lesson,
      probability,
      probabilityPercent,
      confidence,
      confidenceInterval: [Math.max(0, probabilityPercent - margin), Math.min(100, probabilityPercent + margin)] as [number, number],
      evidence,
      studentPriority: probabilityPercent >= 68 ? "Must study today" : probabilityPercent >= 42 ? "This week" : "Later",
      riskIfSkipped: probabilityPercent >= 68 ? "High" : probabilityPercent >= 42 ? "Medium" : "Low",
      sampleSize: questions.length,
      disclaimer: `2026 evidence-based forecast only; not a leaked or guaranteed paper. Confidence reflects ${questions.length} indexed item(s) across ${distinctYears.size} year(s).`,
    };
  }).sort((a, b) => b.probabilityPercent - a.probabilityPercent || b.confidence - a.confidence);
}
