import type { AppData } from '../types';
import { SYLLABUS } from '../constants/syllabus';

import { estimateSubjectZFromMark } from '../shared/zscore';

export const calculateSubjectZ = (subject: 'sft' | 'et' | 'ict', mark: number): number => {
  return estimateSubjectZFromMark(subject, mark);
};

export type ExamScoreProjection = {
  minimum: number;
  maximum: number;
  midpoint: number;
  mcqCompleted: number;
  partARaw: number;
  partBcdRaw: number;
};

type RankPoint = readonly [zScore: number, rank: number];

// Restored from the previous project rank model. These are model anchors, not
// Department of Examinations cohort statistics, so every consumer must label
// their output as an estimate.
const ISLAND_RANK_MODEL: RankPoint[] = [
  [2.9999, 1], [2.6557, 45], [2.3537, 212], [2.2295, 228],
  [2.2003, 250], [2.0, 511], [1.6553, 1033], [1.5238, 1358],
  [1.2663, 2032], [1.2293, 2170], [1.1375, 2473], [0.7249, 4155],
  [0.6274, 4155],
];

const DISTRICT_RANK_MODEL: RankPoint[] = [
  [2.9999, 1], [2.6557, 2], [2.3537, 3], [2.2295, 5],
  [2.2003, 6], [2.0, 10], [1.6553, 32], [1.5238, 40],
  [1.2663, 55], [1.2293, 56], [1.1375, 65], [0.7249, 113],
  [0.6274, 119],
];

function interpolateEstimatedRank(zScore: number, points: RankPoint[]) {
  const sorted = [...points].sort((a, b) => b[0] - a[0]);
  if (zScore >= sorted[0][0]) return sorted[0][1];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const [upperZ, upperRank] = sorted[index];
    const [lowerZ, lowerRank] = sorted[index + 1];
    if (zScore <= upperZ && zScore >= lowerZ) {
      const ratio = (upperZ - zScore) / Math.max(0.0001, upperZ - lowerZ);
      return Math.max(1, Math.round(upperRank + ratio * (lowerRank - upperRank)));
    }
  }

  const [lowestZ, lowestRank] = sorted[sorted.length - 1];
  const [highestZ, highestRank] = sorted[0];
  const fullSlope = (lowestRank - highestRank) / Math.max(0.0001, highestZ - lowestZ);
  return Math.max(lowestRank, Math.round(lowestRank + (lowestZ - zScore) * fullSlope));
}

export const getEstimatedIslandRank = (zScore: number) =>
  interpolateEstimatedRank(zScore, ISLAND_RANK_MODEL);

export const getEstimatedDistrictRank = (zScore: number) =>
  interpolateEstimatedRank(zScore, DISTRICT_RANK_MODEL);

export const calculateExamScoreProjection = (
  subjectKey: 'sft' | 'et' | 'ict',
  data: AppData,
): ExamScoreProjection => {
  const def = SYLLABUS[subjectKey];
  const subjectData = data[subjectKey];
  if (!def || !subjectData) {
    return { minimum: 0, maximum: 0, midpoint: 0, mcqCompleted: 0, partARaw: 0, partBcdRaw: 0 };
  }

  let mcqCheckedCount = 0;
  def.mcqItems.forEach((item) => {
    if (subjectData.topics[item.title]?.checked) mcqCheckedCount += item.count || 0;
  });

  let partAScore = 0;
  def.partAItems.forEach((item) => {
    const completed = item.topics?.filter((topic) => subjectData.topics[topic]?.checked).length || 0;
    if (item.topics?.length) partAScore += (completed / item.topics.length) * (item.max || 0);
  });

  const bcdScores: number[] = [];
  const allBcd = [...def.partBCDItems];
  def.bcdGroups?.forEach((group) => allBcd.push(...group.items));
  allBcd.forEach((item) => {
    const completed = item.topics?.filter((topic) => subjectData.topics[topic]?.checked).length || 0;
    if (item.topics?.length) bcdScores.push((completed / item.topics.length) * (item.max || 0));
  });
  const top4BcdScore = bcdScores.sort((a, b) => b - a).slice(0, 4).reduce((sum, value) => sum + value, 0);

  const partAMax = subjectKey === 'et' ? 300 : subjectKey === 'ict' ? 40 : 400;
  const partBcdMax = subjectKey === 'et' ? 400 : subjectKey === 'ict' ? 60 : 600;
  const mcqRatio = mcqCheckedCount / Math.max(1, def.mcqMax || 50);
  const minimumMcq = Math.min(45, Math.round(mcqRatio * 40)) * def.mcqMult;
  const maximumMcq = Math.min(50, Math.round(mcqRatio * 45)) * def.mcqMult;
  const partARatio = partAScore / Math.max(1, partAMax);
  const bcdRatio = top4BcdScore / Math.max(1, partBcdMax);
  const minimumPaper2 = Math.min(0.9, partARatio * 0.85) * partAMax
    + Math.min(145 / 150, bcdRatio * (130 / 150)) * partBcdMax;
  const maximumPaper2 = Math.min(1, partARatio * 0.9) * partAMax
    + Math.min(1, bcdRatio * (145 / 150)) * partBcdMax;

  let minimum = 0;
  let maximum = 0;
  if (subjectKey === 'sft') {
    minimum = minimumPaper2 / 20 + minimumMcq;
    maximum = maximumPaper2 / 20 + maximumMcq;
  } else if (subjectKey === 'et') {
    minimum = minimumMcq * 0.75 + minimumPaper2 * (37.5 / 700) + 25;
    maximum = maximumMcq * 0.75 + maximumPaper2 * (37.5 / 700) + 25;
  } else {
    minimum = minimumMcq + minimumPaper2 / 2;
    maximum = maximumMcq + maximumPaper2 / 2;
  }

  minimum = Math.max(0, Math.min(95, Math.round(minimum)));
  maximum = Math.max(minimum, Math.min(95, Math.round(maximum)));
  return {
    minimum,
    maximum,
    midpoint: Number(((minimum + maximum) / 2).toFixed(1)),
    mcqCompleted: mcqCheckedCount,
    partARaw: partAScore,
    partBcdRaw: top4BcdScore,
  };
};

