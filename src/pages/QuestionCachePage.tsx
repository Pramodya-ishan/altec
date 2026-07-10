import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search, 
  ArrowLeft,
  Loader2,
  Trash2,
  MessageSquare,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface CachedQuestion {
  id: string;
  sourceId: string;
  year: string;
  subject: string;
  questionType: string;
  questionNo: number;
  questionText: string;
  options: string[];
  officialAnswer?: string;
  solvedAnswer?: {
    answer: string;
    explanation: string;
  };
  verifiedAnswer?: string;
  status: 'pending' | 'verified' | 'rejected' | 'solved';
  createdAt: string;
}

export default function QuestionCachePage() {
  const { user, showNotification } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sourceIdFilter = searchParams.get('sourceId');

  const [items, setItems] = useState<CachedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCache = async () => {
    setLoading(true);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      let url = '/api/pdf/question-cache';
      if (sourceIdFilter) url += `?sourceId=${sourceIdFilter}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
      }
    } catch (err) {
      showNotification("Failed to fetch cache", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCache();
  }, [user, sourceIdFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(`${id}_${status}`);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/pdf/question-cache/${id}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.ok) {
        showNotification(`Updated to ${status}`, "success");
        setItems(prev => prev.map(item => item.id === id ? { ...item, status: status as any } : item));
      }
    } catch (err) {
      showNotification("Failed to update status", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (id: string) => {
    setActionLoading(`${id}_resolve`);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/pdf/question-cache/${id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        showNotification("Question re-solved successfully", "success");
        fetchCache();
      }
    } catch (err) {
      showNotification("Failed to resolve", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredItems = items.filter(item => 
    item.questionText?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.year?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <History className="w-8 h-8 text-indigo-500" />
              Question Cache
            </h1>
            <p className="text-slate-500 font-medium">Review and verify AI-extracted exam evidence.</p>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl w-full md:w-80 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))
        ) : filteredItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-slate-500 font-medium">No cached questions found.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 font-bold text-lg">
                    {item.questionNo}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">
                      {item.subject} {item.year} - {item.questionType.toUpperCase()}
                    </h3>
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mt-1 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      ID: {item.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    item.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                    item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    item.status === 'solved' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {item.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-800 leading-relaxed font-medium">
                {item.questionText}
              </div>

              {item.options && item.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {item.options.map((opt, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-slate-100 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                      <span className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-900">AI Solve Result:</span>
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    {item.solvedAnswer ? (
                      <div className="space-y-1">
                        <p className="font-bold text-indigo-600">Answer: {item.solvedAnswer.answer}</p>
                        <p className="italic">"{item.solvedAnswer.explanation}"</p>
                      </div>
                    ) : (
                      <p className="text-slate-400">Not solved by AI yet.</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                  <button 
                    onClick={() => handleStatusChange(item.id, 'verified')}
                    disabled={!!actionLoading}
                    className="h-9 px-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {actionLoading === `${item.id}_verified` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Verify
                  </button>
                  <button 
                    onClick={() => handleResolve(item.id)}
                    disabled={!!actionLoading}
                    className="h-9 px-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {actionLoading === `${item.id}_resolve` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Re-solve
                  </button>
                  <button 
                    onClick={() => handleStatusChange(item.id, 'rejected')}
                    disabled={!!actionLoading}
                    className="h-9 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {actionLoading === `${item.id}_rejected` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Reject
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
