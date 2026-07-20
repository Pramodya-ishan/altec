import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { auth } from "../../lib/firebase";
import { apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";
import { getPdfOpenErrorMessage, openSourcePdf } from "../../lib/sourceActions";
import { uploadPdfWithClientStorage, type UploadProgressSnapshot, type UploadTaskControls } from "../../lib/clientStorageUpload";
import { inferPaperMetadata, type InferredPaperMetadata, type PaperCollection } from "../../shared/paperMetadata";
import { useApp } from "../../context/AppContext";

const CATEGORIES: Array<{ value: PaperCollection; label: string; icon: string }> = [
  { value: "A/L Past Papers", label: "Papers", icon: "fa-file-lines" },
  { value: "Model Papers", label: "Models", icon: "fa-wand-magic-sparkles" },
  { value: "Marking Schemes", label: "Marking Schemes", icon: "fa-list-check" },
];
const PRIORITY_OPTIONS = [100, 50, 25, 10, 0, -25, -50];
const MAX_BULK_FILES = 30;
const MAX_INLINE_REINDEX_BYTES = 4_000_000;

type UploadTelemetry = UploadProgressSnapshot & {
  fileName: string;
  current: number;
  total: number;
  speedBytesPerSecond: number;
  remainingBytes: number;
  etaSeconds: number | null;
  phase: "uploading" | "indexing" | "saving";
};

type EditPaper = {
  sourceId: string;
  title: string;
  fileName: string;
  year: string;
  subject: string;
  category: PaperCollection;
  paperType: string;
  medium: string;
  displayPriority: number;
  published: boolean;
};

function normalizeSubject(value: unknown) {
  const upper = String(value || "SFT").trim().toUpperCase();
  return ["SFT", "ET", "ICT"].includes(upper) ? upper : "SFT";
}

function paperKey(paper: any) {
  return String(paper?.sourceId || paper?.id || paper?.storagePath || paper?.title || "");
}

function timestampMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === "object") {
    const seconds = Number((value as any).seconds ?? (value as any)._seconds);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }
  if (typeof value === "number") return value > 10_000_000_000 ? value : value * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function priority(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(-1000, Math.min(1000, Math.trunc(parsed))) : 0;
}

function sortPapers(left: any, right: any) {
  return priority(right.displayPriority) - priority(left.displayPriority)
    || timestampMillis(right.createdAt || right.updatedAt) - timestampMillis(left.createdAt || left.updatedAt)
    || String(left.title || "").localeCompare(String(right.title || ""));
}

