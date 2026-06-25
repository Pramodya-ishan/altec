import { AppData } from '../types';
import { SYLLABUS } from '../constants/syllabus';

function interpolateRank(z: number, points: number[][]) {
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

export function getEstIslandRank(zScore: number) {
   const islandPoints = [
      [3.5, 1],
      [2.9000, 1],
      [2.8852, 14],
      [2.7873, 31],
      [2.6557, 45],
      [2.3537, 212],
      [2.2295, 228],
      [2.2003, 250],
      [2.0, 511],
      [1.6553, 1033],
      [1.5238, 1358],
      [1.2663, 2032],
      [1.2293, 2170],
      [1.1375, 2473],
      [0.7249, 4155],
      [0.6274, 4500],
      [0.0, 10000],
      [-1.0, 15000],
      [-2.0, 18000]
   ];
   return interpolateRank(zScore, islandPoints);
}

export function getEstDistrictRank(zScore: number) {
   const districtPoints = [
      [3.5, 1],
      [2.9000, 1],
      [2.7, 1],
      [2.3537, 3],
      [2.2295, 6],
      [2.1, 8],
      [2.0, 10],
      [1.5238, 40],
      [1.2663, 55],
      [1.2293, 56],
      [1.1375, 65],
      [0.7249, 113],
      [0.6274, 130],
      [0.0, 600],
      [-1.0, 900]
   ];
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
    minFinalPercentage = minMcqScore + (minPaper2Base * (35 / 700));
    maxFinalPercentage = maxMcqScore + (maxPaper2Base * (35 / 700));
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
  let seVal = 7.5;
  let essayVal = 10.0;

  if (subjectKey === 'et') {
    mcqVal = 0.75;
    seVal = 3.75;
    essayVal = 5.0;
  } else if (subjectKey === 'sft' || subjectKey === 'ict') {
    mcqVal = 1.0;
    seVal = 7.5;
    essayVal = 10.0;
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
        // distribute 1 full SE question marks among its topics
        const markPerTopic = seVal / item.topics.length;
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
        // distribute 1 full Essay question marks among its topics
        const markPerTopic = essayVal / item.topics.length;
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

  Object.values(marksMap).forEach(t => {
    t.mcqMarks = Number(t.mcqMarks.toFixed(2));
    t.essayMarks = Number(t.essayMarks.toFixed(2));
    t.structuredEssayMarks = Number(t.structuredEssayMarks.toFixed(2));
    t.totalMarks = Number(t.totalMarks.toFixed(2));
  });

  return marksMap;
};
