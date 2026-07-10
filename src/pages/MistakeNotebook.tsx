import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Trash2, 
  RotateCcw, 
  CheckCircle,
  XCircle,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function MistakeNotebook() {
  const { user } = useApp();
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState<string>('All');

  const fetchMistakes = async () => {
    setLoading(true);
    try {
      if (!user?.email) return;
      const q = query(
        collection(db, "users", user.email, "mistake_notebook"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setMistakes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMistakes();
  }, [user]);

  const filteredMistakes = mistakes.filter(m => filterSubject === 'All' || m.subject === filterSubject);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-rose-600" />
            Mistake Notebook
          </h1>
          <p className="text-gray-500 mt-1">Automatic logging of errors for targeted revision</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search mistakes..." 
              className="pl-9 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none w-64"
            />
          </div>
          <select 
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none"
          >
            <option>All</option>
            <option>SFT</option>
            <option>ET</option>
            <option>ICT</option>
          </select>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
        </div>
      ) : filteredMistakes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No Mistakes Logged Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">Excellent work! Any errors you make in mock tests or practice sessions will appear here for you to master.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredMistakes.map((mistake) => (
            <motion.div
              layout
              key={mistake.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-rose-100 transition-all"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-bold uppercase",
                      mistake.subject === 'SFT' ? "bg-indigo-50 text-indigo-600" :
                      mistake.subject === 'ET' ? "bg-emerald-50 text-emerald-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      {mistake.subject}
                    </div>
                    <span className="text-xs font-medium text-gray-400">{mistake.lesson}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="shrink-0 pt-1">
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div className="space-y-4 flex-1">
                      <h4 className="text-gray-900 font-bold leading-tight">{mistake.questionText}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                          <span className="text-[10px] font-bold text-rose-400 uppercase block mb-1">Your Answer</span>
                          <div className="flex items-center gap-2 text-rose-700 font-medium">
                            <XCircle className="w-4 h-4" />
                            {mistake.userAnswer}
                          </div>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase block mb-1">Correct Answer</span>
                          <div className="flex items-center gap-2 text-emerald-700 font-medium">
                            <CheckCircle className="w-4 h-4" />
                            {mistake.correctAnswer}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">AI Explanation</span>
                        <p className="text-sm text-gray-600 leading-relaxed">{mistake.explanation}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Repeats:</span>
                      <span className="text-sm font-bold text-gray-700">{mistake.repeatCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Type:</span>
                      <span className="text-xs font-bold text-rose-600">{mistake.mistakeType}</span>
                    </div>
                  </div>
                  
                  <button className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700">
                    Master this topic <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
