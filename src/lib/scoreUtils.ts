import { AppData } from '../types';
import { SYLLABUS } from '../constants/syllabus';

import zscoreData from '../data/zscore_data.json';

function interpolateRank(z: number, points: number[][]) {
   if (points.length === 0) return 0;
   // Sort points descending by Z-score
   points.sort((a, b) => b[0] - a[0]);

   if (z >= points[0][0]) return points[0][1];
   if (z <= points[points.length - 1][0]) return points[points.length - 1][1];
   
   for (let i = 0; i < points.length - 1; i++) {
      const z1 = points[i][0];
      const r1 = points[i][1];
      const z2 = points[i+1][0];
      const r2 = points[i+1][1];
      
      if (z <= z1 && z >= z2) {
         const ratio = (z1 - z) / (z1 - z2);
         return Math.max(1, Math.round(r1 + ratio * (r2 - r1)));
      }
   }
   return points[points.length - 1][1];
}

function getZScorePoints(type: 'island' | 'district') {
  const points: number[][] = [];
  
  const allRecords = zscoreData.students || [];

  allRecords.forEach((r: any) => {
    const z = typeof r["Z-Score"] === 'number' ? r["Z-Score"] : parseFloat(r["Z-Score"]);
    if (isNaN(z)) return;

    if (type === 'island') {
      const islandRank = r["Island Rank"] !== undefined && r["Island Rank"] !== null ? Number(r["Island Rank"]) : null;
      if (islandRank !== null && !isNaN(islandRank)) {
        points.push([z, islandRank]);
      }
    } else if (type === 'district') {
      const districtRank = r["District Rank"] !== undefined && r["District Rank"] !== null ? Number(r["District Rank"]) : null;
      if (districtRank !== null && !isNaN(districtRank)) {
        points.push([z, districtRank]);
      }
    }
  });

  points.sort((a, b) => b[0] - a[0]);
  let worstRankSoFar = 0;
  return points.map(([z, rank]) => {
    worstRankSoFar = Math.max(worstRankSoFar, rank);
    return [z, worstRankSoFar];
  });
}

export function getEstIslandRank(zScore: number) {
   const islandPoints = getZScorePoints('island');
   return interpolateRank(zScore, islandPoints);
}

export function getEstDistrictRank(zScore: number) {
   const districtPoints = getZScorePoints('district');
   return interpolateRank(zScore, districtPoints);
}

export const calculateSubjectZ = (subject: 'sft' | 'et' | 'ict', mark: number): number => {
  const finalMark = Math.min(95, mark);
  
  const curves = {
    sft: [
      { x: 95, y: 2.90 },
      { x: 89, y: 2.71 },
      { x: 80, y: 2.15 },
      { x: 75, y: 1.80 },
      { x: 65, y: 1.25 },
      { x: 55, y: 0.80 },
      { x: 35, y: 0.05 },
      { x: 0, y: -2.30 }
    ],
    et: [
      { x: 95, y: 2.90 },
      { x: 87, y: 2.68 },
      { x: 80, y: 2.10 },
      { x: 75, y: 1.60 },
      { x: 65, y: 1.00 },
      { x: 55, y: 0.50 },
      { x: 35, y: -0.05 },
      { x: 0, y: -2.30 }
    ],
    ict: [
      { x: 95, y: 2.90 },
      { x: 89, y: 2.77 },
      { x: 80, y: 2.20 },
      { x: 75, y: 1.80 },
      { x: 65, y: 1.25 },
      { x: 55, y: 0.85 },
      { x: 35, y: 0.25 },
      { x: 0, y: -2.30 }
    ]
  };

  const points = curves[subject];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (finalMark <= p1.x && finalMark >= p2.x) {
      const ratio = (finalMark - p2.x) / (p1.x - p2.x);
      const computed = p2.y + ratio * (p1.y - p2.y);
      return Number(Math.min(3.00, Math.max(-2.50, computed)).toFixed(4));
    }
  }
  return -2.00;
};

