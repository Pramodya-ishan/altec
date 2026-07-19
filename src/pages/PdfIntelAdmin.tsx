import React, { useCallback, useEffect, useState } from 'react';
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
import { apiFetch } from "../lib/api";

export default function PdfIntelAdmin() {
  const { user, showNotification, profile } = useApp();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [dataQuality, setDataQuality] = useState<any>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const [metricsResponse, qualityResponse] = await Promise.all([
        apiFetch('/api/ai/quality-metrics'),
        apiFetch('/api/ai/data-quality'),
      ]);
      const [metricsPayload, qualityPayload] = await Promise.all([
        metricsResponse.json().catch(() => null),
        qualityResponse.json().catch(() => null),
      ]);
      if (metricsResponse.ok && metricsPayload?.ok) setMetrics(metricsPayload);
      if (qualityResponse.ok && qualityPayload?.ok) setDataQuality(qualityPayload);
    } catch {
      // Metrics are operational telemetry and must not block the admin page.
    }
  }, []);

  useEffect(() => { void loadMetrics(); }, [loadMetrics]);

  const handleBuildIndex = async () => {
    if (!window.confirm("This will process all PDF sources and extract questions. It may take several minutes. Proceed?")) return;
    
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await apiFetch('/api/exam-intel/build-index', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResults(data.results || []);
      void loadMetrics();
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
          <button type="button"
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

          <button type="button"
            onClick={async () => {
              if(!window.confirm("Run Data Repair Tool? This will clean up invalid DB references.")) return;
              setLoading(true);
              try {
                const token = await auth.currentUser?.getIdToken();
                const res = await apiFetch('/api/admin/repair-data', {
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
          
          <button type="button"
            onClick={handleBuildIndex}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
            {loading ? "Rebuilding Index..." : "Rebuild Exam Index"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Recent answers</span>
            <Search className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics?.answerCount ?? '—'}</p>
          <div className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
            <Zap className="w-3 h-3" /> {metrics?.completionRate ?? 0}% complete
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Quality pass</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics?.qualityPassRate ?? 0}%</p>
          <div className="text-[10px] font-bold text-indigo-600 uppercase">{metrics?.qualityRepairRate ?? 0}% auto-repaired</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">PDF previews</span>
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-emerald-600">{metrics?.previewSuccessRate ?? 0}%</p>
          <div className="text-[10px] font-bold text-gray-400 uppercase">{metrics?.previewFallbackCount ?? 0} safe fallbacks</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-400"><span className="text-xs font-bold uppercase tracking-wider">P95 answer time</span><Cpu className="w-4 h-4" /></div>
          <p className="text-3xl font-bold text-gray-900">{metrics ? `${Math.round((metrics.p95AnswerLatencyMs || 0) / 1000)}s` : '—'}</p>
          <div className="text-[10px] font-bold text-gray-400 uppercase">Pro verify + repair pipeline</div>
        </div>
      </div>

      {dataQuality && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="data-quality-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="data-quality-title" className="font-bold text-gray-900">PDF data quality</h2>
              <p className="mt-1 text-xs text-gray-500">{dataQuality.healthySources} of {dataQuality.totalSources} sources pass current evidence checks.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{dataQuality.issues?.length || 0} need attention</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {['needs_ocr', 'low_confidence_text', 'missing_metadata', 'duplicate', 'visual_review', 'not_indexed'].map((issue) => (
              <div key={issue} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xl font-black text-slate-900">{dataQuality.counts?.[issue] || 0}</p>
                <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-wide text-slate-500">{issue.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Recent Indexing Results</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((res) => (
              <div key={`${res.sourceId || res.id || "source"}-${res.count ?? res.error ?? "result"}`} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
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
          <p>[SYSTEM] Exam Intelligence Engine v23 Initialized</p>
          <p>[AUTH] Admin login verified: {user?.email || "Admin"}</p>
          <p>[STORAGE] Connected to al-ai-chat.firebasestorage.app</p>
          <p>[DB] Firestore ready. Collections: exam_question_index, syllabus_nodes</p>
          <p>[AI] Planner → Solver → Quality Verifier → Final Writer enabled</p>
          <p>[QUALITY] completion={metrics?.completionRate ?? 0}% pass={metrics?.qualityPassRate ?? 0}% repaired={metrics?.qualityRepairRate ?? 0}%</p>
          {(metrics?.recentFailures || []).slice(0, 5).map((failure: any) => <p key={`${failure.id}-${failure.endedAt}`} className="text-amber-300">[{failure.kind}] {failure.code || 'FAILED'} · {failure.durationMs}ms</p>)}
          <p className="text-indigo-400">Monitoring live answer and PDF telemetry...</p>
        </div>
      </div>
    </div>
  );
}
