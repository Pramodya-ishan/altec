import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SYLLABUS } from '../../constants/syllabus';
import { calculateGrade, cn } from '../../lib/utils';
import { AppData, SubjectKey } from '../../types';
import JSZip from 'jszip';
import { calculateExamScoreProjection } from '../../lib/scoreUtils';

export function PredictorWidget() {
  const { data, currentSubject, saveData, clearLocalStorage, showNotification } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => data.collapsedStates?.predictorWidget ?? true);

  const toggleCollapse = () => {
    setIsCollapsed((previous) => {
      const next = !previous;
      saveData({
        ...data,
        collapsedStates: { ...data.collapsedStates, predictorWidget: next },
      });
      return next;
    });
  };

  const def = SYLLABUS[currentSubject];
  const subjectData = data[currentSubject];

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

  let pAMax = currentSubject === 'et' ? 300 : (currentSubject === 'ict' ? 40 : 400);
  let pBcdMax = currentSubject === 'et' ? 400 : (currentSubject === 'ict' ? 60 : 600);

  // Dynamic MIN/MAX calculations based on syllabus requirements:
  const mcqCheckedRatio = mcqCheckedCount / 50;
  const minMcqCorrect = Math.min(45, Math.round(mcqCheckedRatio * 40));
  const maxMcqCorrect = Math.min(50, Math.round(mcqCheckedRatio * 45));

  const minMcqScore = minMcqCorrect * def.mcqMult;
  const maxMcqScore = maxMcqCorrect * def.mcqMult;

  const partACheckedRatio = pAMax ? partAScore / pAMax : 0;
  // Calculate Part A min and max score based on 85-90 per 100 benchmark (85%-90%)
  const minPartARatio = Math.min(0.90, partACheckedRatio * 0.85);
  const maxPartARatio = Math.min(1.0, partACheckedRatio * 0.90);
  
  const minPartAScore = minPartARatio * pAMax;
  const maxPartAScore = maxPartARatio * pAMax;

  const bcdCheckedRatio = pBcdMax ? top4BcdScore / pBcdMax : 0;
  // Calculate BCD min and max score based on 130-145 per 150 benchmark
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
    // Written theory paper max mark is 75 (MCQ max 37.5 + Paper 2 max 37.5)
    // Plus 25 practical marks
    const minTheory = (minMcqScore * 0.75) + (minPaper2Base * (37.5 / 700));
    const maxTheory = (maxMcqScore * 0.75) + (maxPaper2Base * (37.5 / 700));
    minFinalPercentage = minTheory + 25;
    maxFinalPercentage = maxTheory + 25;
  } else if (currentSubject === 'ict') {
    minFinalPercentage = minMcqScore + (minPaper2Base / 2);
    maxFinalPercentage = maxMcqScore + (maxPaper2Base / 2);
  }

  // Keep the widget and every Z-score consumer on one calculation source.
  const sharedProjection = calculateExamScoreProjection(currentSubject, data);
  minFinalPercentage = sharedProjection.minimum;
  maxFinalPercentage = sharedProjection.maximum;

  minFinalPercentage = Math.round(minFinalPercentage);
  maxFinalPercentage = Math.round(maxFinalPercentage);

  const isET = currentSubject === 'et';
  const displayFinal = isET 
    ? `${minFinalPercentage} - ${maxFinalPercentage} Marks (Includes 25 Practical Marks)` 
    : `${minFinalPercentage} - ${maxFinalPercentage} Marks`;

  const per = (minFinalPercentage + maxFinalPercentage) / 2;

  let hue = 0;
  if (per >= 80) hue = 120;
  else if (per > 0) hue = (per / 80) * 120;

  const minGrade = calculateGrade(minFinalPercentage, currentSubject as 'sft' | 'et' | 'ict');
  const maxGrade = calculateGrade(maxFinalPercentage, currentSubject as 'sft' | 'et' | 'ict');
  const displayGrade = minGrade === maxGrade ? minGrade : `${minGrade} - ${maxGrade}`;

  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const zip = new JSZip();
      zip.file(`Tech_Blueprint_${new Date().toISOString().slice(0, 10)}.json`, dataStr);
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tech_Blueprint_Firebase_FullData_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('Backup exported to ZIP successfully.', 'success');
    } catch (error) {
      console.error('Export Error:', error);
      showNotification('Failed to export data.', 'error');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (imported.sft || imported.topics) {
          let newData = structuredClone(data);
          if (imported.topics && !imported.sft) {
            newData.sft.topics = imported.topics;
          } else {
            newData = imported;
          }
          (['sft', 'et', 'ict'] as SubjectKey[]).forEach(subj => {
            if (!newData[subj]) newData[subj] = { topics: {}, paperMarks: [], questionMarks: {} };
            if (!newData[subj].paperMarks) newData[subj].paperMarks = [];
            if (!newData[subj].questionMarks) newData[subj].questionMarks = {};
          });
          saveData(newData);
          showNotification('Data imported successfully!', 'success');
        } else {
          showNotification('Invalid backup file format.', 'error');
        }
      } catch (err) {
        showNotification('Error reading file.', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (confirmClear) {
      clearLocalStorage();
      showNotification('App Data has been successfully cleared.', 'success');
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
    }
  };

  return (
    <section className="bg-gradient-to-b from-white to-indigo-50/30 border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-lg overflow-hidden text-left">
      {/* COLLAPSE TRIGGER AS AN ACCESSIBLE BUTTON */}
      <button
        type="button"
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-xl p-1 -m-1 cursor-pointer select-none"
        aria-expanded={!isCollapsed}
        aria-label="Toggle Exam Score Predictor details"
      >
        <span className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
          Exam Score Predictor
          <span className="text-[10px] bg-primary-50 text-primary-600 px-3 py-1 rounded-full font-black uppercase tracking-wider">
            {currentSubject.toUpperCase()}
          </span>
        </span>
        <i className={cn(
          "fa-solid text-slate-400 text-base sm:text-lg transition-transform duration-300",
          isCollapsed ? "fa-chevron-down" : "fa-chevron-up"
        )}></i>
      </button>

      {/* COLLAPSIBLE DETAILS AREA */}
      {!isCollapsed && (
        <div className="flex flex-col gap-4 mt-6 ">
          <div className="flex flex-col gap-4 md:gap-6 items-center w-full">
            
            {/* LEFT SIDE: FINAL PERCENTAGE ACCENT CARD */}
            <div className="flex flex-col items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm w-full">
              <div className="flex flex-col items-center text-center w-full">
                <h3 className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold mb-1">
                  Final Projected
                </h3>
                <div className="text-3xl font-mono font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-primary-600 to-indigo-900 leading-none flex items-center justify-center gap-3">
                  <span>{displayFinal}</span>
                  <span className="text-sm font-bold bg-primary-50/80 text-primary-700 px-2 py-0.5 rounded-full border border-transparent">{displayGrade}</span>
                </div>
                
                <div className="w-full mt-3">
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner flex">
                    <div
                      className="h-full transition-all duration-800 ease-out"
                      style={{ width: `${Math.min(per, 100)}%`, backgroundColor: `hsl(${hue}, 85%, 50%)` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: BREAKDOWN CARDS */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
              <div className="bg-slate-50/75 border border-slate-200 p-2 sm:p-3 rounded-xl flex flex-col gap-0.5 text-center justify-center">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-widest truncate">
                  MCQ
                </span>
                <div className="text-sm md:text-md lg:text-lg font-mono font-black text-slate-800">
                  {Math.round(mcqCheckedCount)} <span className="text-slate-400 text-[9px] sm:text-[10px] font-semibold">/ {def.mcqMax}</span>
                </div>
              </div>

              <div className="bg-slate-50/75 border border-slate-200 p-2 sm:p-3 rounded-xl flex flex-col gap-0.5 text-center justify-center">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-widest truncate">
                  Part A
                </span>
                <div className="text-sm md:text-md lg:text-lg font-mono font-black text-slate-800">
                  {Math.round(partAScore)} <span className="text-slate-400 text-[9px] sm:text-[10px] font-semibold">/ {pAMax}</span>
                </div>
              </div>

              <div className="bg-slate-50/75 border border-slate-200 p-2 sm:p-3 rounded-xl flex flex-col gap-0.5 text-center justify-center">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-widest truncate">
                  Part B,C,D
                </span>
                <div className="text-sm md:text-md lg:text-lg font-mono font-black text-slate-800">
                  {Math.round(top4BcdScore)} <span className="text-slate-400 text-[9px] sm:text-[10px] font-semibold">/ {pBcdMax}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ACTIONS: SECURE BOTTOM BUTTON GROUP WITH PERFECT MOBILE STACKING */}
          {/* Action buttons removed based on request */}
        </div>
      )}
    </section>
  );
}
