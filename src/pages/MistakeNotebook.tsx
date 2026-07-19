import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, ImageIcon, RefreshCw, Search } from "lucide-react";
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
};

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

  const loadMistakes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/student/mistakes");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load your error log.");
      setMistakes(Array.isArray(payload.mistakes) ? payload.mistakes : []);
    } catch (loadError: any) {
      setError(loadError?.message || "Could not load your error log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMistakes(); }, [loadMistakes]);

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
                {mistake.createdAt ? <time className="mt-4 block text-[11px] text-slate-400">{new Date(mistake.createdAt).toLocaleString()}</time> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
