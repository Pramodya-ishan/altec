import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { 
  Zap, 
  Target, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  ChevronRight,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function A3WarRoom() {
  const { user, showNotification } = useApp();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      const res = await fetch('/api/student/diagnosis?subject=SFT', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      // For now we just check if a plan exists or needs generation
      setPlan(null); // Mock: start with no plan
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      const res = await fetch('/api/student/war-plan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          target: "A3",
          days: 30,
          dailyHours: 8,
          subjects: ["SFT", "ET", "ICT"],
          examDates: { sft: "2026-08-01", et: "2026-08-05", ict: "2026-08-10" }
        })
      });
      const data = await res.json();
      setPlan(data);
      showNotification("30-Day War Plan Generated!", "success");
    } catch (err) {
      showNotification("Failed to generate plan", "error");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Zap className="w-8 h-8 text-indigo-600 fill-indigo-600/10" />
            A3 War Room
          </h1>
          <p className="text-gray-500 mt-1">30-Day Intensive Recovery Engine</p>
        </div>
        
        {!plan && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {generating ? "Strategizing..." : "Generate 30-Day Strategy"}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </header>

      {!plan ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
            <Target className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No Active War Plan</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Generate a personalized 30-day strategy based on your current performance and target grade.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Stats & Risk */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Mission Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Target</span>
                  <span className="font-bold text-indigo-600">{plan.target}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Days Left</span>
                  <span className="font-bold text-gray-900">{plan.daysRemaining}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Risk Level</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold uppercase",
                    plan.currentRisk === 'High' ? "bg-red-50 text-red-600" :
                    plan.currentRisk === 'Medium' ? "bg-amber-50 text-amber-600" :
                    "bg-emerald-50 text-emerald-600"
                  )}>
                    {plan.currentRisk}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Mark Forecast
              </h3>
              <div className="space-y-4">
                {Object.entries(plan.realisticForecast || {}).map(([sub, score]: any) => (
                  <div key={sub} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="uppercase font-bold text-gray-700">{sub}</span>
                      <span className="text-indigo-600 font-bold">{score}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        className="h-full bg-indigo-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-red-50 rounded-2xl border border-red-100 p-6">
              <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Critical Warnings
              </h3>
              <ul className="space-y-2">
                {plan.warnings.map((w: string, i: number) => (
                  <li key={i} className="text-sm text-red-700 flex gap-2">
                    <span className="shrink-0">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Daily Plan */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Daily War Schedule
                </h3>
                <span className="text-xs text-gray-400 font-medium">3-DAY REPEAT CYCLE ACTIVE</span>
              </div>
              
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {plan.dailyPlan.map((day: any) => (
                  <div key={day.day} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex flex-col items-center justify-center shrink-0 border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase leading-none">Day</span>
                        <span className="text-xl font-bold text-indigo-700 leading-tight">{day.day}</span>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Morning
                          </span>
                          <p className="text-sm text-gray-700 font-medium">{day.morning}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Afternoon
                          </span>
                          <p className="text-sm text-gray-700 font-medium">{day.afternoon}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Night
                          </span>
                          <p className="text-sm text-gray-700 font-medium">{day.night}</p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0 hidden md:block">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Mock</span>
                        <span className="text-xs font-bold text-indigo-600">{day.mock}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Must-Do Lessons
                </h3>
                <div className="flex flex-wrap gap-2">
                  {plan.mustDoLessons.map((l: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                <h3 className="font-bold text-gray-400 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Low Yield (Skip if busy)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {plan.skipOrLowPriorityLessons.map((l: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-gray-50 text-gray-500 text-xs font-bold rounded-lg border border-gray-100">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
