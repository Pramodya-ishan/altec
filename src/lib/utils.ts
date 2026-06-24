import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { SYLLABUS } from "../constants/syllabus";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global helper for grades
export function calculateGrade(total: number, subject: 'sft' | 'et' | 'ict'): string {
  const per = total;
  if (per >= 85) return 'A+';
  if (per >= 75) return 'A';
  if (per >= 65) return 'B';
  if (per >= 55) return 'C';
  if (per >= 35) return 'S';
  return 'F';
}

const gradeLevels: Record<string, number> = { 'F': 0, 'S': 1, 'C': 2, 'B': 3, 'A': 4, 'A+': 5 };

export function calculateCurrentGradeFromData(data: any, currentSubject: 'sft' | 'et' | 'ict'): { grade: string, level: number } {
  const subjectData = data[currentSubject];
  const def = SYLLABUS[currentSubject];
  if (!def) return { grade: '-', level: -1 };

  let mcqScore = 0;
  let mcqCheckedCount = 0;
  def.mcqItems.forEach((item: any) => {
    if (subjectData?.topics[item.title]?.checked) {
      mcqScore += (item.count || 0) * def.mcqMult;
      mcqCheckedCount += (item.count || 0);
    }
  });

  let partAScore = 0;
  def.partAItems.forEach((item: any) => {
    let checkedCount = 0;
    item.topics?.forEach((t: string) => { if (subjectData?.topics[t]?.checked) checkedCount++; });
    if (item.topics && item.topics.length > 0) {
      partAScore += (checkedCount / item.topics.length) * (item.max || 0);
    }
  });

  let bcdScores: number[] = [];
  const allBCD = [...def.partBCDItems];
  def.bcdGroups?.forEach((g: any) => allBCD.push(...g.items));

  allBCD.forEach((item: any) => {
    let checkedCount = 0;
    item.topics?.forEach((t: string) => { if (subjectData?.topics[t]?.checked) checkedCount++; });
    if (item.topics && item.topics.length > 0) {
      bcdScores.push((checkedCount / item.topics.length) * (item.max || 0));
    }
  });

  bcdScores.sort((a, b) => b - a);
  let top4BcdScore = 0;
  for (let i = 0; i < Math.min(4, bcdScores.length); i++) top4BcdScore += bcdScores[i];

  let pAMax = currentSubject === 'et' ? 300 : (currentSubject === 'ict' ? 40 : 400);
  let pBcdMax = currentSubject === 'et' ? 400 : (currentSubject === 'ict' ? 60 : 600);

  const mcqCheckedRatio = mcqCheckedCount / 50;
  const minMcqCorrect = Math.min(45, Math.round(mcqCheckedRatio * 40));
  const maxMcqCorrect = Math.min(50, Math.round(mcqCheckedRatio * 45));

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

  if (currentSubject === 'sft') {
    minFinalPercentage = (minPaper2Base / 20) + minMcqScore;
    maxFinalPercentage = (maxPaper2Base / 20) + maxMcqScore;
  } else if (currentSubject === 'et') {
    minFinalPercentage = minMcqScore + (minPaper2Base / 14);
    maxFinalPercentage = maxMcqScore + (maxPaper2Base / 14);
  } else if (currentSubject === 'ict') {
    minFinalPercentage = minMcqScore + (minPaper2Base / 2);
    maxFinalPercentage = maxMcqScore + (maxPaper2Base / 2);
  }

  const avgPercentage = (minFinalPercentage + maxFinalPercentage) / 2;
  const per = currentSubject === 'et' ? (avgPercentage / 70) * 100 : avgPercentage;
  
  if (per === 0) return { grade: '-', level: 0 };
  
  const minGrade = calculateGrade(Math.round(minFinalPercentage), currentSubject);
  const maxGrade = calculateGrade(Math.round(maxFinalPercentage), currentSubject);
  
  const grade = minGrade === maxGrade ? minGrade : `${maxGrade}`;

  return { grade, level: gradeLevels[minGrade] || 0 };
}
