import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Brain,
  Check,
  CircleAlert,
  Clock3,
  ImageIcon,
  ImagePlus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { setPendingStudyPrompt } from "../lib/navigationIntent";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuthenticatedImage } from "../hooks/useAuthenticatedImage";
import { ErrorLogModal } from "../components/modals/ErrorLogModal";
import { cn } from "../lib/utils";

type MistakeRecord = {
  id: string;
  subject?: string;
  lesson?: string;
  errorText?: string;
  questionText?: string;
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
    averageMastery: records.length
      ? Math.round(records.reduce((total, record) => total + Number(record.masteryScore || 0), 0) / records.length)
      : 0,
  };
}

function isDue(record: MistakeRecord) {
  if (record.mastered) return false;
  const time = Date.parse(String(record.nextReviewAt || ""));
  return !Number.isFinite(time) || time <= Date.now();
}

function SavedMistakeImage({ mistake }: { mistake: MistakeRecord }) {
  const { url, failed } = useAuthenticatedImage(mistake.imageEndpoint);
  if (failed) {
    return (
      <div className="error-card__image-state">
        <ImageIcon className="h-5 w-5" />
        <span>Saved image unavailable</span>
      </div>
    );
  }
  if (!url) return <Skeleton className="h-52 w-full rounded-none" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="error-card__image-link" aria-label={`Open saved image for ${mistake.lesson || "error"}`}>
      <img src={url} alt={mistake.imageFileName || `Saved ${mistake.lesson || "error"}`} loading="lazy" />
      <span><ImageIcon className="h-4 w-4" /> Open image</span>
    </a>
  );
}

const metricDefinitions = [
  { key: "total", label: "Saved records", icon: BookOpenCheck, tone: "blue", suffix: "" },
  { key: "dueCount", label: "Ready to review", icon: Clock3, tone: "amber", suffix: "" },
  { key: "masteredCount", label: "Mastered", icon: Check, tone: "green", suffix: "" },
  { key: "averageMastery", label: "Average mastery", icon: Target, tone: "ink", suffix: "%" },
] as const;

