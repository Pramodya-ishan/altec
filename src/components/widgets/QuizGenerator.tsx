import { apiFetch } from "../../lib/api";
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { useApp } from '../../context/AppContext';

interface QuizGeneratorProps {
  currentSubject: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QuizGenerator({ currentSubject, isOpen, onClose }: QuizGeneratorProps) {
  const { data } = useApp();
  const [activeTab, setActiveTab] = useState<'quiz' | 'notebook'>('quiz');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizResults, setQuizResults] = useState<any[]>([]);
  
  // Chat states
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  
  const handleGenerateQuiz = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: currentSubject,
          topic: "mixed revision"
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate (${response.status})`);
      }
      const data = await response.json();
      setQuizResults(data.quiz || data.quizObject?.questions || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = { role: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const payload = {
        prompt: chatInput,
        activeSubject: currentSubject,
        history: messages.slice(-10),
        mode: "auto"
      };

      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resData = await res.json().catch(() => ({}));

      if (res.ok && (resData.text || resData.response)) {
         setMessages(prev => [...prev, { role: 'assistant', text: (resData.text || resData.response) }]);
      } else {
         throw new Error(resData.error || resData.message || "Failed to process request");
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally {
      setChatLoading(false);
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
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        ></motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col z-10 overflow-hidden h-[85vh]"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                <i className="fa-solid fa-book-open-reader text-lg"></i>
              </div>
              <div>
                 <h2 className="text-lg font-display font-extrabold text-slate-900 leading-none">Study Companion</h2>
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{currentSubject.toUpperCase()}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setQuizResults([]);
                onClose();
              }}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50 shrink-0 px-2">
            <button 
              onClick={() => setActiveTab('quiz')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${activeTab === 'quiz' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
            >
              <i className="fa-solid fa-spell-check"></i> AI Quiz Generator
            </button>
            <button 
              onClick={() => setActiveTab('notebook')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${activeTab === 'notebook' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
            >
              <i className="fa-solid fa-robot"></i> Notebook LM Chat
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative bg-white">
            {activeTab === 'quiz' && (
              <div className="h-full flex flex-col p-6 overflow-y-auto">
                {quizResults.length > 0 ? (
                  <div className="space-y-6">
                    {quizResults.map((q, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 p-5 rounded-xl shadow-sm">
                        <p className="font-bold text-slate-800 text-sm mb-4 leading-relaxed">
                           <span className="text-blue-600 mr-2 text-lg">Q{idx + 1}.</span> {q.question}
                        </p>
                        <div className="space-y-2">
                           {q.options?.map((opt: string, oidx: number) => (
                              <div key={oidx} className={`p-3 rounded-lg text-sm font-medium border transition-colors ${oidx === q.correctIndex ? 'border-green-300 bg-green-50 text-green-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                                {opt}
                                {oidx === q.correctIndex && <i className="fa-solid fa-check ml-2 float-right text-green-500 mt-1"></i>}
                              </div>
                           ))}
                        </div>
                        {q.explanation && (
                           <p className="mt-4 text-xs text-slate-600 font-semibold bg-white p-3 rounded-lg border border-slate-100 shadow-inner flex gap-2 items-start">
                              <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5 text-base"></i> 
                              <span className="leading-relaxed">{q.explanation}</span>
                           </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                   <div className="h-full flex flex-col justify-center max-w-md mx-auto">
                      <div className="space-y-4 mb-8 text-center">
                         <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner">
                            <i className="fa-solid fa-brain"></i>
                         </div>
                         <h3 className="text-xl font-bold text-slate-800">Test Your Knowledge</h3>
                         <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
                            Generate targeted study quizzes powered by AI. We'll analyze your current subject and create a custom assessment.
                         </p>
                      </div>
                      <div className="flex flex-col gap-3 mt-4">
                         <button
                            disabled={loading}
                            onClick={handleGenerateQuiz}
                            className="w-full py-4 px-4 bg-blue-600 disabled:bg-opacity-70 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all font-bold text-center flex items-center justify-center gap-2"
                         >
                            {loading ? (
                               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                               <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate AI Quiz</>
                            )}
                         </button>
                         {error && <p className="text-xs text-red-600 font-semibold text-center mt-2 bg-red-50 p-2 rounded-lg">{error}</p>}
                      </div>
                   </div>
                )}
              </div>
            )}

            {activeTab === 'notebook' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={chatScrollRef}>
                  {messages.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4 text-2xl">
                          <i className="fa-solid fa-comments"></i>
                        </div>
                        <h3 className="text-base font-bold text-slate-700 mb-2">NotebookLM Chat</h3>
                        <p className="text-sm text-slate-500">Ask questions about your {currentSubject.toUpperCase()} notes, study materials, or general concepts. The AI will assist you using your current data context.</p>
                     </div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'}`}>
                           {m.role === 'user' ? (
                             <p>{m.text}</p>
                           ) : (
                             <div className="prose prose-sm prose-slate max-w-none markdown-body text-[13px] leading-relaxed">
                               <Markdown>{m.text}</Markdown>
                             </div>
                           )}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-sm p-4 text-sm border border-slate-200 flex items-center gap-2">
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                         <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                  <div className="flex gap-2 relative">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                      placeholder="Ask about your syllabus or notes..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                      disabled={chatLoading}
                    />
                    <button 
                      onClick={handleSendChat}
                      disabled={chatLoading || !chatInput.trim()}
                      className="w-12 h-12 bg-blue-600 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