function dedupe(items: any[]) {
  const map = new Map<string, any>();
  for (const item of items || []) {
    const key = paperKey(item);
    if (key) map.set(key, { ...(map.get(key) || {}), ...item });
  }
  return [...map.values()];
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatEta(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Calculating…";
  if (value < 60) return `${Math.max(1, Math.ceil(value))}s`;
  return `${Math.floor(value / 60)}m ${Math.ceil(value % 60)}s`;
}

function editModel(paper: any): EditPaper {
  return {
    sourceId: paperKey(paper),
    title: String(paper.title || paper.fileName || "Untitled paper"),
    fileName: String(paper.fileName || paper.title || "paper.pdf"),
    year: String(paper.year || ""),
    subject: normalizeSubject(paper.subject),
    category: (CATEGORIES.some((item) => item.value === paper.category) ? paper.category : "A/L Past Papers") as PaperCollection,
    paperType: String(paper.paperType || paper.type || "Full Paper"),
    medium: String(paper.medium || "Sinhala"),
    displayPriority: priority(paper.displayPriority),
    published: paper.published !== false,
  };
}

export default function PastPapersView() {
  const { currentSubject, user } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<PaperCollection>("A/L Past Papers");
  const [searchTerm, setSearchTerm] = useState("");
  const [papers, setPapers] = useState<any[]>([]);
  const [uploadedPapers, setUploadedPapers] = useState<any[]>([]);
  const [canManagePastPapers, setCanManagePastPapers] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTelemetry, setUploadTelemetry] = useState<UploadTelemetry | null>(null);
  const [updatingPriorityId, setUpdatingPriorityId] = useState<string | null>(null);
  const [movingCollectionId, setMovingCollectionId] = useState<string | null>(null);
  const [editingPaper, setEditingPaper] = useState<EditPaper | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const uploadStartedAtRef = useRef(0);
  const uploadControlsRef = useRef<UploadTaskControls | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      setPapers([]);
      setCanManagePastPapers(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch(`/api/rag/past-papers?subject=${encodeURIComponent(normalizeSubject(currentSubject))}`);
        const result = await response.json().catch(() => null);
        if (!cancelled) {
          setCanManagePastPapers(response.ok && result?.canManagePastPapers === true);
          setPapers(response.ok && Array.isArray(result?.papers) ? dedupe(result.papers).sort(sortPapers) : []);
        }
      } catch {
        if (!cancelled) setPapers([]);
      }
    };
    void load();
    const interval = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [currentSubject, user?.email]);

  const filteredPapers = useMemo(() => dedupe([...uploadedPapers, ...papers])
    .filter((paper) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesQuery = !query || `${paper.title || ""} ${paper.year || ""} ${paper.fileName || ""}`.toLowerCase().includes(query);
      return matchesQuery && String(paper.category || "A/L Past Papers") === selectedCategory;
    })
    .sort(sortPapers), [uploadedPapers, papers, searchTerm, selectedCategory]);

  const saveCatalogRecord = async (metadata: InferredPaperMetadata, uploaded: any, indexingData: any) => {
    const response = await apiFetch("/api/rag/past-papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: uploaded.sourceId,
        sourceId: uploaded.sourceId,
        ...metadata,
        type: metadata.paperType,
        storagePath: uploaded.storagePath,
        sourceScope: "past_paper",
        sourceType: metadata.resourceType,
        chunkCount: Number(indexingData?.chunkCount || 0),
        needsOcr: indexingData?.needsOcr === true,
        indexStatus: indexingData?.indexStatus || indexingData?.status || "queued",
        textIndexed: Number(indexingData?.chunkCount || 0) > 0,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.message || payload?.error || "Paper metadata could not be saved.");
    return payload.doc;
  };

  const uploadOne = async (file: File, index: number, total: number) => {
    const preliminary = inferPaperMetadata(file.name, "", currentSubject);
    uploadStartedAtRef.current = performance.now();
    const uploaded = await uploadPdfWithClientStorage({
      file,
      subject: preliminary.subject,
      year: preliminary.year,
      resourceType: preliminary.resourceType,
      sourceScope: "past_paper",
      onTask: (controls) => { uploadControlsRef.current = controls; },
      onProgress: (snapshot) => {
        const elapsed = Math.max(0.25, (performance.now() - uploadStartedAtRef.current) / 1000);
        const speed = snapshot.bytesTransferred / elapsed;
        const remaining = Math.max(0, snapshot.totalBytes - snapshot.bytesTransferred);
        setUploadTelemetry({
          ...snapshot,
          fileName: file.name,
          current: index + 1,
          total,
          speedBytesPerSecond: speed,
          remainingBytes: remaining,
          etaSeconds: speed > 1024 ? remaining / speed : null,
          phase: "uploading",
        });
      },
    });

    setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: "indexing" } : null);
    const ingestResponse = await apiFetch("/api/pdf/process-uploaded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: uploaded.sourceId,
        storagePath: uploaded.storagePath,
        title: preliminary.title,
        fileName: file.name,
        subject: preliminary.subject,
        year: preliminary.year,
        resourceType: preliminary.resourceType,
        sourceType: preliminary.resourceType,
        sourceScope: "past_paper",
        medium: preliminary.medium,
        deferProcessing: file.size <= MAX_INLINE_REINDEX_BYTES,
      }),
    });
    const ingest = await ingestResponse.json().catch(() => null);
    if (!ingestResponse.ok || !ingest?.ok) throw new Error(ingest?.message || ingest?.code || "PDF indexing could not start.");

    let indexingData = ingest;
    if (file.size <= MAX_INLINE_REINDEX_BYTES) {
      const form = new FormData();
      form.append("file", file);
      form.append("sourceId", uploaded.sourceId);
      form.append("mode", "auto");
      const response = await apiFetch("/api/rag/reindex-uploaded", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) indexingData = payload;
    }

    let inferred = preliminary;
    try {
      const response = await apiFetch("/api/rag/past-papers/infer-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: uploaded.sourceId, fileName: file.name, fallbackSubject: currentSubject }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.metadata) inferred = { ...preliminary, ...payload.metadata, fileName: file.name };
    } catch {
      // Filename inference remains a safe fallback when OCR is still queued.
    }

    setUploadTelemetry((current) => current ? { ...current, phase: "saving" } : null);
    const doc = await saveCatalogRecord(inferred, uploaded, indexingData);
    return { ...doc, id: uploaded.sourceId, sourceId: uploaded.sourceId, storagePath: uploaded.storagePath, createdAt: new Date().toISOString() };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    event.target.value = "";
    if (!canManagePastPapers) return setToast({ type: "error", message: "Only administrators and content managers can upload shared papers." });
    if (!auth.currentUser || auth.currentUser.isAnonymous) return setToast({ type: "error", message: "Sign in again before uploading PDFs." });
    if (!selected.length) return setToast({ type: "error", message: "Select one or more PDF files." });
    const files = selected.slice(0, MAX_BULK_FILES);
    setIsUploading(true);
    let completed = 0;
    const failed: string[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        try {
          const paper = await uploadOne(files[index], index, files.length);
          setUploadedPapers((current) => dedupe([paper, ...current]).sort(sortPapers));
          completed += 1;
        } catch (error: any) {
          console.error("Bulk paper upload failed", { file: files[index].name, error });
          failed.push(files[index].name);
        }
      }
      if (failed.length) {
        setToast({ type: "error", message: `${completed} uploaded; ${failed.length} failed: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}` });
      } else {
        setToast({ type: "success", message: `${completed} PDF${completed === 1 ? "" : "s"} uploaded, classified, and queued for indexing.` });
      }
    } finally {
      setIsUploading(false);
      setUploadTelemetry(null);
      uploadControlsRef.current = null;
    }
  };

  const updatePaperInState = (paperId: string, update: any) => {
    const apply = (items: any[]) => items.map((item) => paperKey(item) === paperId ? { ...item, ...update } : item).sort(sortPapers);
    setPapers(apply);
    setUploadedPapers(apply);
  };

  const handlePriorityChange = async (paper: any, displayPriority: number, event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    if (!canManagePastPapers) return;
    const paperId = paperKey(paper);
    setUpdatingPriorityId(paperId);
    try {
      const response = await apiFetch(`/api/rag/past-papers/${encodeURIComponent(paperId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayPriority }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Priority update failed.");
      updatePaperInState(paperId, { displayPriority: payload.paper?.displayPriority ?? payload.displayPriority });
    } catch (error: any) {
      setToast({ type: "error", message: error?.message || "Priority update failed." });
    } finally {
      setUpdatingPriorityId(null);
    }
  };

  const handleCollectionChange = async (paper: any, category: PaperCollection, event: React.ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    if (!canManagePastPapers || category === String(paper.category || "A/L Past Papers")) return;
    const paperId = paperKey(paper);
    setMovingCollectionId(paperId);
    try {
      const response = await apiFetch(`/api/rag/past-papers/${encodeURIComponent(paperId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Paper could not be moved.");
      const destination = CATEGORIES.find((item) => item.value === category)?.label || category;
      updatePaperInState(paperId, payload.paper || { category });
      setToast({ type: "success", message: `Moved to ${destination}.` });
    } catch (error: any) {
      setToast({ type: "error", message: error?.message || "Paper could not be moved." });
    } finally {
      setMovingCollectionId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingPaper) return;
    setSavingEdit(true);
    try {
      const response = await apiFetch(`/api/rag/past-papers/${encodeURIComponent(editingPaper.sourceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPaper),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Paper data could not be updated.");
      updatePaperInState(editingPaper.sourceId, payload.paper || editingPaper);
      setSelectedCategory(editingPaper.category);
      setEditingPaper(null);
      setToast({ type: "success", message: "Paper name and metadata updated." });
    } catch (error: any) {
      setToast({ type: "error", message: error?.message || "Paper data could not be updated." });
    } finally {
      setSavingEdit(false);
    }
  };

  const isDeleteAllowed = (_paper: any) => canManagePastPapers;

  const handleDeletePaper = async (paper: any, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(`Delete “${paper.title}”?`)) return;
    const paperId = paperKey(paper);
    try {
      const response = await apiFetch(`/api/rag/past-papers/${encodeURIComponent(paperId)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || payload?.error || "Delete failed.");
      setPapers((current) => current.filter((item) => paperKey(item) !== paperId));
      setUploadedPapers((current) => current.filter((item) => paperKey(item) !== paperId));
      setToast({ type: "success", message: "Paper deleted." });
    } catch (error: any) {
      setToast({ type: "error", message: error?.message || "Delete failed." });
    }
  };

  const openPaper = (paper: any) => openSourcePdf({
    storagePath: paper.storagePath,
    url: paper.url,
    id: paper.id,
    sourceId: paper.sourceId,
    title: paper.title,
  }).catch((error: unknown) => setToast({ type: "error", message: getPdfOpenErrorMessage(error) }));

  return (
    <div className="space-y-6">
      <section className="relative rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex w-full gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1 md:w-auto" role="tablist" aria-label="Paper collection">
            {CATEGORIES.map((category) => (
              <button key={category.value} type="button" role="tab" aria-selected={selectedCategory === category.value} onClick={() => setSelectedCategory(category.value)} className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition", selectedCategory === category.value ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800")}>
                <i className={`fa-solid ${category.icon}`} /> {category.label}
              </button>
            ))}
          </div>

          {canManagePastPapers && auth.currentUser && !auth.currentUser.isAnonymous && (
            <div className="relative">
              <input id="bulk-pdf-upload" className="hidden" type="file" accept="application/pdf,.pdf" multiple disabled={isUploading} onChange={handleFileUpload} />
              <label htmlFor="bulk-pdf-upload" className={cn("flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700", isUploading && "pointer-events-none opacity-70")}>
                <i className={`fa-solid ${isUploading ? "fa-circle-notch fa-spin" : "fa-cloud-arrow-up"}`} />
                {isUploading ? `Processing ${uploadTelemetry?.current || 1}/${uploadTelemetry?.total || 1}` : "Bulk upload PDFs"}
              </label>
            </div>
          )}
        </div>

        {isUploading && uploadTelemetry && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs shadow-sm" role="status" aria-live="polite">
            <div className="mb-2 flex items-start justify-between gap-4 font-bold text-slate-800">
              <div><p className="break-all">{uploadTelemetry.fileName}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">File {uploadTelemetry.current} of {uploadTelemetry.total} · {uploadTelemetry.phase}</p></div>
              <span>{Math.round(uploadTelemetry.progress * 100)}%</span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${uploadTelemetry.progress * 100}%` }} /></div>
            <div className="grid grid-cols-2 gap-2 text-slate-500 sm:grid-cols-4">
              <span>{formatBytes(uploadTelemetry.bytesTransferred)} / {formatBytes(uploadTelemetry.totalBytes)}</span>
              <span>Remaining {formatBytes(uploadTelemetry.remainingBytes)}</span>
              <span>{formatBytes(uploadTelemetry.speedBytesPerSecond)}/s</span>
              <span>ETA {uploadTelemetry.phase === "uploading" ? formatEta(uploadTelemetry.etaSeconds) : "Processing…"}</span>
            </div>
            {uploadTelemetry.phase === "uploading" && <button type="button" onClick={() => uploadControlsRef.current?.cancel()} className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 hover:text-rose-600">Cancel current file</button>}
          </div>
        )}

        <div className="relative mb-6">
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by year, filename, or title…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-50" />
        </div>

        {filteredPapers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center"><i className="fa-solid fa-folder-open mb-3 text-3xl text-slate-300" /><h3 className="font-bold text-slate-600">No papers found</h3><p className="mt-1 text-sm text-slate-400">{canManagePastPapers ? "Upload PDFs or change the filters." : "No published papers match this view."}</p></div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPapers.map((paper) => {
              const type = String(paper.paperType || paper.type || "Full Paper");
              return (
                <motion.article key={paperKey(paper)} layout tabIndex={0} role="button" aria-label={`Open ${paper.title}`} onClick={() => void openPaper(paper)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openPaper(paper); } }} className="group flex min-h-56 cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-primary-100">
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-3"><span className="rounded-md bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700">{type}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{paper.year || "Year N/A"}</span></div>
                    <h4 className="text-base font-bold leading-tight text-slate-800 transition group-hover:text-primary-600">{paper.title}</h4>
                    <p className="mt-2 break-all text-[10px] text-slate-400">{paper.fileName}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span className="rounded bg-slate-100 px-2 py-1">{paper.subject}</span><span className="rounded bg-slate-100 px-2 py-1">{paper.medium || "Sinhala"}</span>{paper.published === false && <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">Draft</span>}</div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3" onClick={(event) => event.stopPropagation()}>
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Open PDF</span>
                    <div className="flex items-center gap-1.5">
                      {canManagePastPapers && <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500" title="Move paper to another collection"><i className={cn("fa-solid text-[9px]", movingCollectionId === paperKey(paper) ? "fa-circle-notch fa-spin" : "fa-folder-tree")} /><select aria-label={`Move ${paper.title} to collection`} value={String(paper.category || "A/L Past Papers")} disabled={movingCollectionId === paperKey(paper)} onChange={(event) => void handleCollectionChange(paper, event.target.value as PaperCollection, event)} className="max-w-24 bg-transparent font-black text-slate-700 outline-none">{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
                      {canManagePastPapers && <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500" title="Display priority"><span>Priority</span><select aria-label={`Display priority for ${paper.title}`} value={priority(paper.displayPriority)} disabled={updatingPriorityId === paperKey(paper)} onChange={(event) => void handlePriorityChange(paper, Number(event.target.value), event)} className="bg-transparent font-black text-slate-700 outline-none">{!PRIORITY_OPTIONS.includes(priority(paper.displayPriority)) && <option value={priority(paper.displayPriority)}>{priority(paper.displayPriority)}</option>}{PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
                      {canManagePastPapers && <button type="button" onClick={() => setEditingPaper(editModel(paper))} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600" title="Edit paper data"><i className="fa-solid fa-pen text-xs" /></button>}
                      {isDeleteAllowed(paper) && <button type="button" onClick={(event) => void handleDeletePaper(paper, event)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Delete paper"><i className="fa-regular fa-trash-can text-xs" /></button>}
                      <button type="button" onClick={() => void openPaper(paper)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition group-hover:border-primary-500 group-hover:bg-primary-500 group-hover:text-white" aria-label={`Open ${paper.title}`}><i className="fa-solid fa-arrow-right" /></button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </section>

      <AnimatePresence>
        {editingPaper && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit paper metadata" onMouseDown={(event) => { if (event.currentTarget === event.target && !savingEdit) setEditingPaper(null); }}>
            <motion.div initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.98 }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
              <div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-black text-slate-900">Edit paper data</h3><p className="text-xs text-slate-400">Changes also update the searchable PDF source.</p></div><button type="button" disabled={savingEdit} onClick={() => setEditingPaper(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><i className="fa-solid fa-xmark" /></button></div>
              <div className="grid gap-4 sm:grid-cols-2">
                {([ ["Title", "title"], ["Filename", "fileName"], ["Year", "year"] ] as const).map(([label, key]) => <label key={key} className={key === "title" || key === "fileName" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><input value={editingPaper[key]} onChange={(event) => setEditingPaper({ ...editingPaper, [key]: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500" /></label>)}
                <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Subject</span><select value={editingPaper.subject} onChange={(event) => setEditingPaper({ ...editingPaper, subject: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{["SFT", "ET", "ICT"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Collection</span><select value={editingPaper.category} onChange={(event) => setEditingPaper({ ...editingPaper, category: event.target.value as PaperCollection })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Paper type</span><select value={editingPaper.paperType} onChange={(event) => setEditingPaper({ ...editingPaper, paperType: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{["MCQ", "Structured", "Essay", "Full Paper"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Medium</span><select value={editingPaper.medium} onChange={(event) => setEditingPaper({ ...editingPaper, medium: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{["Sinhala", "English", "Tamil"].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Display priority</span><input type="number" min={-1000} max={1000} value={editingPaper.displayPriority} onChange={(event) => setEditingPaper({ ...editingPaper, displayPriority: priority(event.target.value) })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-600"><input type="checkbox" checked={editingPaper.published} onChange={(event) => setEditingPaper({ ...editingPaper, published: event.target.checked })} className="h-4 w-4" /> Published for students</label>
              </div>
              <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={savingEdit} onClick={() => setEditingPaper(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button type="button" disabled={savingEdit} onClick={() => void saveEdit()} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{savingEdit ? "Saving…" : "Save changes"}</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={cn("fixed bottom-6 right-6 z-[120] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold text-white shadow-xl", toast.type === "success" ? "border-emerald-400/20 bg-emerald-500/95" : toast.type === "error" ? "border-rose-400/20 bg-rose-500/95" : "border-slate-700 bg-slate-800")}><span className="flex-1">{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss"><i className="fa-solid fa-xmark" /></button></motion.div>}</AnimatePresence>
    </div>
  );
}
