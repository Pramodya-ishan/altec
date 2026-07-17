import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileImage, FileText, Film, Pause, Play, Trash2, UploadCloud, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import type { LessonResource, LessonResourceKind } from "../../types";
import { auth } from "../../lib/firebase";
import { apiFetch } from "../../lib/api";
import {
  openPrivateStoragePdf,
  uploadPdfWithClientStorage,
  type UploadProgressSnapshot,
  type UploadTaskControls,
} from "../../lib/clientStorageUpload";
import { createAndUploadSecureVideo } from "../../lib/videoUpload";
import { SecureVideoPlayer } from "../video/SecureVideoPlayer";

type UploadTelemetry = UploadProgressSnapshot & {
  speedBytesPerSecond: number;
  remainingBytes: number;
  etaSeconds: number | null;
  fileName: string;
};

type PermissionState = "loading" | "allowed" | "denied" | "unavailable";

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatEta(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Calculating…";
  if (value < 60) return `${Math.max(1, Math.ceil(value))} sec`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.ceil(value % 60);
  return `${minutes} min ${seconds} sec`;
}

function normalizeLessonId(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function normalizeRepeatedExtension(value: string) {
  return String(value || "resource").replace(/(\.[a-z0-9]{2,5})(?:\1)+$/i, "$1");
}

function getMediaKind(file: File): LessonResourceKind {
  if (file.type.startsWith("video/")) return "video";
  if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "document";
}

function mediaKindLabel(kind?: LessonResourceKind) {
  if (kind === "video") return "Video";
  if (kind === "image") return "Image";
  return "PDF";
}

function ResourceIcon({ kind }: { kind?: LessonResourceKind }) {
  if (kind === "video") return <Film className="h-5 w-5 text-violet-500" />;
  if (kind === "image") return <FileImage className="h-5 w-5 text-indigo-500" />;
  return <FileText className="h-5 w-5 text-rose-500" />;
}

export function NotesModal() {
  const { currentSubject, modals, setModals, showNotification } = useApp();
  const [permission, setPermission] = useState<PermissionState>("loading");
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [telemetry, setTelemetry] = useState<UploadTelemetry | null>(null);
  const [playerResource, setPlayerResource] = useState<LessonResource | null>(null);
  const [activeTab, setActiveTab] = useState<"resources" | "videos">("resources");
  const controlsRef = useRef<UploadTaskControls | null>(null);
  const uploadStartedAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const topic = modals.playlist.topic;
  const lessonId = useMemo(() => normalizeLessonId(topic), [topic]);
  const canManageLessonResources = permission === "allowed";
  const fileResources = useMemo(() => resources.filter((resource) => resource.mediaKind !== "video"), [resources]);
  const videoResources = useMemo(() => resources.filter((resource) => resource.mediaKind === "video"), [resources]);
  const visibleResources = activeTab === "videos" ? videoResources : fileResources;

  const loadResources = async () => {
    if (!modals.playlist.open || !lessonId) return;
    setIsLoadingResources(true);
    try {
      const response = await apiFetch(`/api/lesson-resources?subject=${encodeURIComponent(currentSubject.toUpperCase())}&lessonId=${encodeURIComponent(lessonId)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload?.resources)) {
        throw new Error(payload?.message || "Lesson resources could not be loaded.");
      }
      setPermission(payload.canManageLessonResources === true ? "allowed" : "denied");
      setResources(payload.resources.map((resource: any): LessonResource => ({
        id: resource.id,
        sourceId: resource.sourceId,
        videoId: resource.videoId || undefined,
        url: resource.videoId ? `video://${resource.videoId}` : String(resource.storagePath || resource.sourceId || ""),
        title: normalizeRepeatedExtension(resource.title || resource.fileName || "Lesson resource"),
        type: resource.mimeType || undefined,
        mimeType: resource.mimeType || undefined,
        mediaKind: resource.mediaKind || (resource.videoId ? "video" : "pdf"),
        resourceRole: resource.videoId ? "video" : resource.mediaKind === "image" ? "image" : "student_note",
        storagePath: resource.storagePath || undefined,
        status: resource.processingStatus || "ready",
        sizeBytes: Number(resource.sizeBytes || 0) || undefined,
        createdAt: resource.createdAt,
        displayPriority: Number(resource.displayPriority || 0),
      })));
    } catch (error: any) {
      setResources([]);
      if (permission === "loading") setPermission("unavailable");
      showNotification(error?.message || "Lesson resources could not be loaded.", "error");
    } finally {
      setIsLoadingResources(false);
    }
  };

  useEffect(() => {
    if (!modals.playlist.open) return;
    let active = true;
    setPermission("loading");
    const verifyPermission = async () => {
      try {
        const response = await apiFetch("/api/auth/context");
        const payload = await response.json().catch(() => null);
        if (!active) return;
        setPermission(response.ok && payload?.capabilities?.canManageLessonResources === true ? "allowed" : "denied");
      } catch {
        if (active) setPermission("unavailable");
      }
    };
    void verifyPermission().then(() => { if (active) return loadResources(); });
    const unsubscribe = auth?.onAuthStateChanged?.(() => void verifyPermission().then(() => { if (active) return loadResources(); }));
    return () => { active = false; unsubscribe?.(); };
  }, [currentSubject, lessonId, modals.playlist.open]);

  useEffect(() => {
    if (!modals.playlist.open) return;
    const timer = window.setInterval(() => void loadResources(), 30_000);
    return () => window.clearInterval(timer);
  }, [currentSubject, lessonId, modals.playlist.open]);

  if (!modals.playlist.open) return null;

  const close = () => {
    if (isUploading && !confirm("An upload is still running. Cancel it and close?")) return;
    controlsRef.current?.cancel();
    setModals((previous) => ({ ...previous, playlist: { open: false, topic: "" } }));
  };

  const updateProgress = (fileName: string) => (snapshot: UploadProgressSnapshot) => {
    const elapsedSeconds = Math.max(0.25, (performance.now() - uploadStartedAtRef.current) / 1000);
    const speed = snapshot.bytesTransferred / elapsedSeconds;
    const remaining = Math.max(0, snapshot.totalBytes - snapshot.bytesTransferred);
    setTelemetry({
      ...snapshot,
      fileName,
      speedBytesPerSecond: speed,
      remainingBytes: remaining,
      etaSeconds: speed > 1024 ? remaining / speed : null,
    });
    setIsPaused(snapshot.state === "paused");
  };

  const processFile = async (file: File) => {
    if (isUploading) return;
    if (!canManageLessonResources) {
      showNotification("You do not have permission to manage lesson resources.", "error");
      return;
    }

    const mediaKind = getMediaKind(file);
    if (!["pdf", "image", "video"].includes(mediaKind)) {
      showNotification("Use PDF, PNG, JPEG, WebP, MP4, MOV, or WebM files.", "error");
      return;
    }
    const maxBytes = mediaKind === "video" ? 10 * 1024 * 1024 * 1024 : mediaKind === "pdf" ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      showNotification(`The file exceeds the ${mediaKind === "video" ? "10 GB" : mediaKind === "pdf" ? "50 MB" : "20 MB"} limit.`, "error");
      return;
    }

    setIsUploading(true);
    setIsPaused(false);
    uploadStartedAtRef.current = performance.now();
    updateProgress(file.name)({ bytesTransferred: 0, totalBytes: file.size, progress: 0, state: "running" });

    try {
      if (mediaKind === "video") {
        const result = await createAndUploadSecureVideo({
          file,
          metadata: {
            title: normalizeRepeatedExtension(file.name.replace(/\.[^.]+$/, "")),
            subject: currentSubject,
            lesson: topic,
            lessonId,
            visibility: "class",
          } as any,
          onProgress: updateProgress(file.name),
          onTask: (controls) => { controlsRef.current = controls; },
        });
        showNotification(result.transcodeQueued ? "Video uploaded. Secure processing has started." : "Video uploaded and ready to play.", "success");
      } else {
        const upload = await uploadPdfWithClientStorage({
          file,
          subject: currentSubject,
          lesson: topic,
          resourceType: "paper_structure",
          sourceScope: "paper_structure",
          sourceType: mediaKind,
          onProgress: updateProgress(file.name),
          onTask: (controls) => { controlsRef.current = controls; },
        });
        const response = await apiFetch("/api/pdf/process-uploaded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: normalizeRepeatedExtension(file.name),
            fileName: normalizeRepeatedExtension(file.name),
            subject: currentSubject,
            lesson: topic,
            lessonId,
            resourceType: "paper_structure",
            sourceType: mediaKind,
            sourceScope: "paper_structure",
            sourceId: upload.sourceId,
            storagePath: upload.storagePath,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok && response.status !== 202) {
          throw new Error(payload?.message || payload?.error || "Resource processing failed.");
        }
        showNotification(response.status === 202 ? "The scanned document is being processed." : "Lesson resource uploaded successfully.", "success");
      }
      await loadResources();
    } catch (error: any) {
      if (error?.name !== "AbortError" && error?.code !== "storage/canceled") {
        showNotification(error?.message || "The file could not be uploaded.", "error");
      }
    } finally {
      setIsUploading(false);
      setIsPaused(false);
      controlsRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openResource = async (resource: LessonResource) => {
    if (resource.mediaKind === "video" && resource.videoId) {
      if (resource.status !== "ready") {
        showNotification(`Video is still processing (${resource.status || "pending"}).`, "info");
        return;
      }
      setPlayerResource(resource);
      return;
    }
    if (resource.storagePath) await openPrivateStoragePdf(resource.storagePath);
  };

  const updateResourcePriority = async (resource: LessonResource, displayPriority: number) => {
    if (!canManageLessonResources || !resource.id) return;
    try {
      const response = await apiFetch(`/api/lesson-resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayPriority }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "Priority could not be updated.");
      setResources((current) => current
        .map((item) => item.id === resource.id ? { ...item, displayPriority } : item)
        .sort((left, right) => Number(right.displayPriority || 0) - Number(left.displayPriority || 0) || Date.parse(String(right.createdAt || 0)) - Date.parse(String(left.createdAt || 0))));
      showNotification("Resource priority updated.", "success");
    } catch (error: any) {
      showNotification(error?.message || "Priority could not be updated.", "error");
    }
  };

  const deleteResource = async (resource: LessonResource) => {
    if (!canManageLessonResources || !resource.id || !confirm(`Delete “${resource.title}”?`)) return;
    try {
      const response = await apiFetch(`/api/lesson-resources/${resource.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "The resource could not be deleted.");
      setResources((current) => current.filter((item) => item.id !== resource.id));
      showNotification("Resource deleted.", "success");
    } catch (error: any) {
      showNotification(error?.message || "The resource could not be deleted.", "error");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-slate-950/35 p-2 backdrop-blur-sm sm:items-center sm:p-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.99 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="flex max-h-[88dvh] w-[calc(100vw-16px)] max-w-4xl min-w-0 flex-col overflow-hidden rounded-t-[20px] border border-white/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:max-h-[92dvh] sm:w-full sm:rounded-[28px]"
        >
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black tracking-wide text-slate-800">Lesson resources</h2>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{currentSubject.toUpperCase()} · {topic}</p>
            </div>
            <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label="Close resources"><X className="h-5 w-5" /></button>
          </div>

          <div className="clora-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white p-4 sm:p-6">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="inline-flex min-w-0 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Lesson resource type">
                <button type="button" role="tab" aria-selected={activeTab === "resources"} onClick={() => setActiveTab("resources")} className={`rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 ${activeTab === "resources" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Resources ({fileResources.length})</button>
                <button type="button" role="tab" aria-selected={activeTab === "videos"} onClick={() => setActiveTab("videos")} className={`rounded-lg px-3 py-2 text-xs font-bold transition-all sm:px-4 ${activeTab === "videos" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Videos ({videoResources.length})</button>
              </div>

              {canManageLessonResources && (
                <>
                  <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); }} className="hidden" id="lesson-resource-upload" disabled={isUploading} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4">
                    <UploadCloud className="h-4 w-4" /> <span className="hidden sm:inline">{isUploading ? `${Math.round((telemetry?.progress || 0) * 100)}%` : "Upload"}</span>
                  </button>
                </>
              )}
            </div>

            {isUploading && telemetry && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{telemetry.fileName}</p><p className="mt-1 text-xs font-semibold text-blue-600">{telemetry.state === "paused" ? "Paused" : "Uploading securely"}</p></div>
                  <span className="shrink-0 text-lg font-black text-indigo-700">{Math.round(telemetry.progress * 100)}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-500 transition-[width] duration-300" style={{ width: `${Math.max(1, telemetry.progress * 100)}%` }} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                  <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">Uploaded</span><strong className="text-slate-700">{formatBytes(telemetry.bytesTransferred)} / {formatBytes(telemetry.totalBytes)}</strong></div>
                  <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">Remaining</span><strong className="text-slate-700">{formatBytes(telemetry.remainingBytes)}</strong></div>
                  <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">Speed</span><strong className="text-slate-700">{formatBytes(telemetry.speedBytesPerSecond)}/s</strong></div>
                  <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">ETA</span><strong className="text-slate-700">{formatEta(telemetry.etaSeconds)}</strong></div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => { const changed = isPaused ? controlsRef.current?.resume() : controlsRef.current?.pause(); if (changed) setIsPaused(!isPaused); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">{isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} {isPaused ? "Resume" : "Pause"}</button>
                  <button type="button" onClick={() => controlsRef.current?.cancel()} className="min-h-10 rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">Cancel</button>
                </div>
              </div>
            )}

            <div
              onDragEnter={(event) => { if (!canManageLessonResources) return; event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => { if (canManageLessonResources) event.preventDefault(); }}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
              onDrop={(event) => { if (!canManageLessonResources) return; event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void processFile(file); }}
              className={`mt-4 min-w-0 rounded-2xl transition ${isDragging ? "bg-slate-50 ring-2 ring-slate-300 ring-offset-2" : "bg-white"}`}
            >
              {isLoadingResources ? (
                <div className="py-10 text-center text-sm font-semibold text-slate-400">Loading resources…</div>
              ) : visibleResources.length === 0 ? (
                <div className="flex w-full flex-col items-center py-10 text-center">
                  <ResourceIcon kind={activeTab === "videos" ? "video" : "pdf"} />
                  <span className="mt-3 text-sm font-bold text-slate-500">No {activeTab === "videos" ? "videos" : "resources"} have been added to this lesson.</span>
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={activeTab} initial={{ opacity: 0, x: activeTab === "videos" ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: activeTab === "videos" ? -10 : 10 }} className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                    {visibleResources.map((resource) => (
                      <div key={resource.id || resource.videoId || resource.sourceId || resource.storagePath || resource.title} className="group relative flex min-w-0 items-center">
                        <button type="button" onClick={() => void openResource(resource)} className={`flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm ${canManageLessonResources ? "pr-36" : "pr-3"}`}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><ResourceIcon kind={resource.mediaKind} /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-800">{resource.title}</span><span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{mediaKindLabel(resource.mediaKind)}{resource.sizeBytes ? ` · ${formatBytes(resource.sizeBytes)}` : ""}{resource.status && resource.status !== "ready" ? ` · ${resource.status}` : ""}{resource.createdAt ? ` · ${new Date(resource.createdAt).toLocaleString()}` : ""}</span></span>
                        </button>
                        {canManageLessonResources && (
                          <div className="absolute right-2 flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <label className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500" title="Higher priority resources appear first">
                              <span className="sr-only">Display priority</span>
                              <select value={Number(resource.displayPriority || 0)} onChange={(event) => void updateResourcePriority(resource, Number(event.target.value))} className="bg-transparent text-[10px] font-black text-slate-700 outline-none" aria-label={`Display priority for ${resource.title}`}>
                                {![100, 50, 25, 10, 0, -25, -50].includes(Number(resource.displayPriority || 0)) && <option value={Number(resource.displayPriority || 0)}>{Number(resource.displayPriority || 0)}</option>}
                                {[100, 50, 25, 10, 0, -25, -50].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                              </select>
                            </label>
                            <button type="button" onClick={() => void deleteResource(resource)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label={`Delete ${resource.title}`}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {playerResource?.videoId && <SecureVideoPlayer videoId={playerResource.videoId} title={playerResource.title} onClose={() => setPlayerResource(null)} />}
    </AnimatePresence>
  );
}
