import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  Download,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Printer,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { auth } from "../lib/firebase";
import { apiFetch } from "../lib/api";
import { cn } from "../lib/utils";

type Subject = "SFT" | "ET" | "ICT";
type Mode = "safe" | "balanced" | "surprise";
type PaperType = "Full Paper" | "MCQ" | "Structured" | "Essay";
type ResultTab = "paper" | "scheme" | "evidence" | "backtest";

async function authHeaders(json = false) {
  const token = await auth.currentUser?.getIdToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function responseData(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  return data;
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
  </div>;
}

export default function PredictionPapers() {
  const { profile, showNotification } = useApp();
  const isAdmin = profile?.role === "admin" || profile?.roles?.includes("admin");
  const [subject, setSubject] = useState<Subject>("SFT");
  const [targetYear, setTargetYear] = useState(2026);
  const [mode, setMode] = useState<Mode>("balanced");
  const [paperType, setPaperType] = useState<PaperType>("Full Paper");
  const [targetMarks, setTargetMarks] = useState(80);
  const [questionCount, setQuestionCount] = useState(20);
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeImages, setIncludeImages] = useState(true);
  const [maxImageQuestions, setMaxImageQuestions] = useState(4);
  const [committeeSize, setCommitteeSize] = useState(3);
  const [includeGuessingPapers, setIncludeGuessingPapers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [paper, setPaper] = useState<any>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any>(null);
  const [backtest, setBacktest] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [tab, setTab] = useState<ResultTab>("paper");
  const [error, setError] = useState("");

  const loadIntelligence = useCallback(async () => {
    setLoadingIntel(true);
    setError("");
    try {
      const headers = await authHeaders();
      const query = `subject=${subject}&targetYear=${targetYear}`;
      const [settingsResult, rankingResult, backtestResult, coverageResult] = await Promise.all([
        apiFetch(`/api/exam-intel/settings?subject=${subject}`, { headers }).then(responseData),
        apiFetch(`/api/exam-intel/probability?${query}`, { headers }).then(responseData),
        apiFetch(`/api/exam-intel/backtest?subject=${subject}`, { headers }).then(responseData),
        apiFetch(`/api/exam-intel/syllabus-coverage?subject=${subject}`, { headers }).then(responseData),
      ]);
      const saved = settingsResult.settings || {};
      setSettings(saved);
      setRankings(Array.isArray(rankingResult) ? rankingResult : []);
      setBacktest(backtestResult);
      setCoverage(coverageResult);
      setCommitteeSize(Number(saved.committeeSize || 3));
      setMaxImageQuestions(Number(saved.maxImageQuestions || (subject === "ET" ? 4 : 3)));
      setIncludeImages(saved.includeImages !== false);
      setIncludeGuessingPapers(saved.includeGuessingPapers === true);
    } catch (loadError: any) {
      setError(loadError?.message || "Prediction intelligence could not be loaded.");
    } finally {
      setLoadingIntel(false);
    }
  }, [subject, targetYear]);

  useEffect(() => { void loadIntelligence(); }, [loadIntelligence]);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/exam-intel/predicted-paper", {
        method: "POST",
        headers: await authHeaders(true),
        body: JSON.stringify({
          subject, targetYear, mode, paperType, targetMarks, questionCount,
          includeAnswers, includeImages, maxImageQuestions, committeeSize,
          settings: { includeGuessingPapers },
        }),
      });
      const result = await responseData(response);
      setPaper(result);
      setTab("paper");
      showNotification(`${subject} ${targetYear} revision forecast generated`, "success");
    } catch (generateError: any) {
      setError(generateError?.message || "Revision forecast could not be generated.");
      showNotification("Forecast generation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const saveAdminSettings = async () => {
    try {
      const response = await apiFetch("/api/exam-intel/settings", {
        method: "PATCH",
        headers: await authHeaders(true),
        body: JSON.stringify({
          subject,
          settings: { ...settings, targetYear, committeeSize, maxImageQuestions, includeImages, includeGuessingPapers },
        }),
      });
      const result = await responseData(response);
      setSettings(result.settings);
      showNotification("Prediction settings saved", "success");
    } catch (saveError: any) {
      setError(saveError?.message || "Settings could not be saved.");
    }
  };

  const downloadJson = () => {
    if (!paper) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(paper, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${paper.targetYear}-${paper.subject}-${paper.paperType}-revision-forecast.json`.replace(/\s+/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  };

  const visibleRankings = useMemo(() => (paper?.topForecasts || rankings).slice(0, 20), [paper, rankings]);
  const attachedSyllabus = paper?.evidenceSummary?.syllabus || coverage?.coverage;
  const generatedImages = paper?.questions?.filter((question: any) => question.image?.url).length || 0;

  return <div className="mx-auto max-w-7xl space-y-6 pb-16">
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-slate-950">
          <BrainCircuit className="h-8 w-8 text-indigo-600" /> 2026 A/L Guessing Lab
        </h1>
        <p className="mt-1 text-sm text-slate-500">Evidence-calibrated SFT, ET and ICT revision forecasts with real question visuals and marking schemes.</p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
        Revision forecast only — never an official, leaked, guaranteed or 100%-certain paper.
      </div>
    </header>

    {error ? <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="h-5 w-5 shrink-0" /><span>{error}</span></div> : null}

    {!paper ? <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Subject</label>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
            {(["SFT", "ET", "ICT"] as Subject[]).map((item) => <button key={item} type="button" onClick={() => setSubject(item)} className={cn("rounded-lg py-2 text-sm font-bold", item === subject ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500")}>{item}</button>)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-500">Target year<input type="number" min={2026} max={2100} value={targetYear} onChange={(event) => setTargetYear(Number(event.target.value || 2026))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs font-bold text-slate-500">Paper type<select value={paperType} onChange={(event) => setPaperType(event.target.value as PaperType)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">{["Full Paper", "MCQ", "Structured", "Essay"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-xs font-bold text-slate-500">Target marks<input type="number" min={5} max={200} value={targetMarks} onChange={(event) => setTargetMarks(Number(event.target.value || 5))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="text-xs font-bold text-slate-500">Questions<input type="number" min={1} max={50} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value || 1))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Forecast mode</label>
          <div className="space-y-2">{[
            ["safe", "Foundation", "High-quality evidence and core syllabus coverage"],
            ["balanced", "Balanced", "Core, rotation gaps and recent trends"],
            ["surprise", "Challenge", "Under-tested syllabus points with uncertainty"],
          ].map(([id, title, description]) => <button key={id} type="button" onClick={() => setMode(id as Mode)} className={cn("w-full rounded-xl border p-3 text-left", mode === id ? "border-indigo-500 bg-indigo-50" : "border-slate-200")}><p className="text-sm font-bold text-slate-900">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></button>)}</div>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <label className="flex items-center justify-between text-sm font-medium text-slate-700">Include marking answers<input type="checkbox" checked={includeAnswers} onChange={(event) => setIncludeAnswers(event.target.checked)} /></label>
          <label className="flex items-center justify-between text-sm font-medium text-slate-700">Generate actual question images<input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} /></label>
          {includeImages ? <label className="block text-xs font-bold text-slate-500">Maximum images<input type="number" min={0} max={12} value={maxImageQuestions} onChange={(event) => setMaxImageQuestions(Number(event.target.value || 0))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label> : null}
          <label className="block text-xs font-bold text-slate-500">Independent analysis passes<input type="number" min={1} max={5} value={committeeSize} onChange={(event) => setCommitteeSize(Number(event.target.value || 1))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          {isAdmin ? <label className="flex items-center justify-between text-sm font-medium text-slate-700">Use guessing PDFs as low-weight input<input type="checkbox" checked={includeGuessingPapers} onChange={(event) => setIncludeGuessingPapers(event.target.checked)} /></label> : null}
        </div>

        {isAdmin ? <button type="button" onClick={saveAdminSettings} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700"><Save className="h-4 w-4" /> Save subject defaults</button> : null}
        <button type="button" onClick={generate} disabled={loading || loadingIntel} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 disabled:opacity-50">
          {loading ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Reading syllabus, reviewing & drawing…</> : <><Sparkles className="h-5 w-5" /> Generate revision forecast</>}
        </button>
      </aside>

      <main className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Syllabus PDFs" value={loadingIntel ? "…" : attachedSyllabus?.attachedDocuments ?? 0} note={`${attachedSyllabus?.discoveredDocuments ?? 0} accessible source(s) discovered`} />
          <Stat label="Indexed syllabus" value={loadingIntel ? "…" : attachedSyllabus?.indexedChunks ?? 0} note={`${coverage?.nodes ?? 0} lesson/point nodes`} />
          <Stat label="Historical hit rate" value={backtest?.hitRate == null ? "N/A" : `${Math.round(backtest.hitRate * 100)}%`} note="Leave-one-year-out topic backtest" />
          <Stat label="Top forecast topics" value={rankings.length} note="Priority is not exact-question probability" />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-black text-slate-900">Current evidence ranking</h2><p className="text-xs text-slate-500">Probability = revision priority. Confidence = strength of historical evidence.</p></div>{loadingIntel ? <LoaderCircle className="h-5 w-5 animate-spin text-indigo-600" /> : <BarChart3 className="h-5 w-5 text-indigo-600" />}</div>
          <div className="space-y-3">{rankings.slice(0, 10).map((item: any, index: number) => <div key={`${item.lesson}-${index}`} className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-900">{index + 1}. {item.lesson}</p><p className="text-xs text-slate-500">{item.topic} · {item.distinctEvidenceYears || 0} evidence year(s)</p></div><div className="text-right"><p className="text-lg font-black text-indigo-700">{item.probabilityPercent}%</p><p className="text-[10px] text-slate-400">confidence {item.confidence}%</p></div></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.probabilityPercent}%` }} /></div>
          </div>)}{!loadingIntel && rankings.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No indexed historical ranking is available yet. Index verified papers first.</p> : null}</div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
          <h3 className="flex items-center gap-2 font-bold text-indigo-950"><ShieldCheck className="h-5 w-5" /> Quality controls</h3>
          <ul className="mt-3 grid gap-2 text-sm text-indigo-800 md:grid-cols-2">
            <li>• Official syllabus/past papers carry the strongest weight.</li><li>• Guessing papers are excluded by default to prevent circular guesses.</li><li>• Future target-year material is never used as evidence.</li><li>• Image questions receive a real asset with an automatic fallback.</li><li>• Multiple reviewers challenge topic and visual selection.</li><li>• Coverage limits and missing evidence stay visible.</li>
          </ul>
        </section>
      </main>
    </div> : <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button type="button" onClick={() => setPaper(null)} className="flex items-center gap-2 text-sm font-bold text-slate-600"><ChevronLeft className="h-4 w-4" /> New forecast</button>
        <div className="flex gap-2"><button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"><Printer className="h-4 w-4" /> Print / Save PDF</button><button type="button" onClick={downloadJson} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"><Download className="h-4 w-4" /> JSON</button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
        <Stat label="Questions" value={paper.questions?.length || 0} /><Stat label="Total marks" value={paper.totalMarks || 0} /><Stat label="Images" value={generatedImages} /><Stat label="Syllabus PDFs" value={paper.evidenceSummary?.syllabus?.attachedDocuments || 0} /><Stat label="Review passes" value={paper.evidenceSummary?.committeeMembers || 0} />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">{(["paper", "scheme", "evidence", "backtest"] as ResultTab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("rounded-lg px-4 py-2 text-sm font-bold capitalize", tab === item ? "bg-indigo-600 text-white" : "bg-white text-slate-600")}>{item === "scheme" ? "Marking scheme" : item}</button>)}</div>

      {tab === "paper" ? <article className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-12 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-7 text-center"><p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">AI-generated revision forecast</p><h2 className="mt-2 text-2xl font-black text-slate-950">{paper.title}</h2><p className="mt-2 text-sm text-slate-500">{paper.subject} · {paper.targetYear} · {paper.paperType} · {paper.totalMarks} marks</p><p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-900">{paper.disclaimer}</p></header>
        <div className="mt-8 space-y-10">{paper.questions?.map((question: any) => <section key={question.questionNo} className="break-inside-avoid space-y-4">
          <div className="flex items-start gap-3"><span className="rounded-lg bg-slate-950 px-2.5 py-1 text-sm font-black text-white">{question.questionNo}</span><div className="flex-1"><div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-400"><span>{question.section}</span><span>•</span><span>{question.questionType}</span><span>•</span><span>{question.marks} marks</span></div><p className="whitespace-pre-wrap text-[15px] font-medium leading-7 text-slate-900">{question.text}</p></div></div>
          {question.requiresImage ? question.image?.url ? <figure className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3"><img src={question.image.url} alt={question.image.altText || `Question ${question.questionNo} diagram`} className="mx-auto h-auto max-h-[560px] w-full object-contain" /><figcaption className="mt-2 text-center text-xs text-slate-500">{question.image.caption}</figcaption></figure> : <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">Required question image is unavailable. This question is intentionally blocked from text-only use.</div> : null}
          {question.options?.length ? <ol className="grid gap-2 pl-12 md:grid-cols-2">{question.options.map((option: string, index: number) => <li key={index} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><span className="mr-2 font-black">{String.fromCharCode(65 + index)}.</span>{option}</li>)}</ol> : null}
          <div className="ml-12 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-700">Priority {question.predictionProbability}%</span><span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700">Evidence confidence {question.predictionConfidence}%</span><span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{question.lesson}{question.subtopic ? ` · ${question.subtopic}` : ""}</span></div>
        </section>)}</div>
      </article> : null}

      {tab === "scheme" ? <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-10"><h2 className="flex items-center gap-2 text-xl font-black"><FileCheck2 className="h-6 w-6 text-emerald-600" /> Marking scheme</h2><div className="mt-6 space-y-5">{paper.markingScheme?.map((item: any) => <div key={item.questionNo} className="rounded-xl border border-slate-200 p-5"><div className="flex justify-between"><h3 className="font-black">Question {item.questionNo}</h3><span className="text-sm font-bold text-slate-500">{item.marks} marks</span></div>{item.answer ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700"><strong>Answer:</strong> {item.answer}</p> : null}<ul className="mt-3 space-y-1 text-sm text-slate-600">{item.markingPoints?.map((point: string, index: number) => <li key={index}>• {point}</li>)}</ul></div>)}</div></section> : null}

      {tab === "evidence" ? <section className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><Stat label="Indexed questions" value={paper.evidenceSummary?.indexedQuestions || 0} /><Stat label="Eligible sources" value={paper.evidenceSummary?.eligibleSources || 0} /><Stat label="Generated visuals" value={paper.evidenceSummary?.generatedImages || 0} /></div><div className="grid gap-4 lg:grid-cols-2">{visibleRankings.map((item: any, index: number) => <div key={`${item.lesson}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><h3 className="font-black text-slate-900">{item.lesson}</h3><span className="font-black text-indigo-700">{item.probabilityPercent}%</span></div><p className="mt-1 text-xs text-slate-500">Confidence {item.confidence}% · interval {item.confidenceInterval?.join("–")} · {item.distinctEvidenceYears} year(s)</p><ul className="mt-3 space-y-1 text-sm text-slate-600">{item.why?.slice(0, 5).map((reason: string, reasonIndex: number) => <li key={reasonIndex}>• {reason}</li>)}</ul><div className="mt-3 flex flex-wrap gap-1">{item.evidence?.slice(0, 5).map((entry: any, evidenceIndex: number) => <span key={evidenceIndex} className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{entry.year || "Indexed"}: {entry.sourceTitle || entry.sourceId || "verified source"}</span>)}</div></div>)}</div></section> : null}

      {tab === "backtest" ? <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="flex items-center gap-2 text-xl font-black"><Target className="h-6 w-6 text-indigo-600" /> Historical leave-one-year-out check</h2><div className="mt-5 grid gap-3 md:grid-cols-3"><Stat label="Hit rate" value={backtest?.hitRate == null ? "N/A" : `${Math.round(backtest.hitRate * 100)}%`} /><Stat label="Precision" value={backtest?.precision == null ? "N/A" : `${Math.round(backtest.precision * 100)}%`} /><Stat label="Recall" value={backtest?.recall == null ? "N/A" : `${Math.round(backtest.recall * 100)}%`} /></div><p className="mt-5 text-sm leading-6 text-slate-600">This checks whether a topic-ranking method would have surfaced topics appearing in a held-out historical year. It does not validate an exact future question or make the forecast certain.</p></section> : null}
    </div>}
  </div>;
}
