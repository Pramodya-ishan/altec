import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, CheckCircle2, FileImage, FileText, Film, FolderOpen, Loader2,
  Paperclip, PlayCircle, Search, Trash2, UploadCloud,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { SYLLABUS } from "../../constants/syllabus";
import type { LessonResource, LessonResourceKind, SubjectKey } from "../../types";
import { apiFetch } from "../../lib/api";
import { setPendingTopicHighlight } from "../../lib/navigationIntent";
import {
  openPrivateStoragePdf,
  uploadPdfWithClientStorage,
  type UploadProgressSnapshot,
  type UploadTaskControls,
} from "../../lib/clientStorageUpload";
import { createAndUploadSecureVideo } from "../../lib/videoUpload";
import { SecureVideoPlayer } from "../video/SecureVideoPlayer";

function normalizeLessonId(value: unknown) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

function uniqueLessons(subject: SubjectKey) {
  const definition = SYLLABUS[subject];
  const values = [
    ...definition.mcqItems.map((item) => item.title),
    ...definition.partAItems.flatMap((item) => item.topics || []),
    ...definition.partBCDItems.flatMap((item) => item.topics || []),
    ...(definition.bcdGroups || []).flatMap((group) => group.items.flatMap((item) => item.topics || [])),
  ].filter(Boolean);
  return [...new Set(values)];
}

function resourceKind(resource: any): LessonResourceKind {
  if (resource?.mediaKind === "video" || resource?.videoId) return "video";
  if (resource?.mediaKind === "image" || String(resource?.mimeType || "").startsWith("image/")) return "image";
  return "pdf";
}

function fileKind(file: File): LessonResourceKind {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "document";
}

