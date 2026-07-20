import { calculateCalibratedForecast } from "./calibratedForecast";

function lesson(value: any) {
  return String(value?.lesson || value?.topic || value?.concept || "").normalize("NFKC").trim().toLowerCase();
}

export function backtestPredictionModel(params: {
  subject: string;
  questions: any[];
  syllabusNodes?: any[];
  startYear?: number;
  endYear?: number;
  topK?: number;
}) {
  const years = [...new Set((params.questions || []).map((question) => Number(question?.year)).filter((year) => Number.isInteger(year) && year >= 1990 && year <= 2100))].sort();
  const startYear = Number(params.startYear || years[Math.max(0, years.length - 5)] || 2021);
  const endYear = Number(params.endYear || years[years.length - 1] || 2025);
  const topK = Math.max(3, Math.min(20, Number(params.topK || 10)));
  const yearlyResults: any[] = [];

  for (const targetYear of years.filter((year) => year >= startYear && year <= endYear)) {
    const training = params.questions.filter((question) => Number(question?.year) < targetYear);
    const actual = new Set(params.questions.filter((question) => Number(question?.year) === targetYear).map(lesson).filter(Boolean));
    if (!training.length || !actual.size) continue;
    const predicted = calculateCalibratedForecast({ subject: params.subject, questions: training, syllabusNodes: params.syllabusNodes, targetYear }).slice(0, topK);
    const predictedLessons = predicted.map((item) => item.lesson.toLowerCase());
    const hits = predictedLessons.filter((item) => actual.has(item));
    yearlyResults.push({
      targetYear,
      trainingQuestions: training.length,
      actualLessonCount: actual.size,
      predictedLessonCount: predictedLessons.length,
      hits,
      hitCount: hits.length,
      precision: Number((hits.length / Math.max(1, predictedLessons.length)).toFixed(3)),
      recall: Number((hits.length / Math.max(1, actual.size)).toFixed(3)),
    });
  }

  const precision = yearlyResults.reduce((sum, item) => sum + item.precision, 0) / Math.max(1, yearlyResults.length);
  const recall = yearlyResults.reduce((sum, item) => sum + item.recall, 0) / Math.max(1, yearlyResults.length);
  return {
    subject: params.subject,
    yearsTested: yearlyResults.length,
    topK,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    hitRate: Number((yearlyResults.filter((item) => item.hitCount > 0).length / Math.max(1, yearlyResults.length)).toFixed(3)),
    yearlyResults,
    note: "Historical backtest only. It measures revision-ranking performance and cannot guarantee a future examination paper.",
  };
}