export const calculateSubjectAveragePercent = (subjectKey: 'sft' | 'et' | 'ict', data: AppData): number => {
  const def = SYLLABUS[subjectKey];
  const subjectData = data[subjectKey];
  if (!def || !subjectData) return 50;

  let mcqScore = 0;
  let mcqCheckedCount = 0;
  def.mcqItems.forEach(item => {
    if (subjectData.topics[item.title]?.checked) {
      mcqScore += (item.count || 0) * def.mcqMult;
      mcqCheckedCount += (item.count || 0);
    }
  });

  let partAScore = 0;
  def.partAItems.forEach(item => {
    let checkedCount = 0;
    item.topics?.forEach(t => { if (subjectData.topics[t]?.checked) checkedCount++; });
    if (item.topics && item.topics.length > 0) {
      partAScore += (checkedCount / item.topics.length) * (item.max || 0);
    }
  });

  let bcdScores: number[] = [];
  const allBCD = [...def.partBCDItems];
  def.bcdGroups?.forEach(g => allBCD.push(...g.items));

  allBCD.forEach(item => {
    let checkedCount = 0;
    item.topics?.forEach(t => { if (subjectData.topics[t]?.checked) checkedCount++; });
    if (item.topics && item.topics.length > 0) {
      bcdScores.push((checkedCount / item.topics.length) * (item.max || 0));
    }
  });

  bcdScores.sort((a, b) => b - a);
  let top4BcdScore = 0;
  for (let i = 0; i < Math.min(4, bcdScores.length); i++) top4BcdScore += bcdScores[i];

  let pAMax = subjectKey === 'et' ? 300 : (subjectKey === 'ict' ? 40 : 400);
  let pBcdMax = subjectKey === 'et' ? 400 : (subjectKey === 'ict' ? 60 : 600);

  const maxMcqTotal = def.mcqMax || 50;
  const mcqCheckedRatio = mcqCheckedCount / maxMcqTotal;
  const minMcqCorrect = Math.round(mcqCheckedRatio * (maxMcqTotal * 0.8)); // assumes student gets 80% correct
  const maxMcqCorrect = Math.round(mcqCheckedRatio * (maxMcqTotal * 0.95)); // assumes student gets 95% correct

  const minMcqScore = minMcqCorrect * def.mcqMult;
  const maxMcqScore = maxMcqCorrect * def.mcqMult;

  const partACheckedRatio = pAMax ? partAScore / pAMax : 0;
  const minPartARatio = Math.min(0.90, partACheckedRatio * 0.85);
  const maxPartARatio = Math.min(1.0, partACheckedRatio * 0.90);
  
  const minPartAScore = minPartARatio * pAMax;
  const maxPartAScore = maxPartARatio * pAMax;

  const bcdCheckedRatio = pBcdMax ? top4BcdScore / pBcdMax : 0;
  const minBcdRatio = Math.min(145/150, bcdCheckedRatio * (130/150));
  const maxBcdRatio = Math.min(1.0, bcdCheckedRatio * (145/150));
  
  const minBcdScore = minBcdRatio * pBcdMax;
  const maxBcdScore = maxBcdRatio * pBcdMax;

  let minFinalPercentage = 0;
  let maxFinalPercentage = 0;

  const minPaper2Base = minPartAScore + minBcdScore;
  const maxPaper2Base = maxPartAScore + maxBcdScore;

  if (subjectKey === 'sft') {
    minFinalPercentage = (minPaper2Base / 20) + minMcqScore;
    maxFinalPercentage = (maxPaper2Base / 20) + maxMcqScore;
  } else if (subjectKey === 'et') {
    minFinalPercentage = minMcqScore + (minPaper2Base / 14);
    maxFinalPercentage = maxMcqScore + (maxPaper2Base / 14);
  } else if (subjectKey === 'ict') {
    minFinalPercentage = minMcqScore + (minPaper2Base / 2);
    maxFinalPercentage = maxMcqScore + (maxPaper2Base / 2);
  }

  return Math.min(95, Math.round((minFinalPercentage + maxFinalPercentage) / 2));
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