export const buildExamScorePrediction = (data: AppData) => {
  const projections = {
    sft: calculateExamScoreProjection('sft', data),
    et: calculateExamScoreProjection('et', data),
    ict: calculateExamScoreProjection('ict', data),
  };
  const subjectZScores = {
    sft: calculateSubjectZ('sft', projections.sft.midpoint),
    et: calculateSubjectZ('et', projections.et.midpoint),
    ict: calculateSubjectZ('ict', projections.ict.midpoint),
  };
  const zScore = Number(((subjectZScores.sft + subjectZScores.et + subjectZScores.ict) / 3).toFixed(4));
  return {
    projections,
    projectedMarks: {
      sft: projections.sft.midpoint,
      et: projections.et.midpoint,
      ict: projections.ict.midpoint,
    },
    subjectZScores,
    zScore,
    estimatedIslandRank: getEstimatedIslandRank(zScore),
    estimatedDistrictRank: getEstimatedDistrictRank(zScore),
    calculationBasis: 'exam_score_predictor' as const,
    official: false as const,
  };
};

export const calculateSubjectAveragePercent = (subjectKey: 'sft' | 'et' | 'ict', data: AppData): number => {
  return calculateExamScoreProjection(subjectKey, data).midpoint;
};

export const calculateLessonWiseMarks = (subjectKey: 'sft' | 'et' | 'ict', subjectData?: any): Record<string, { mcqMarks: number; essayMarks: number; structuredEssayMarks: number; totalMarks: number; isCompleted: boolean }> => {
  const def = SYLLABUS[subjectKey];
  const marksMap: Record<string, { mcqMarks: number; essayMarks: number; structuredEssayMarks: number; totalMarks: number; isCompleted: boolean }> = {};

  if (!def) return marksMap;

  let mcqVal = 1.0;
  let seVal = 5.0;
  let essayVal = 7.5;

  if (subjectKey === 'et') {
    mcqVal = 0.7;
    seVal = 3.75;
    essayVal = 5.0;
  } else if (subjectKey === 'ict') {
    mcqVal = 1.0;
    seVal = 5.0;
    essayVal = 7.5;
  } else if (subjectKey === 'sft') {
    mcqVal = 1.0;
    seVal = 5.0;
    essayVal = 7.5;
  }

  const getOrInit = (topic: string) => {
    if (!marksMap[topic]) {
      const isCompleted = subjectData?.topics?.[topic]?.checked || false;
      marksMap[topic] = { mcqMarks: 0, essayMarks: 0, structuredEssayMarks: 0, totalMarks: 0, isCompleted };
    }
    return marksMap[topic];
  };

  def.mcqItems.forEach(item => {
    const t = getOrInit(item.title);
    const marks = (item.count || 0) * mcqVal;
    t.mcqMarks += marks;
    t.totalMarks += marks;
  });

  const distributeStructuredEssayMarks = (items: any[]) => {
    items.forEach(item => {
      if (item.topics && item.topics.length > 0) {
        // distribute full SE question marks among its topics
        const currentSeVal = seVal;
        const markPerTopic = currentSeVal / item.topics.length;
        item.topics.forEach((topic: string) => {
          const t = getOrInit(topic);
          t.structuredEssayMarks += markPerTopic;
          t.totalMarks += markPerTopic;
        });
      }
    });
  };

  const distributeEssayMarks = (items: any[]) => {
    items.forEach(item => {
      if (item.topics && item.topics.length > 0) {
        // distribute full Essay question marks among its topics
        const currentEssayVal = essayVal;
        const markPerTopic = currentEssayVal / item.topics.length;
        item.topics.forEach((topic: string) => {
          const t = getOrInit(topic);
          t.essayMarks += markPerTopic;
          t.totalMarks += markPerTopic;
        });
      }
    });
  };

  distributeStructuredEssayMarks(def.partAItems);
  distributeEssayMarks(def.partBCDItems);
  def.bcdGroups?.forEach(g => distributeEssayMarks(g.items));

  const sumTotalRaw = Object.values(marksMap).reduce((sum, t) => sum + t.totalMarks, 0);
  if (sumTotalRaw > 0) {
    Object.values(marksMap).forEach(t => {
      t.mcqMarks = Number(((t.mcqMarks / sumTotalRaw) * 100).toFixed(2));
      t.essayMarks = Number(((t.essayMarks / sumTotalRaw) * 100).toFixed(2));
      t.structuredEssayMarks = Number(((t.structuredEssayMarks / sumTotalRaw) * 100).toFixed(2));
      t.totalMarks = Number(((t.totalMarks / sumTotalRaw) * 100).toFixed(2));
    });
  } else {
    Object.values(marksMap).forEach(t => {
      t.mcqMarks = Number(t.mcqMarks.toFixed(2));
      t.essayMarks = Number(t.essayMarks.toFixed(2));
      t.structuredEssayMarks = Number(t.structuredEssayMarks.toFixed(2));
      t.totalMarks = Number(t.totalMarks.toFixed(2));
    });
  }

  return marksMap;
};
