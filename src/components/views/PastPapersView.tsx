import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { pastPapersData } from '../../data/pastPapersData';

type AppContextType = ReturnType<typeof useApp>;

export function PastPapersView() {
  const { currentSubject, showNotification } = useApp();
  
  const [selectedExamIndex, setSelectedExamIndex] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // Timer States
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours in seconds
  const [extraTimeGiven, setExtraTimeGiven] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  
  // Answers tracking
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState({ total: 0, attempted: 0, correct: 0 });

  useEffect(() => {
    let timer: any;
    if (hasStarted && !isFinished && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (hasStarted && !isFinished && timeLeft === 0 && !extraTimeGiven) {
      setExtraTimeGiven(true);
      setTimeLeft(600); // 10 minutes
      showNotification('Time up! You have 10 extra minutes to conclude.', 'info');
    } else if (hasStarted && !isFinished && timeLeft === 0 && extraTimeGiven) {
      handleFinishExam();
    }
    return () => clearInterval(timer);
  }, [hasStarted, isFinished, timeLeft, extraTimeGiven]);

  const handleStartExam = (index: number) => {
    setSelectedExamIndex(index);
    setHasStarted(true);
    setIsFinished(false);
    setUserAnswers({});
    setTimeLeft(7200);
    setExtraTimeGiven(false);
    setScore({ total: 0, attempted: 0, correct: 0 });
  };

  const handleSelectAnswer = (qNumber: number, option: number) => {
    if (isFinished) return;
    setUserAnswers(prev => ({
      ...prev,
      [qNumber]: option
    }));
  };

  const handleFinishExam = () => {
    if (selectedExamIndex === null) return;
    
    const paper = sortedPapers[selectedExamIndex];
    let correct = 0;
    let attempted = 0;
    const total = 50;

    for (let i = 1; i <= 50; i++) {
      if (userAnswers[i]) {
        attempted++;
        const correctAnsObj = paper.answers.find(a => a.question === i);
        if (correctAnsObj && correctAnsObj.answer === userAnswers[i]) {
          correct++;
        }
      }
    }

    setScore({ total, attempted, correct });
    setIsFinished(true);
    showNotification(`Exam Finished! You scored ${correct}/50.`, 'success');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const sortedPapers = [...pastPapersData.papers]
    .map(p => ({
      ...p,
      subjectKey: (p.metadata as any).subjectKey || (p.metadata.subject.includes('Engineering') ? 'et' : 'sft'),
      year: parseInt(p.metadata.exam.match(/\d{4}/)?.[0] || '0', 10)
    }))
    .filter(p => p.subjectKey === currentSubject)
    .sort((a, b) => b.year - a.year);

  const currentPaper = selectedExamIndex !== null ? sortedPapers[selectedExamIndex] : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
      {!hasStarted ? (
        <div className="p-6 md:p-8 flex flex-col items-center pt-8 md:pt-16 min-h-full bg-slate-50">
          {sortedPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200">
               <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center text-2xl mb-4">
                  <i className="fa-solid fa-file-circle-xmark"></i>
               </div>
               <h3 className="text-xl font-bold text-slate-800">No Past Papers Available</h3>
               <p className="text-slate-500 mt-2 text-center max-w-sm">
                 There are currently no MCQ past papers available for the selected subject. Switch to SFT or ET to see available papers.
               </p>
            </div>
          ) : (
            <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col items-center">
               <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner border border-slate-100">
                  <i className="fa-solid fa-list-check"></i>
               </div>
               <h2 className="text-2xl font-bold text-slate-900 mb-2 font-display">Select a Past Paper</h2>
               <p className="text-slate-500 text-center mb-8 font-medium">Choose from the available MCQ past papers for your subject to begin the 2-hour simulated exam.</p>

               {/* Custom Select for better UI styling than native select */}
               <div className="w-full relative mb-6">
                 <select 
                    value={selectedExamIndex ?? ''}
                    onChange={(e) => setSelectedExamIndex(Number(e.target.value))}
                    className="w-full p-4 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none cursor-pointer shadow-sm hover:border-slate-300 transition-all text-left"
                 >
                    <option value="" disabled>Select Year / Paper ...</option>
                    {sortedPapers.map((p, idx) => (
                       <option key={idx} value={idx}>{p.metadata.exam}</option>
                    ))}
                 </select>
                 <div className="absolute inset-y-0 right-0 flex items-center pr-5 pointer-events-none text-slate-400 font-bold flex-col justify-center">
                    <i className="fa-solid fa-chevron-down text-sm transition-transform"></i>
                 </div>
               </div>

               <button 
                  disabled={selectedExamIndex === null}
                  onClick={() => {
                    if (selectedExamIndex !== null) {
                      handleStartExam(selectedExamIndex);
                    }
                  }}
                  className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-all shadow-md font-display tracking-wide active:scale-[0.98] flex items-center justify-center gap-2"
               >
                  <i className="fa-regular fa-clock"></i>
                  Start Exam (2 Hours)
               </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 w-full max-w-[1400px] mx-auto bg-white p-2 sm:p-4 md:p-8 md:pt-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-6 border-b border-slate-200 px-2 sm:px-0">
            <div>
              <h2 className="text-xl md:text-3xl font-display font-bold text-slate-900">{currentPaper?.metadata.exam}</h2>
              <p className="text-sm font-semibold text-slate-500 mt-2">2 Hours Duration • 50 Questions</p>
            </div>
            
            {!isFinished ? (
              <div className="mt-5 md:mt-0 flex flex-col sm:flex-row items-center gap-4">
                <div className={`px-5 py-2.5 rounded-xl border flex items-center gap-3 ${extraTimeGiven ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-slate-300 text-slate-800 bg-slate-200/60'}`}>
                  <i className="fa-regular fa-clock text-lg opacity-80"></i>
                  <span className="font-mono text-[18px] font-bold tracking-widest relative top-0.5">
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <button
                  onClick={() => {
                     if (!confirmSubmit) {
                        setConfirmSubmit(true);
                        setTimeout(() => setConfirmSubmit(false), 4000);
                        return;
                     }
                     setConfirmSubmit(false);
                     handleFinishExam();
                  }}
                  className={`${confirmSubmit ? "bg-red-600 hover:bg-red-700 border-red-700" : "bg-slate-900 hover:bg-slate-800 border-slate-700"} text-white px-7 py-3 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] flex items-center gap-2 border`}
                >
                  <i className={confirmSubmit ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-check"}></i> {confirmSubmit ? "Click Again To Submit" : "Submit Paper"}
                </button>
              </div>
            ) : (
              <div className="mt-4 md:mt-0 flex items-center gap-4">
                <div className="text-center px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-0.5">Final Score</p>
                  <p className="text-2xl font-black text-emerald-600">{score.correct} / 50</p>
                </div>
                <button
                  onClick={() => {
                    setHasStarted(false);
                    setSelectedExamIndex(null);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 mt-2 md:mt-0 rounded-xl font-bold transition-all"
                >
                  Back to Papers
                </button>
              </div>
            )}
          </div>

          {/* OMR Sheet Layout */}
          <div className="mt-8 pb-16 w-full mx-auto px-1 sm:px-4 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5 xl:gap-6 font-mono text-sm p-4 sm:p-5 lg:p-6 xl:p-8 rounded-2xl sm:rounded-[2rem] bg-slate-50 border border-slate-200/60 shadow-sm overflow-x-auto">
              {Array.from({ length: 5 }).map((_, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-2 p-3 sm:p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                  {Array.from({ length: 10 }).map((_, rowIndex) => {
                    const qNumber = colIndex * 10 + rowIndex + 1;
                    const correctAnswer = currentPaper?.answers.find(a => a.question === qNumber)?.answer;
                    const userAnswer = userAnswers[qNumber];
                    
                    return (
                      <div key={rowIndex} className="flex items-center justify-between gap-1 sm:gap-2 group p-1.5 rounded-xl hover:bg-slate-50 transition-colors w-full">
                        <span className="w-5 sm:w-6 font-bold text-slate-800 text-right text-[13px] sm:text-[14px] leading-none shrink-0 tracking-tighter">{qNumber}.</span>
                        <div className="flex justify-between w-full ml-1 sm:ml-2">
                          {[1, 2, 3, 4, 5].map(opt => {
                            let circleClass = "w-[26px] h-[26px] rounded-full border-[1.5px] border-slate-300 flex items-center justify-center text-[12px] font-bold text-slate-500 cursor-pointer transition-all bg-white hover:bg-slate-100 hover:border-slate-400 shrink-0";
                            let iconContent: React.ReactNode = opt.toString();
                            
                            // Finished state coloring
                            if (isFinished) {
                              circleClass = "w-[26px] h-[26px] rounded-full border-[1.5px] border-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-400 bg-slate-50 pointer-events-none shrink-0";
                              
                              if (opt === correctAnswer) {
                                circleClass = "w-[28px] h-[28px] rounded-full border-2 border-emerald-500 bg-emerald-500 text-white flex items-center justify-center text-[13px] font-black pointer-events-none scale-110 shadow-md shadow-emerald-500/30 shrink-0 z-10";
                                iconContent = <i className="fa-solid fa-check"></i>;
                              } else if (opt === userAnswer && opt !== correctAnswer) {
                                circleClass = "w-[28px] h-[28px] rounded-full border-2 border-rose-500 bg-rose-500 text-white flex items-center justify-center text-[13px] font-black pointer-events-none shadow-md shadow-rose-500/30 shrink-0 z-10";
                                iconContent = <i className="fa-solid fa-xmark"></i>;
                              }
                            } else {
                              // Active state coloring
                              if (userAnswer === opt) {
                                circleClass = "w-[28px] h-[28px] rounded-full flex items-center justify-center text-[13px] font-black cursor-pointer transition-all shadow-md shadow-indigo-900/20 bg-indigo-600 text-white border-transparent scale-110 focus:outline-none shrink-0 ring-2 ring-indigo-200 z-10";
                                iconContent = <i className="fa-solid fa-minus text-[11px]"></i>;
                              }
                            }

                            return (
                              <button
                                key={opt}
                                className={circleClass}
                                onClick={() => handleSelectAnswer(qNumber, opt)}
                                disabled={isFinished}
                              >
                                {iconContent}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
