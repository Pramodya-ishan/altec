import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, Brain, CheckCircle2, Clock3, ImageIcon, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "../lib/api";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";

type MistakeRecord = {
  id: string;
  subject?: string;
  lesson?: string;
  errorText?: string;
  questionText?: string;
  imageUrl?: string | null;
  imageEndpoint?: string | null;
  hasImage?: boolean;
  imageFileName?: string | null;
  createdAt?: string;
  masteryScore?: number;
  correctStreak?: number;
  nextReviewAt?: string;
  mastered?: boolean;
  errorCategory?: string;
};

type ReviewSummary = { total: number; dueCount: number; masteredCount: number; averageMastery: number };

function summarizeMistakes(records: MistakeRecord[]): ReviewSummary {
  const now = Date.now();
  return {
    total: records.length,
    dueCount: records.filter((record) => {
      if (record.mastered === true && Number(record.masteryScore || 0) >= 95) return false;
      const reviewTime = Date.parse(String(record.nextReviewAt || ""));
      return !Number.isFinite(reviewTime) || reviewTime <= now;
    }).length,
    masteredCount: records.filter((record) => record.mastered === true).length,
    averageMastery: records.length > 0
      ? Math.round(records.reduce((total, record) => total + Number(record.masteryScore || 0), 0) / records.length)
      : 0,
  };
}

function SavedMistakeImage({ mistake }: { mistake: MistakeRecord }) {
  const { url, failed } = useAuthenticatedImage(mistake.imageEndpoint);
  if (failed) return <div className="grid h-32 place-items-center bg-slate-50 text-xs font-semibold text-slate-400">Saved image unavailable</div>;
  if (!url) return <Skeleton className="h-48 w-full rounded-none" />;
  return <img src={url} alt={mistake.imageFileName || `Saved ${mistake.lesson || "error"}`} className="max-h-72 w-full bg-slate-50 object-contain" loading="lazy" />;
}

export default function MistakeNotebook() {
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("All");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<ReviewSummary>({ total: 0, dueCount: 0, masteredCount: 0, averageMastery: 0 });
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadMistakes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/student/mistakes");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load your error log.");
      setMistakes(Array.isArray(payload.mistakes) ? payload.mistakes : []);
      if (payload.reviewSummary) setSummary(payload.reviewSummary);
    } catch (loadError: any) {
      setError(loadError?.message || "Could not load your error log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMistakes(); }, [loadMistakes]);

  const saveReview = useCallback(async (mistakeId: string, quality: number) => {
    setReviewingId(mistakeId);
    try {
      const response = await apiFetch(`/api/student/mistakes/${encodeURIComponent(mistakeId)}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Review result could not be saved.");
      const updatedMistakes = mistakes.map((mistake) => mistake.id === mistakeId ? { ...mistake, ...payload.review } : mistake);
      setMistakes(updatedMistakes);
      setSummary(summarizeMistakes(updatedMistakes));
    } catch (reviewError: any) {
      setError(reviewError?.message || "Review result could not be saved.");
    } finally {
      setReviewingId(null);
    }
  }, [mistakes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mistakes.filter((mistake) => {
      if (subject !== "All" && mistake.subject !== subject) return false;
      if (!term) return true;
      return `${mistake.lesson || ""} ${mistake.errorText || mistake.questionText || ""}`.toLowerCase().includes(term);
    });
  }, [mistakes, search, subject]);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 pb-12">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600"><BookOpen className="h-5 w-5" /></span>
            <div><h1 className="text-xl font-bold text-slate-950">Error log</h1><p className="text-sm text-slate-500">Your saved text and images for AI revision.</p></div>
          </div>
          <button type="button" onClick={() => void loadMistakes()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_150px]">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search errors" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lesson or error text" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" /></label>
          <select aria-label="Filter errors by subject" value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400">
            <option>All</option><option>SFT</option><option>ET</option><option>ICT</option>
          </select>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Saved</p><p className="mt-1 text-xl font-black text-slate-900">{summary.total}</p></div>
          <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Due now</p><p className="mt-1 text-xl font-black text-amber-900">{summary.dueCount}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Mastered</p><p className="mt-1 text-xl font-black text-emerald-900">{summary.masteredCount}</p></div>
          <div className="rounded-2xl bg-indigo-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Mastery</p><p className="mt-1 text-xl font-black text-indigo-900">{summary.averageMastery}%</p></div>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="rounded-3xl border border-slate-200 bg-white p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-16 w-full" /><Skeleton className="mt-4 h-40 w-full rounded-2xl" /></div>)}</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-white p-6 text-center"><AlertCircle className="mx-auto h-7 w-7 text-rose-500" /><p className="mt-3 text-sm font-semibold text-slate-800">{error}</p></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center"><BookOpen className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-3 font-bold text-slate-800">No saved errors found</h2><p className="mt-1 text-sm text-slate-500">Add text or an image from the AI tools menu.</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((mistake) => (
            <article key={mistake.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {mistake.hasImage && mistake.imageEndpoint ? <SavedMistakeImage mistake={mistake} /> : null}
              <div className="p-5">
                <div className="flex items-center gap-2"><span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">{mistake.subject || "Subject"}</span><span className="truncate text-xs font-semibold text-slate-500">{mistake.lesson || "Lesson"}</span>{mistake.hasImage ? <ImageIcon className="ml-auto h-4 w-4 text-slate-400" /> : null}</div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">{mistake.errorText || mistake.questionText || "Image-only error record"}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> Mastery</span><span>{Math.round(mistake.masteryScore || 0)}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-[width]" style={{ width: `${Math.max(2, Math.min(100, mistake.masteryScore || 0))}%` }} /></div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> streak {mistake.correctStreak || 0}</span>
                    {mistake.nextReviewAt ? <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(mistake.nextReviewAt).toLocaleDateString()}</span> : null}
                    {mistake.errorCategory ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{mistake.errorCategory}</span> : null}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" disabled={reviewingId === mistake.id} onClick={() => void saveReview(mistake.id, 2)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">Need practice</button>
                  <button type="button" disabled={reviewingId === mistake.id} onClick={() => void saveReview(mistake.id, 5)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Got it</button>
                </div>
                {mistake.createdAt ? <time className="mt-4 block text-[11px] text-slate-400">{new Date(mistake.createdAt).toLocaleString()}</time> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
