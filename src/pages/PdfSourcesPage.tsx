import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import {
  AlertCircle,
  Book,
  Calendar,
  CheckCircle2,
  Database,
  Eye,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  ScanText,
  Search,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { runWithConcurrency } from '../lib/bulkActionQueue';

interface Source {
  id: string;
  title: string;
  subject: string;
  year: string;
  resourceType: string;
  paperType: string;
  indexStatus: string;
  chunkCount: number;
  needsOcr: boolean;
  ocrStatus?: string;
  createdAt: string;
  updatedAt: string;
  storagePath: string;
}

type SourceAction = 'reindex' | 'ocr' | 'delete';
type BulkAction = 'repair' | 'reindex' | 'ocr';

type BulkState = {
  action: BulkAction;
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
} | null;

export default function PdfSourcesPage() {
  const { user, showNotification } = useApp();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [bulkState, setBulkState] = useState<BulkState>(null);
  const navigate = useNavigate();

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/pdf/sources');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Sources could not be loaded.');
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (error: any) {
      showNotification(error?.message || 'Sources could not be loaded.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources, user?.uid]);

  const performSourceAction = useCallback(async (source: Source, action: SourceAction) => {
    const deleting = action === 'delete';
    const endpoint = deleting ? `/api/rag/sources/${source.id}` : '/api/rag/reindex-uploaded';
    const response = await apiFetch(endpoint, {
      method: deleting ? 'DELETE' : 'POST',
      headers: deleting ? undefined : { 'Content-Type': 'application/json' },
      body: deleting ? undefined : JSON.stringify({ sourceId: source.id, mode: action === 'ocr' ? 'ocr' : 'auto' }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || data?.error || `${action} failed for ${source.title}.`);
    }
    if (action === 'ocr' && data?.ocrUnavailable) {
      throw new Error(`OCR is not configured for ${source.title}.`);
    }
    return data;
  }, []);

  const handleAction = async (source: Source, action: SourceAction) => {
    if (action === 'delete' && !window.confirm(`Delete “${source.title}” and its index?`)) return;
    const actionKey = `${source.id}_${action}`;
    setActionLoading((current) => new Set(current).add(actionKey));
    try {
      const data = await performSourceAction(source, action);
      showNotification(data?.message || `${action === 'ocr' ? 'OCR' : action === 'reindex' ? 'Re-index' : 'Delete'} completed.`, 'success');
      await fetchSources();
    } catch (error: any) {
      showNotification(error?.message || 'Action failed.', 'error');
    } finally {
      setActionLoading((current) => {
        const next = new Set(current);
        next.delete(actionKey);
        return next;
      });
    }
  };

  const handleBulkAction = async (action: BulkAction, onlyNeedsOcr = false) => {
    if (bulkState) return;
    const eligible = sources.filter((source) => Boolean(source.storagePath) && (!onlyNeedsOcr || source.needsOcr));
    if (eligible.length === 0) {
      showNotification(onlyNeedsOcr ? 'No PDFs currently require OCR.' : 'No stored PDFs are available.', 'info');
      return;
    }
    const label = action === 'repair' ? 'repair' : action === 'ocr' ? 'run OCR on' : 're-index';
    if (!window.confirm(`${label[0].toUpperCase()}${label.slice(1)} ${eligible.length} PDF${eligible.length === 1 ? '' : 's'}?`)) return;

    setBulkState({ action, completed: 0, total: eligible.length, succeeded: 0, failed: 0 });
    const results = await runWithConcurrency({
      items: eligible,
      concurrency: 2,
      worker: async (source) => {
        const sourceAction: SourceAction = action === 'repair'
          ? (source.needsOcr ? 'ocr' : 'reindex')
          : action;
        const actionKey = `${source.id}_${sourceAction}`;
        setActionLoading((current) => new Set(current).add(actionKey));
        try {
          await performSourceAction(source, sourceAction);
        } finally {
          setActionLoading((current) => {
            const next = new Set(current);
            next.delete(actionKey);
            return next;
          });
        }
      },
      onProgress: (completed, total, result) => {
        setBulkState((current) => current ? {
          ...current,
          completed,
          total,
          succeeded: current.succeeded + (result.ok ? 1 : 0),
          failed: current.failed + (result.ok ? 0 : 1),
        } : current);
      },
    });

    const failed = results.filter((result) => !result.ok);
    await fetchSources();
    setBulkState(null);
    if (failed.length === 0) {
      showNotification(`All ${eligible.length} PDFs completed successfully.`, 'success');
    } else {
      showNotification(`${eligible.length - failed.length} completed; ${failed.length} failed. Open the affected PDF cards and retry.`, 'error');
    }
  };

  const filteredSources = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sources;
    return sources.filter((source) =>
      source.title?.toLowerCase().includes(term)
      || source.subject?.toLowerCase().includes(term)
      || String(source.year || '').includes(term)
    );
  }, [searchTerm, sources]);

  const bulkPercent = bulkState && bulkState.total > 0 ? Math.round((bulkState.completed / bulkState.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">PDF Intelligence</h1>
          <p className="mt-1 font-medium text-slate-500">Upload, inspect, re-index, OCR, and repair every saved PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleBulkAction('repair')} disabled={Boolean(bulkState) || sources.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-black disabled:opacity-40">
            <Wrench className="h-4 w-4" /> Repair all
          </button>
          <button type="button" onClick={() => void handleBulkAction('reindex')} disabled={Boolean(bulkState) || sources.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
            <RefreshCw className="h-4 w-4" /> Re-index all
          </button>
          <button type="button" onClick={() => void handleBulkAction('ocr', true)} disabled={Boolean(bulkState) || sources.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-40">
            <ScanText className="h-4 w-4" /> OCR required
          </button>
          <button type="button" onClick={() => void handleBulkAction('ocr')} disabled={Boolean(bulkState) || sources.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-40">
            <FileSearch className="h-4 w-4" /> OCR all
          </button>
        </div>
      </div>

      {bulkState && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-700" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{bulkState.action === 'repair' ? 'Repairing' : bulkState.action === 'ocr' ? 'Running OCR' : 'Re-indexing'} all PDFs</p>
                <p className="text-xs text-slate-500">{bulkState.completed} of {bulkState.total} complete · {bulkState.succeeded} succeeded · {bulkState.failed} failed</p>
              </div>
            </div>
            <span className="text-sm font-black tabular-nums text-slate-900">{bulkPercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900 transition-[width] duration-300" style={{ width: `${bulkPercent}%` }} />
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search papers..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
      </div>

      <div>
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300"><FileText className="h-8 w-8" /></div>
            <p className="font-medium text-slate-500">No PDF sources found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSources.map((source) => {
              const isBusy = Array.from(actionLoading).some((key) => key.startsWith(`${source.id}_`));
              return (
                <motion.div key={source.id} layout className="flex flex-col gap-4 rounded-2xl border border-slate-200 border-l-4 border-l-indigo-500 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                  <div className="space-y-2">
                    <h3 className="font-bold leading-tight text-slate-900">{source.title || source.id}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600"><Book className="h-3 w-3" /> {source.subject || 'General'}</span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600"><Calendar className="h-3 w-3" /> {source.year || '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-slate-400" /><span>{source.chunkCount || 0} chunks</span></div>
                    <div className="flex items-center gap-2"><RefreshCw className={cn('h-3.5 w-3.5 text-slate-400', ['processing', 'queued', 'running'].includes(source.indexStatus) && 'animate-spin')} /><span className="truncate">{source.indexStatus || 'not indexed'}</span></div>
                  </div>

                  {source.needsOcr ? (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"><AlertCircle className="h-4 w-4" /> OCR required</div>
                  ) : source.chunkCount > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Search index ready</div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600"><XCircle className="h-4 w-4" /> Not indexed</div>
                  )}

                  <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => navigate(`/question-cache?sourceId=${source.id}`)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100"><Eye className="h-3.5 w-3.5" /> Cache</button>
                    <button type="button" onClick={() => void handleAction(source, 'reindex')} disabled={isBusy || Boolean(bulkState)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-50 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40">
                      {actionLoading.has(`${source.id}_reindex`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-index
                    </button>
                    <button type="button" onClick={() => void handleAction(source, 'ocr')} disabled={isBusy || Boolean(bulkState)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-50 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-40">
                      {actionLoading.has(`${source.id}_ocr`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />} OCR
                    </button>
                    <button type="button" onClick={() => void handleAction(source, 'delete')} disabled={isBusy || Boolean(bulkState)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-50 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-40">
                      {actionLoading.has(`${source.id}_delete`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