function KindIcon({ kind }: { kind: LessonResourceKind }) {
  if (kind === "video") return <Film className="h-5 w-5" />;
  if (kind === "image") return <FileImage className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export default function NotesView() {
  const navigate = useNavigate();
  const {
    currentSubject, data, showNotification, profile,
  } = useApp();
  const lessons = useMemo(() => uniqueLessons(currentSubject), [currentSubject]);
  const [query, setQuery] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(lessons[0] || "");
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressSnapshot | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [player, setPlayer] = useState<LessonResource | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<UploadTaskControls | null>(null);

  const filteredLessons = useMemo(() => lessons.filter((lesson) => lesson.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [lessons, query]);
  const roles = new Set([profile?.role, ...(profile?.roles || [])].filter(Boolean));
  const likelyManager = ["admin", "content_editor", "teacher", "ops"].some((role) => roles.has(role));

  useEffect(() => {
    if (!lessons.includes(selectedLesson)) setSelectedLesson(lessons[0] || "");
  }, [lessons, selectedLesson]);

  const loadResources = async () => {
    if (!selectedLesson) return;
    setLoading(true);
    try {
      const lessonId = normalizeLessonId(selectedLesson);
      const response = await apiFetch(`/api/lesson-resources?subject=${encodeURIComponent(currentSubject.toUpperCase())}&lessonId=${encodeURIComponent(lessonId)}&lessonTitle=${encodeURIComponent(selectedLesson)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.resources)) throw new Error(payload?.message || "Lesson resources could not be loaded.");
      setCanManage(payload.canManageLessonResources === true);
      setResources(payload.resources.map((resource: any) => ({
        id: resource.id,
        sourceId: resource.sourceId,
        videoId: resource.videoId || undefined,
        url: resource.videoId ? `video://${resource.videoId}` : String(resource.storagePath || resource.sourceId || ""),
        title: resource.title || resource.fileName || "Lesson resource",
        mimeType: resource.mimeType,
        mediaKind: resourceKind(resource),
        storagePath: resource.storagePath || undefined,
        status: resource.processingStatus || resource.status || "ready",
        sizeBytes: Number(resource.sizeBytes || 0) || undefined,
        createdAt: resource.createdAt,
        displayPriority: Number(resource.displayPriority || 0),
      })));
    } catch (error: any) {
      setResources([]);
      showNotification(error?.message || "Lesson resources could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadResources(); }, [currentSubject, selectedLesson]);

  const processFiles = async (files: File[]) => {
    if (!canManage && !likelyManager) {
      showNotification("Only an admin, teacher, or content editor can publish shared lesson resources.", "error");
      return;
    }
    const accepted = files.filter((file) => ["pdf", "image", "video"].includes(fileKind(file))).slice(0, 12);
    if (accepted.length === 0) return showNotification("Use PDF, PNG/JPEG/WebP, MP4, MOV, or WebM files.", "error");
    setUploading(true);
    try {
      for (const file of accepted) {
        const kind = fileKind(file);
        setUploadName(file.name);
        setUploadProgress({ bytesTransferred: 0, totalBytes: file.size, progress: 0, state: "running" });
        const maxBytes = kind === "video" ? 10 * 1024 ** 3 : kind === "pdf" ? 50 * 1024 ** 2 : 20 * 1024 ** 2;
        if (file.size <= 0 || file.size > maxBytes) throw new Error(`${file.name} exceeds the allowed size.`);
        if (kind === "video") {
          await createAndUploadSecureVideo({
            file,
            metadata: { title: file.name.replace(/\.[^.]+$/, ""), subject: currentSubject, lesson: selectedLesson, visibility: "class" },
            onProgress: setUploadProgress,
            onTask: (controls) => { controlsRef.current = controls; },
          });
        } else {
          const lessonId = normalizeLessonId(selectedLesson);
          const upload = await uploadPdfWithClientStorage({
            file,
            subject: currentSubject,
            lesson: selectedLesson,
            resourceType: "paper_structure",
            sourceScope: "paper_structure",
            sourceType: kind,
            onProgress: setUploadProgress,
            onTask: (controls) => { controlsRef.current = controls; },
          });
          const response = await apiFetch("/api/pdf/process-uploaded", {
            method: "POST",
            body: JSON.stringify({
              title: file.name, fileName: file.name, subject: currentSubject, lesson: selectedLesson, lessonId,
              resourceType: "paper_structure", sourceType: kind, sourceScope: "paper_structure",
              sourceId: upload.sourceId, storagePath: upload.storagePath,
            }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok && response.status !== 202) throw new Error(payload?.message || payload?.error || "Resource processing failed.");
        }
      }
      showNotification(`${accepted.length} lesson resource${accepted.length === 1 ? "" : "s"} uploaded.`, "success");
      await loadResources();
      window.dispatchEvent(new CustomEvent("lesson-resources:changed", { detail: { subject: currentSubject, lessonId: normalizeLessonId(selectedLesson) } }));
    } catch (error: any) {
      if (error?.name !== "AbortError" && error?.code !== "storage/canceled") showNotification(error?.message || "Upload failed.", "error");
    } finally {
      controlsRef.current = null;
      setUploading(false);
      setUploadProgress(null);
      setUploadName("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openResource = async (resource: LessonResource) => {
    if (resource.mediaKind === "video" && resource.videoId) {
      if (resource.status !== "ready") return showNotification(`Video is still processing (${resource.status}).`, "info");
      setPlayer(resource);
      return;
    }
    if (resource.storagePath) await openPrivateStoragePdf(resource.storagePath);
  };

  const deleteResource = async (resource: LessonResource) => {
    if (!resource.id || !canManage || !confirm(`Delete “${resource.title}”?`)) return;
    const response = await apiFetch(`/api/lesson-resources/${resource.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return showNotification(payload?.message || "Resource could not be deleted.", "error");
    setResources((current) => current.filter((item) => item.id !== resource.id));
    showNotification("Resource deleted.", "success");
  };

  return (
    <div className="pb-8" aria-label="Lesson resources">
      <div className="grid min-h-[650px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.06)] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" /></div>
          <div className="mt-4 max-h-[560px] space-y-1 overflow-y-auto pr-1">
            {filteredLessons.map((lesson) => {
              const active = lesson === selectedLesson;
              const completed = data[currentSubject].topics[lesson]?.checked;
              return <button key={lesson} type="button" onClick={() => setSelectedLesson(lesson)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? "bg-white/10" : "bg-white text-slate-400"}`}>{completed ? <CheckCircle2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}</span><span className="min-w-0 truncate">{lesson}</span></button>;
            })}
          </div>
        </aside>

        <main className="min-w-0 p-5 sm:p-7">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{currentSubject.toUpperCase()} lesson</p><h2 className="mt-1 truncate text-2xl font-black text-slate-950">{selectedLesson || "Select a lesson"}</h2></div>
            <button type="button" onClick={() => { setPendingTopicHighlight(selectedLesson); navigate("/paper-structure"); }} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"><FolderOpen className="h-4 w-4" /> Open in Paper Structure</button>
          </div>

          <section className="mt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-black text-slate-900">Lesson library</h3><p className="mt-1 text-xs text-slate-500">PDFs, question images, and videos linked to this exact lesson.</p></div>{(canManage || likelyManager) && <><input ref={inputRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(event) => void processFiles(Array.from(event.target.files || []))} /><button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"><UploadCloud className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload resources"}</button></>}</div>

            {uploading && uploadProgress && <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-xs font-bold text-indigo-950">{uploadName}</span><span className="text-xs font-black text-indigo-700">{Math.round(uploadProgress.progress * 100)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(2, uploadProgress.progress * 100)}%` }} /></div></div>}

            <div
              onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setIsDragging(true); } }}
              onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); void processFiles(Array.from(event.dataTransfer.files || [])); }}
              onPaste={(event) => { const files = Array.from(event.clipboardData.files || []); if (files.length) { event.preventDefault(); void processFiles(files); } }}
              tabIndex={0}
              className={`mt-4 rounded-2xl border-2 border-dashed p-4 outline-none transition ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/50 focus:border-slate-400"}`}
            >
              {loading ? <div className="grid min-h-40 place-items-center text-sm font-semibold text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading resources…</div> : resources.length === 0 ? <div className="grid min-h-40 place-items-center text-center"><div><Paperclip className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">No resources yet</p><p className="mt-1 text-xs text-slate-400">Drop or paste files here when upload access is available.</p></div></div> : <div className="grid gap-3 md:grid-cols-2">{resources.map((resource) => { const kind = resource.mediaKind || resourceKind(resource); return <div key={resource.id || resource.sourceId || resource.videoId || resource.title} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><button type="button" onClick={() => void openResource(resource)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">{kind === "video" ? <PlayCircle className="h-5 w-5" /> : <KindIcon kind={kind} />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800">{resource.title}</span><span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{kind}{resource.sizeBytes ? ` · ${formatBytes(resource.sizeBytes)}` : ""}{resource.status && resource.status !== "ready" ? ` · ${resource.status}` : ""}</span></span></button>{canManage && <button type="button" onClick={() => void deleteResource(resource)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${resource.title}`}><Trash2 className="h-4 w-4" /></button>}</div>; })}</div>}
            </div>
          </section>
        </main>
      </div>
      {player?.videoId && <SecureVideoPlayer videoId={player.videoId} title={player.title} onClose={() => setPlayer(null)} />}
    </div>
  );
}