export default function MistakeNotebook() {
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("All");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<ReviewSummary>({ total: 0, dueCount: 0, masteredCount: 0, averageMastery: 0 });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showAddError, setShowAddError] = useState(false);

  const loadMistakes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/student/mistakes");
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load your error log.");
      const records = Array.isArray(payload.mistakes) ? payload.mistakes : [];
      setMistakes(records);
      setSummary(payload.reviewSummary || summarizeMistakes(records));
    } catch (loadError: any) {
      setError(loadError?.message || "Could not load your error log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMistakes(); }, [loadMistakes]);

  const saveReview = useCallback(async (mistakeId: string, quality: number) => {
    setReviewingId(mistakeId);
    setError("");
    try {
      const response = await apiFetch(`/api/student/mistakes/${encodeURIComponent(mistakeId)}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Review result could not be saved.");
      const updated = mistakes.map((mistake) => mistake.id === mistakeId ? { ...mistake, ...payload.review } : mistake);
      setMistakes(updated);
      setSummary(summarizeMistakes(updated));
    } catch (reviewError: any) {
      setError(reviewError?.message || "Review result could not be saved.");
    } finally {
      setReviewingId(null);
    }
  }, [mistakes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mistakes.filter((mistake) => {
      if (subject !== "All" && String(mistake.subject || "").toUpperCase() !== subject) return false;
      if (!term) return true;
      return `${mistake.lesson || ""} ${mistake.errorText || mistake.questionText || ""}`.toLowerCase().includes(term);
    });
  }, [mistakes, search, subject]);

  const discussMistake = (mistake: MistakeRecord) => {
    setPendingStudyPrompt(
      `Review my Error Log record ${mistake.id}. Subject ${mistake.subject || "unknown"}, lesson ${mistake.lesson || "unknown"}. Read its saved image if present and explain the exact question, my likely error, the correct method, checked answer, and one similar practice question.`,
    );
    navigate("/clora-x");
  };

  return (
    <>
      <section className="error-log-page">
        <header className="error-log-hero" data-reveal>
          <div className="error-log-hero__copy">
            <p className="product-eyebrow">Revision memory</p>
            <h2>Turn every mistake into progress.</h2>
            <p>Save the question, keep its image, and schedule the next review from one focused workspace.</p>
          </div>
          <div className="error-log-hero__actions">
            <button type="button" onClick={() => setShowAddError(true)} className="premium-button">
              <ImagePlus className="h-4 w-4" /> Add error
            </button>
            <button type="button" onClick={() => void loadMistakes()} disabled={loading} className="premium-button premium-button--secondary">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </button>
          </div>
        </header>

        <div className="error-log-metrics" data-reveal>
          {metricDefinitions.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.key} className={`error-metric error-metric--${metric.tone}`}>
                <span className="error-metric__icon"><Icon className="h-5 w-5" /></span>
                <span><small>{metric.label}</small><strong>{summary[metric.key]}{metric.suffix || ""}</strong></span>
              </article>
            );
          })}
        </div>

        <section className="error-log-toolbar" data-reveal aria-label="Error log filters">
          <label className="product-search">
            <Search className="h-4 w-4" />
            <input aria-label="Search errors" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a lesson or saved note" />
          </label>
          <label className="product-select">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="sr-only">Subject</span>
            <select aria-label="Filter errors by subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="All">All subjects</option>
              <option value="SFT">SFT</option>
              <option value="ET">ET</option>
              <option value="ICT">ICT</option>
            </select>
          </label>
          <span className="error-log-toolbar__count">{filtered.length} shown</span>
        </section>

        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle className="h-5 w-5" /><span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="error-card-grid">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-[390px] rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <section className="product-empty" data-reveal>
            <CircleAlert className="h-8 w-8" />
            <h3>{mistakes.length ? "No records match these filters" : "Your Error Log is ready"}</h3>
            <p>{mistakes.length ? "Try another subject or search phrase." : "Save a question image or note to begin a focused revision cycle."}</p>
            {!mistakes.length && <button type="button" onClick={() => setShowAddError(true)} className="premium-button"><ImagePlus className="h-4 w-4" /> Add first error</button>}
          </section>
        ) : (
          <div className="error-card-grid">
            {filtered.map((mistake) => {
              const due = isDue(mistake);
              const mastery = Math.round(mistake.masteryScore || 0);
              return (
                <article key={mistake.id} className="error-card" data-reveal>
                  {mistake.hasImage && mistake.imageEndpoint ? <SavedMistakeImage mistake={mistake} /> : (
                    <div className="error-card__no-image"><BookOpenCheck className="h-6 w-6" /><span>Text record</span></div>
                  )}
                  <div className="error-card__body">
                    <div className="error-card__meta">
                      <span className="subject-badge">{mistake.subject || "Subject"}</span>
                      <span className={cn("review-badge", due ? "is-due" : "is-scheduled")}>{due ? "Review now" : "Scheduled"}</span>
                    </div>
                    <h3>{mistake.lesson || "Lesson not specified"}</h3>
                    <p className="error-card__note">{mistake.errorText || mistake.questionText || "Image-only saved mistake"}</p>

                    <div className="mastery-row">
                      <span><Brain className="h-4 w-4" /> Mastery</span><strong>{mastery}%</strong>
                    </div>
                    <div className="mastery-track"><span style={{ width: `${Math.max(2, Math.min(100, mastery))}%` }} /></div>
                    <div className="error-card__facts">
                      <span><Check className="h-3.5 w-3.5" /> Streak {mistake.correctStreak || 0}</span>
                      {mistake.nextReviewAt && <span><Clock3 className="h-3.5 w-3.5" /> {new Date(mistake.nextReviewAt).toLocaleDateString()}</span>}
                      {mistake.errorCategory && <span>{mistake.errorCategory}</span>}
                    </div>

                    <button type="button" onClick={() => discussMistake(mistake)} className="review-record-button">
                      Review at Study Desk <ArrowRight className="h-4 w-4" />
                    </button>
                    <div className="review-outcome">
                      <button type="button" disabled={reviewingId === mistake.id} onClick={() => void saveReview(mistake.id, 2)}>Need practice</button>
                      <button type="button" disabled={reviewingId === mistake.id} onClick={() => void saveReview(mistake.id, 5)}>Understood</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <ErrorLogModal isOpen={showAddError} onClose={() => setShowAddError(false)} onLogged={loadMistakes} />
    </>
  );
}
