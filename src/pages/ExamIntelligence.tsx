import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { 
  BarChart3, 
  PieChart, 
  Activity, 
  Info,
  Calendar,
  AlertCircle,
  TrendingUp,
  History,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type Subject = 'SFT' | 'ET' | 'ICT';

export default function ExamIntelligence() {
  const { user } = useApp();
  const [activeSubject, setActiveSubject] = useState<Subject>('SFT');
  const [activeTab, setActiveTab] = useState<'Pattern' | '2026 Prediction' | 'Unasked Topics'>('Pattern');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [probability, setProbability] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      
      const [reportRes, probRes] = await Promise.all([
        fetch(`/api/exam-intel/report?subject=${activeSubject}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`/api/exam-intel/probability?subject=${activeSubject}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      const reportData = await reportRes.json();
      const probData = await probRes.json();
      
      setReport(reportData);
      setProbability(probData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSubject]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-indigo-600" />
            Exam Intelligence
          </h1>
          <p className="text-gray-500 mt-1">Evidence-based pattern analysis & probabilistic ranking</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl">
          {(['SFT', 'ET', 'ICT'] as Subject[]).map(sub => (
            <button
              key={sub}
              onClick={() => setActiveSubject(sub)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                activeSubject === sub ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {sub}
            </button>
          ))}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-8">
        {(['Pattern', '2026 Prediction', 'Unasked Topics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative",
              activeTab === tab ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'Pattern' && (
            <motion.div
              key="pattern"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Pattern View */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    Lesson Frequency (10-Year Trend)
                  </h3>
                  <div className="space-y-4">
                    {(report?.lessonFrequencyTable || []).map((item: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700 truncate max-w-[200px]">{item.lesson}</span>
                          <span className="text-gray-400">{item.count} Questions</span>
                        </div>
                        <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full" 
                            style={{ width: `${(item.count / 50) * 100}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-400">
                      <TrendingUp className="w-4 h-4" />
                      Repeated Concepts
                    </h3>
                    <div className="space-y-3">
                      {(report?.repeatedConcepts || []).map((c: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <Activity className="w-3 h-3 text-emerald-500" />
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-400">
                      <AlertCircle className="w-4 h-4" />
                      Recent Changes
                    </h3>
                    <div className="space-y-3">
                      {(report?.trendChangesLastFiveYears || []).map((c: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-indigo-50 p-2 rounded-lg">
                          <Info className="w-3 h-3 text-indigo-500" />
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
                  <h3 className="text-indigo-100 font-bold text-sm uppercase tracking-wider mb-4">Intelligence Stats</h3>
                  <div className="space-y-6">
                    <div>
                      <span className="text-4xl font-bold">{report?.yearsAnalyzed?.length || 0}</span>
                      <p className="text-indigo-200 text-sm mt-1">Years Indexed</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-indigo-500">
                      <div>
                        <span className="text-xl font-bold">150+</span>
                        <p className="text-indigo-200 text-xs">MCQs</p>
                      </div>
                      <div>
                        <span className="text-xl font-bold">40+</span>
                        <p className="text-indigo-200 text-xs">Essays</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === '2026 Prediction' && (
            <motion.div
              key="prediction"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {probability.map((item, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className={cn(
                      "absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest",
                      item.probability === 'Very High' ? "bg-red-500 text-white" :
                      item.probability === 'High' ? "bg-amber-500 text-white" :
                      "bg-emerald-500 text-white"
                    )}>
                      {item.probability}
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 font-bold text-gray-400">
                        #{i + 1}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{item.lesson}</span>
                          <span className="text-[10px] text-gray-400">• Confidence {(item.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 leading-tight">{item.topic}</h4>
                        <div className="pt-4 space-y-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Evidence citations</span>
                          {item.evidence.map((ev: any, j: number) => (
                            <div key={j} className="text-xs text-gray-500 flex items-start gap-2 bg-gray-50 p-2 rounded-lg">
                              <Calendar className="w-3 h-3 mt-0.5 shrink-0" />
                              <span>{ev.year} {ev.question}: {ev.reason}</span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-4 flex items-center justify-between">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1",
                            item.studentPriority === 'Must study today' ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
                          )}>
                            {item.studentPriority === 'Must study today' && <Sparkles className="w-3 h-3" />}
                            {item.studentPriority}
                          </div>
                          <span className="text-[10px] text-gray-400 italic">Risk: {item.riskIfSkipped}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'Unasked Topics' && (
            <motion.div
              key="unasked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm"
            >
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Rarely Seen Topics</h3>
                  <p className="text-gray-500 mt-2">These concepts exist in the syllabus but have appeared infrequently or not at all in recent years.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Never Asked</h4>
                    <div className="space-y-2">
                      {(report?.notAskedRecently || []).slice(0, 5).map((t: string, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <span className="text-sm font-medium text-gray-700">{t}</span>
                          <span className="text-[10px] font-bold text-gray-400">0 APPEARANCES</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Rarely Asked</h4>
                    <div className="space-y-2">
                      {(report?.rareConcepts || []).slice(0, 5).map((t: string, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <span className="text-sm font-medium text-gray-700">{t}</span>
                          <span className="text-[10px] font-bold text-amber-500">RARE</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Safety Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 flex gap-4 items-start">
        <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-bold text-gray-700">Intelligence Safety Notice</p>
          <p>The probabilities shown are evidence-based models derived from syllabus weight, recency, and rotation patterns. They are NOT exact predictions of the 2026 paper. Use this as a priority guide for your revision strategy, not as a replacement for studying the full syllabus.</p>
        </div>
      </div>
    </div>
  );
}
