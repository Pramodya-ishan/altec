import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioLines, FileImage, FileText, Film, Link2, Pause, Play, UploadCloud, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import type { LessonResource, LessonResourceKind } from "../../types";
import { auth } from "../../lib/firebase";
import { apiFetch } from "../../lib/api";
import {
  deletePrivateStorageObject,
  openPrivateStoragePdf,
  uploadPdfWithClientStorage,
  type UploadProgressSnapshot,
  type UploadTaskControls,
} from "../../lib/clientStorageUpload";
import { createAndUploadSecureVideo } from "../../lib/videoUpload";

const SecureVideoPlayer = React.lazy(() => import("../video/SecureVideoPlayer").then((module) => ({ default: module.SecureVideoPlayer })));

type UploadTelemetry = UploadProgressSnapshot & {
  speedBytesPerSecond: number;
  remainingBytes: number;
  etaSeconds: number | null;
  fileName: string;
};

type VideoPermissionState = "loading" | "allowed" | "denied" | "unavailable";

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
  return `${minutes}m ${seconds}s`;
}

function getMediaKind(file: File): LessonResourceKind {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type === "application/pdf") return "pdf";
  return "document";
}

function normalizeLegacyResource(resource: LessonResource): LessonResource {
  const lower = `${resource.mimeType || resource.type || ""} ${resource.title || ""}`.toLowerCase();
  const mediaKind = resource.mediaKind
    || (lower.includes("video") || /\.(mp4|mov|webm|m4v)$/.test(lower) ? "video"
      : lower.includes("pdf") || lower.endsWith(".pdf") ? "pdf"
      : lower.includes("image") || /\.(png|jpe?g|webp|gif)$/.test(lower) ? "image"
      : lower.includes("audio") || /\.(mp3|m4a|wav|ogg)$/.test(lower) ? "audio"
      : "document");
  return { ...resource, mediaKind, mimeType: resource.mimeType || resource.type, sourceId: resource.sourceId || (!resource.url?.startsWith("http") ? resource.url : undefined) };
}

function ResourceIcon({ kind }: { kind?: LessonResourceKind }) {
  const className = "h-5 w-5";
  if (kind === "video") return <Film className={`${className} text-violet-500`} />;
  if (kind === "image") return <FileImage className={`${className} text-indigo-500`} />;
  if (kind === "audio") return <AudioLines className={`${className} text-emerald-500`} />;
  if (kind === "link") return <Link2 className={`${className} text-sky-500`} />;
  return <FileText className={`${className} ${kind === "pdf" ? "text-rose-500" : "text-slate-500"}`} />;
}

