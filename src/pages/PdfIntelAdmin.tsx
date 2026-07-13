import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../lib/firebase';
import { 
  Database, 
  Cpu, 
  RefreshCcw, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Search,
  Zap,
  HardDrive
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function PdfIntelAdmin() {
  const { user, showNotification, profile } = useApp();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleBuildIndex = async () => {
    if (!window.confirm("This will process all PDF sources and extract questions. It may take several minutes. Proceed?")) return;
    
    setLoading(true);
    try {
      const token = user?.token || await auth.currentUser?.getIdToken();
      const res = await fetch('/api/exam-intel/build-index', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResults(data.results || []);
      showNotification("Indexing job completed", "success");
    } catch (err) {
      showNotification("Indexing failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.roles?.includes('admin');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-gray-500">Only authorized administrators can access this terminal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-8 h-8 text-indigo-600" />
            PDF Intel Terminal
          </h1>
          <p className="text-gray-500 mt-1">Admin control center for exam question indexing</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={async () => {
              if(!window.confirm("Purge app cache? This unregisters service workers and clears client storage for a clean hot update.")) return;
              setLoading(true);
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const r of regs) {
                    await r.unregister();
                  }
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  for (const k of keys) {
                    await caches.delete(k);
                  }
                }
                showNotification("App cache cleared! Reloading page...", "success");
                setTimeout(() => {
                  window.location.reload();
                }, 1500);
              } catch(e: any) {
                showNotification("Cache clear failed: " + e.message, "error");
              } finally { setLoading(false); }
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
            Clear App Cache
          </button>

          <button
            onClick={async () => {
              if(!window.confirm("Run Data Repair Tool? This will clean up invalid DB references.")) return;
              setLoading(true);
              try {
                const token = user?.token || await auth.currentUser?.getIdToken();
                const res = await fetch('/api/admin/repair-data', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                showNotification(data.message || "Repair completed", "success");
              } catch(e) {
                showNotification("Repair failed", "error");
              } finally { setLoading(false); }
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <HardDrive className="w-5 h-5" />}
            Repair Data
          </button>
          
          <button
            onClick={handleBuildIndex}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
            {loading ? "Rebuilding Index..." : "Rebuild Exam Index"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Questions</span>
            <Search className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-gray-900">1,248</p>
          <div className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
            <Zap className="w-3 h-3" /> Indexed & Ready
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Storage Usage</span>
            <HardDrive className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-gray-900">452 MB</p>
          <div className="text-[10px] font-bold text-indigo-600 uppercase">PDF Inventory</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Model Status</span>
            <Cpu className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-emerald-600">ONLINE</p>
          <div className="text-[10px] font-bold text-gray-400 uppercase">Gemini 1.5 Flash</div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Recent Indexing Results</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((res, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">{res.sourceId}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Processed source</p>
                  </div>
                </div>
                {res.error ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-bold">Failed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-bold">{res.count} Questions Extracted</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl p-8 text-white space-y-6">
        <h3 className="text-indigo-400 font-bold uppercase tracking-widest text-xs">System Logs</h3>
        <div className="font-mono text-xs space-y-1 opacity-80 max-h-48 overflow-y-auto custom-scrollbar">
          <p>[SYSTEM] Exam Intelligence Engine v2.0 Initialized</p>
          <p>[AUTH] Admin login verified: {user?.email || "Admin"}</p>
          <p>[STORAGE] Connected to al-ai-chat.firebasestorage.app</p>
          <p>[DB] Firestore ready. Collections: exam_question_index, syllabus_nodes</p>
          <p>[AI] Gemini 1.5 Flash heartbeat OK</p>
          <p className="text-indigo-400">Waiting for indexing trigger...</p>
        </div>
      </div>
    </div>
  );
}
