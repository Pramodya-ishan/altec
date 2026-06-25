import { apiFetch } from "../../lib/api";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface QuizGeneratorProps {
  currentSubject: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QuizGenerator({ currentSubject, isOpen, onClose }: QuizGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizResults, setQuizResults] = useState<any[]>([]);

  const handleGenerate = async () => {
     setLoading(true);
     setError('');
     try {
       const res = await apiFetch('/api/notebook-quiz', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           subject: currentSubject
         })
       });
       if (!res.ok) {
         throw new Error("Failed to connect to NotebookLM API layer.");
       }
       const data = await res.json();
       if (data.quiz) {
         setQuizResults(data.quiz);
       } else {
         setError("No quiz generated.");
       }
     } catch (e: any) {
       setError(e.message || "Network error linking to workspace.");
     } finally {
       setLoading(false);
     }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        ></motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-[2rem] shadow-2xl p-6 sm:p-8 w-full max-w-md border border-slate-100 flex flex-col z-10"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <i className="fa-solid fa-book-open-reader"></i>
              </div>
              <div>
                 <h2 className="text-xl font-display font-extrabold text-slate-900 leading-none">AI Guided Quiz</h2>
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Study Companion</p>
              </div>
            </div>
            <button
              onClick={() => {
                setQuizResults([]);
                onClose();
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {quizResults.length > 0 ? (
            <div className="flex-1 overflow-y-auto max-h-[60vh] -mx-6 px-6 pb-4">
              <div className="space-y-6">
                {quizResults.map((q, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <p className="font-bold text-slate-800 text-sm mb-3">
                       <span className="text-blue-600 mr-2">Q{idx + 1}.</span> {q.question}
                    </p>
                    <div className="space-y-2">
                       {q.options?.map((opt: string, oidx: number) => (
                          <div key={oidx} className={`p-2 rounded-lg text-xs font-medium border ${oidx === q.correctIndex ? 'border-green-300 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                            {opt}
                            {oidx === q.correctIndex && <i className="fa-solid fa-check ml-2 float-right text-green-500"></i>}
                          </div>
                       ))}
                    </div>
                    {q.explanation && (
                       <p className="mt-3 text-xs text-slate-500 font-semibold bg-white p-2 rounded border border-slate-100">
                          <i className="fa-solid fa-lightbulb text-amber-500 mr-1.5"></i> {q.explanation}
                       </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
             <>
                <div className="space-y-4 mb-8">
                   <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">
                        Generate high-quality, targeted study quizzes directly via AI, providing intelligent RAG-style generation without leaving your workspace.
                      </p>
                   </div>
                   <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-800 text-sm font-bold flex gap-3">
                      <i className="fa-solid fa-bolt mt-0.5 pointer-events-none"></i>
                      <div>
                         Quiz Generation powered by 1st Edition
                      </div>
                   </div>
                </div>

                <div className="flex flex-col gap-3">
                   <button
                      disabled={loading}
                      onClick={handleGenerate}
                      className="w-full py-3.5 px-4 bg-blue-600 disabled:bg-opacity-70 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-bold text-center flex items-center justify-center gap-2 cursor-pointer"
                   >
                      {loading ? (
                         <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                         <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate AI Quiz</>
                      )}
                   </button>
                   {error && <p className="text-xs text-red-600 font-semibold text-center">{error}</p>}
                </div>
             </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