export function NotesModal() {
  const { data, saveData, currentSubject, modals, setModals, showNotification } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [videoPermission, setVideoPermission] = useState<VideoPermissionState>("loading");
  const [isPaused, setIsPaused] = useState(false);
  const [telemetry, setTelemetry] = useState<UploadTelemetry | null>(null);
  const [playerResource, setPlayerResource] = useState<LessonResource | null>(null);
  const controlsRef = useRef<UploadTaskControls | null>(null);
  const uploadStartedAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = videoPermission === "allowed";

  const topic = modals.playlist.topic;
  const topicData = data[currentSubject]?.topics[topic];
  const resources = useMemo(
    () => (topicData?.resources?.length ? topicData.resources : topicData?.videos || []).map(normalizeLegacyResource),
    [topicData?.resources, topicData?.videos],
  );

  useEffect(() => {
    if (!modals.playlist.open) return;
    let active = true;
    const resolveRole = async () => {
      if (active) setVideoPermission("loading");
      try {
        const user = auth?.currentUser;
        if (!user || user.isAnonymous) {
          if (active) {
            setVideoPermission("denied");
          }
          return;
        }

        const token = await user.getIdTokenResult().catch(() => null);
        const roles = Array.isArray(token?.claims?.roles) ? token.claims.roles as unknown[] : [];
        const claimAllowsUpload = token?.claims?.admin === true
          || roles.some((role) => ["admin", "content_editor", "ops"].includes(String(role)));
        if (claimAllowsUpload) {
          if (active) {
            setVideoPermission("allowed");
          }
          return;
        }

        const response = await apiFetch("/api/auth/context");
        const context = await response.json().catch(() => null);
        const serverRoles = Array.isArray(context?.roles) ? context.roles : [];
        const serverAllowsUpload = response.ok
          && (context?.capabilities?.canUploadVideo === true
            || serverRoles.some((role: string) => ["admin", "content_editor", "ops"].includes(role)));
        if (active) {
          setVideoPermission(response.ok ? (serverAllowsUpload ? "allowed" : "denied") : (response.status === 401 || response.status === 403 ? "denied" : "unavailable"));
        }
      } catch {
        if (active) {
          setVideoPermission("unavailable");
        }
      }
    };
    void resolveRole();
    const unsubscribe = auth?.onAuthStateChanged?.(() => void resolveRole());
    return () => { active = false; unsubscribe?.(); };
  }, [modals.playlist.open]);

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

  const appendResource = (resource: LessonResource) => {
    const nextData = structuredClone(data);
    const nextTopic = nextData[currentSubject].topics[topic] || { checked: false, videos: [] };
    const current = (nextTopic.resources?.length ? nextTopic.resources : nextTopic.videos || []).map(normalizeLegacyResource);
    const nextResources = [...current, resource];
    nextTopic.resources = nextResources;
    nextTopic.videos = nextResources;
    nextData[currentSubject].topics[topic] = nextTopic;
    saveData(nextData);
  };

  const processFile = async (file: File) => {
    if (isUploading) return;
    const mediaKind = getMediaKind(file);
    const maxBytes = mediaKind === "video" ? 10 * 1024 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      showNotification(`File size is invalid. ${mediaKind === "video" ? "10 GB" : "50 MB"} limit.`, "error");
      return;
    }
    if (mediaKind === "video" && videoPermission !== "allowed") {
      if (videoPermission === "loading") {
        showNotification("Checking video upload permission. Please try again in a moment.", "info");
      } else if (videoPermission === "unavailable") {
        showNotification("Could not verify video upload permission. Check your connection and retry.", "error");
      } else {
        showNotification("Only an admin or content editor can upload lesson videos.", "error");
      }
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
          metadata: { title: file.name.replace(/\.[^.]+$/, ""), subject: currentSubject, lesson: topic, visibility: "class" },
          onProgress: updateProgress(file.name),
          onTask: (controls) => { controlsRef.current = controls; },
        });
        appendResource({
          id: result.videoId,
          videoId: result.videoId,
          sourceId: result.sourceId,
          url: `video://${result.videoId}`,
          title: file.name,
          type: file.type,
          mimeType: file.type,
          mediaKind: "video",
          resourceRole: "video",
          storagePath: result.storagePath,
          status: result.status || "uploaded",
          sizeBytes: file.size,
          createdAt: new Date().toISOString(),
        });
        showNotification(result.transcodeQueued ? "Video uploaded. Secure processing has started." : "Video uploaded. Transcoding is waiting for cloud configuration.", "success");
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

        let processed: any = { sourceId: upload.sourceId, storagePath: upload.storagePath };
        if (mediaKind === "pdf") {
          const response = await apiFetch("/api/pdf/process-uploaded", {
            method: "POST",
            body: JSON.stringify({
              title: file.name,
              fileName: file.name,
              subject: currentSubject,
              lesson: topic,
              resourceType: "paper_structure",
              sourceType: mediaKind,
              sourceScope: "paper_structure",
              sourceId: upload.sourceId,
              storagePath: upload.storagePath,
            }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.ok) throw new Error(payload?.message || payload?.error || "Resource processing failed");
          processed = payload;
        }

        appendResource({
          id: processed.sourceId || upload.sourceId,
          sourceId: processed.sourceId || upload.sourceId,
          url: processed.sourceId || upload.sourceId,
          title: file.name,
          type: file.type,
          mimeType: file.type,
          mediaKind,
          resourceRole: mediaKind === "image" ? "image" : mediaKind === "audio" ? "audio" : "student_note",
          storagePath: processed.storagePath || upload.storagePath,
          status: mediaKind === "pdf" ? (processed.status || "queued") : "ready",
          sizeBytes: file.size,
          createdAt: new Date().toISOString(),
        });
        showNotification("Lesson resource uploaded successfully.", "success");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError" && error?.code !== "storage/canceled") {
        console.error(error);
        showNotification(error?.message || "Upload failed", "error");
      }
    } finally {
      setIsUploading(false);
      setIsPaused(false);
      controlsRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  };

  const openResource = async (resource: LessonResource) => {
    if (resource.mediaKind === "video" && resource.videoId) {
      const endpoint = isAdmin ? `/api/admin/videos/${resource.videoId}` : `/api/videos/${resource.videoId}`;
      const response = await apiFetch(endpoint);
      const payload = await response.json().catch(() => null);
      const liveStatus = payload?.video?.status || resource.status;
      if (!response.ok || liveStatus !== "ready") {
        showNotification(`Video status: ${liveStatus || "processing"}. It can be played after secure processing finishes.`, "info");
        return;
      }
      setPlayerResource({ ...resource, status: "ready" });
      return;
    }
    if (resource.url?.startsWith("http")) window.open(resource.url, "_blank", "noopener,noreferrer");
    else if (resource.storagePath) void openPrivateStoragePdf(resource.storagePath);
  };

  const deleteResource = async (resource: LessonResource, index: number) => {
    if (!isAdmin || !confirm(`Delete “${resource.title}”?`)) return;
    try {
      if (resource.mediaKind === "video" && resource.videoId) {
        const response = await apiFetch(`/api/admin/videos/${resource.videoId}`, { method: "DELETE" });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || "Video archive failed");
      } else {
        if (resource.sourceId) await apiFetch(`/api/rag/sources/${resource.sourceId}`, { method: "DELETE" });
        if (resource.storagePath) await deletePrivateStorageObject(resource.storagePath).catch(() => undefined);
      }
      const nextData = structuredClone(data);
      const nextTopic = nextData[currentSubject].topics[topic];
      const nextResources = resources.filter((_, resourceIndex) => resourceIndex !== index);
      nextTopic.resources = nextResources;
      nextTopic.videos = nextResources;
      saveData(nextData);
      showNotification("Resource removed.", "success");
    } catch (error: any) {
      showNotification(error?.message || "Delete failed", "error");
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm sm:p-6">
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 18 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[86vh]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Lesson Resources</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">{currentSubject.toUpperCase()} · {topic}</p>
            </div>
            <button onClick={close} className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label="Close resources"><X className="h-5 w-5" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">PDFs, images, audio & secure videos</h3>
                  <p className="mt-1 text-xs text-slate-400">Video files use resumable private upload and secure processing.</p>
                </div>
                <input ref={fileInputRef} type="file" accept="application/pdf,image/*,audio/*,video/mp4,video/quicktime,video/webm,.doc,.docx,.ppt,.pptx,.txt" onChange={handleFileInput} className="hidden" id="lesson-resource-upload" disabled={isUploading} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60">
                  <UploadCloud className="h-4 w-4" /> {isUploading ? `${Math.round((telemetry?.progress || 0) * 100)}% uploading` : isAdmin ? "Upload resource / video" : videoPermission === "loading" ? "Checking upload access…" : "Upload PDF / image"}
                </button>
              </div>

              {isUploading && telemetry && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{telemetry.fileName}</p>
                      <p className="mt-1 text-xs font-semibold text-indigo-600">{telemetry.state === "paused" ? "Paused" : "Uploading securely"}</p>
                    </div>
                    <span className="text-lg font-black text-indigo-700">{Math.round(telemetry.progress * 100)}%</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300" style={{ width: `${Math.max(1, telemetry.progress * 100)}%` }} /></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">Uploaded</span><strong className="text-slate-700">{formatBytes(telemetry.bytesTransferred)} / {formatBytes(telemetry.totalBytes)}</strong></div>
                    <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">Remaining</span><strong className="text-slate-700">{formatBytes(telemetry.remainingBytes)}</strong></div>
                    <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">Speed</span><strong className="text-slate-700">{formatBytes(telemetry.speedBytesPerSecond)}/s</strong></div>
                    <div className="rounded-lg bg-white/80 p-2"><span className="block text-slate-400">ETA</span><strong className="text-slate-700">{formatEta(telemetry.etaSeconds)}</strong></div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => { const changed = isPaused ? controlsRef.current?.resume() : controlsRef.current?.pause(); if (changed) setIsPaused(!isPaused); }} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                      {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />} {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button type="button" onClick={() => controlsRef.current?.cancel()} className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700">Cancel</button>
                  </div>
                </div>
              )}

              <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void processFile(file); }} className={`mt-4 rounded-2xl border-2 border-dashed p-4 transition ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/60"}`}>
                {resources.length === 0 ? (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center py-8 text-center">
                    <UploadCloud className="mb-3 h-8 w-8 text-slate-300" />
                    <span className="text-sm font-bold text-slate-500">Drop a lesson resource here or click to browse</span>
                    <span className="mt-1 text-xs text-slate-400">PDF, image, audio, document{isAdmin ? " or video" : ""}</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {resources.map((resource, index) => (
                      <div key={resource.id || resource.sourceId || `${resource.title}-${index}`} className="group flex min-w-0 items-center gap-2">
                        <button type="button" onClick={() => void openResource(resource)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:shadow-md">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100"><ResourceIcon kind={resource.mediaKind} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-800 group-hover:text-indigo-700">{resource.title}</span>
                            <span className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {resource.mediaKind || "document"}
                              {resource.sizeBytes ? ` · ${formatBytes(resource.sizeBytes)}` : ""}
                              {resource.status && <em className={`not-italic ${resource.status === "failed" ? "text-rose-500" : resource.status === "ready" ? "text-emerald-600" : "text-amber-600"}`}>· {resource.status}</em>}
                            </span>
                          </span>
                        </button>
                        {isAdmin && <button type="button" onClick={() => void deleteResource(resource, index)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label={`Delete ${resource.title}`}><i className="fa-regular fa-trash-can text-sm" /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
      {playerResource?.videoId && (
        <React.Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 text-sm font-bold text-white">Loading secure player…</div>}>
          <SecureVideoPlayer videoId={playerResource.videoId} title={playerResource.title} onClose={() => setPlayerResource(null)} />
        </React.Suspense>
      )}
    </AnimatePresence>
  );
}
