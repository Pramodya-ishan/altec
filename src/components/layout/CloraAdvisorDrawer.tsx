import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { AiProgressDiagnosticsSummary } from '../views/AdmissionPredictorView';
import { buildPracticeZSnapshot } from "../../shared/zscore";

export function CloraAdvisorDrawer() {
  const { isAdvisorOpen, setAdvisorOpen, data, saveData } = useApp();

  const targetZ = data.targetZ ?? 2.5;

  const practiceZ = buildPracticeZSnapshot(data);
  const zScoreHistory = (data.zScoreHistory || []).filter(
    (entry) => entry.calculationBasis === "actual_saved_paper_marks",
  );

  return (
    <AnimatePresence>
      {isAdvisorOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAdvisorOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[101] flex flex-col border-l border-slate-200"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <i className="fa-solid fa-robot text-lg"></i>
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">1st Edition</h2>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-1">Sinhala-Enabled Technical Mentor</p>
                </div>
              </div>
              <button
                onClick={() => setAdvisorOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
               {practiceZ.complete && practiceZ.overall !== null ? (
               <AiProgressDiagnosticsSummary
                  targetZ={targetZ}
                  overallZ={practiceZ.overall}
                  sftZ={Number(practiceZ.subjects.sft.z)}
                  etZ={Number(practiceZ.subjects.et.z)}
                  ictZ={Number(practiceZ.subjects.ict.z)}
                  sftMark={Number(practiceZ.subjects.sft.mark)}
                  etMark={Number(practiceZ.subjects.et.mark)}
                  ictMark={Number(practiceZ.subjects.ict.mark)}
                  zScoreHistory={zScoreHistory}
                  appData={data}
                  saveData={saveData}
               />
               ) : (
                 <div className="m-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                   Add at least one completed paper result for SFT, ET and ICT to unlock the practice diagnostics. Lesson completion is not used as a substitute for marks.
                 </div>
               )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
