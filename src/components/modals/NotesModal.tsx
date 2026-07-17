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
import { SecureVideoPlayer } from "../video/SecureVideoPlayer";

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
  return `${minutes} min ${seconds} sec`;
}

function mediaKindLabel(kind?: LessonResourceKind) {
  if (kind === "video") return "Video";
  if (kind === "image") return "Image";
  if (kind === "audio") return "Audio";
  if (kind === "pdf") return "PDF";
  if (kind === "link") return "Link";
  return "File";
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

function normalizeLessonKey(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
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
  const [activeTab, setActiveTab] = useState<"resources" | "videos">("resources");
  const [catalogVideos, setCatalogVideos] = useState<LessonResource[]>([]);
  const controlsRef = useRef<UploadTaskControls | null>(null);
  const uploadStartedAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = videoPermission === "allowed";

  const topic = modals.playlist.topic;
  const topicData = data[currentSubject]?.topics[topic];
  const resources = useMemo(() => {
    const local = (topicData?.resources?.length ? topicData.resources : topicData?.videos || []).map(normalizeLegacyResource);
    const merged = new Map<string, LessonResource>();
    [...local, ...catalogVideos].forEach((resource) => {
      const key = String(resource.videoId || resource.sourceId || resource.id || resource.storagePath || resource.title);
      if (key) merged.set(key, { ...(merged.get(key) || {}), ...resource });
    });
    return Array.from(merged.values());
  }, [topicData?.resources, topicData?.videos, catalogVideos]);
  const fileResources = useMemo(() => resources.filter((resource) => resource.mediaKind !== "video"), [resources]);
  const videoResources = useMemo(() => resources.filter((resource) => resource.mediaKind === "video"), [resources]);
  const visibleResources = activeTab === "videos" ? videoResources : fileResources;

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

  useEffect(() => {
    if (!modals.playlist.open || videoPermission === "loading") return;
    let active = true;
    const hydrateVideos = async () => {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return;
      try {
        const response = await apiFetch(videoPermission === "allowed" ? "/api/admin/videos" : "/api/videos");
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload?.videos) || !active) return;
        const matching = payload.videos
          .filter((video: any) => String(video.subject || "").toUpperCase() === currentSubject.toUpperCase()
            && normalizeLessonKey(video.lesson) === normalizeLessonKey(topic)
            && video.status !== "archived")
          .map((video: any): LessonResource => ({
            id: video.id,
            videoId: video.id,
            sourceId: video.sourceId,
            url: `video://${video.id}`,
            title: video.title || "Lesson video",
            type: video.mimeType || "video/mp4",
            mimeType: video.mimeType || "video/mp4",
            mediaKind: "video",
            resourceRole: "video",
            status: video.status,
            sizeBytes: Number(video.sourceSizeBytes || 0) || undefined,
            createdAt: video.createdAt,
          }));
        setCatalogVideos(matching);
      } catch {
        // Local lesson metadata remains available when the catalog is offline.
      }
    };
    void hydrateVideos();
    const timer = window.setInterval(hydrateVideos, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [currentSubject, modals.playlist.open, topic, videoPermission]);

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
    nextTopic.videos = nextResources.filter((item) => normalizeLegacyResource(item).mediaKind === "video");
    nextData[currentSubject].topics[topic] = nextTopic;
    saveData(nextData);
  };

  const processFile = async (file: File) => {
    if (isUploading) return;
    const mediaKind = getMediaKind(file);
    const maxBytes = mediaKind === "video" ? 10 * 1024 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      showNotification(`Invalid file size. The maximum is ${mediaKind === "video" ? "10 GB" : "50 MB"}.`, "error");
      return;
    }
    if (mediaKind === "video" && videoPermission !== "allowed") {
      if (videoPermission === "loading") {
        showNotification("Checking video upload permission. Try again in a moment.", "info");
      } else if (videoPermission === "unavailable") {
        showNotification("Video permission could not be verified. Check your connection and try again.", "error");
      } else {
        showNotification("Only an administrator or content editor can upload lesson videos.", "error");
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
        showNotification(error?.message || "Unable to upload the file", "error");
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
        showNotification(`Video is still processing (${liveStatus || "pending"}).`, "info");
        return;
      }
      setPlayerResource({ ...resource, status: "ready" });
      return;
    }
    if (resource.url?.startsWith("http")) window.open(resource.url, "_blank", "noopener,noreferrer");
    else if (resource.storagePath) void openPrivateStoragePdf(resource.storagePath);
  };

  const deleteResource = async (resource: LessonResource) => {
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
      const resourceKey = String(resource.videoId || resource.sourceId || resource.id || resource.storagePath || resource.title);
      const localResources = [
        ...(nextTopic.resources || []),
        ...(nextTopic.videos || []),
      ].map(normalizeLegacyResource);
      const nextResources = localResources.filter((item) => (
        String(item.videoId || item.sourceId || item.id || item.storagePath || item.title) !== resourceKey
      ));
      nextTopic.resources = nextResources;
      nextTopic.videos = nextResources.filter((item) => normalizeLegacyResource(item).mediaKind === "video");
      saveData(nextData);
      setCatalogVideos((current) => current.filter((item) => (
        String(item.videoId || item.sourceId || item.id || item.storagePath || item.title) !== resourceKey
      )));
      showNotification("Resource deleted.", "success");
    } catch (error: any) {
      showNotification(error?.message || "Unable to delete the resource", "error");
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:p-6">
        <motion.div initial={{ opacity: 0, scale: 0.97, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 14 }} transition={{ type: "spring", damping: 28, stiffness: 320 }} className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
            <div>
              <h2 className="text-sm font-black tracking-wide text-slate-800">Lesson resources</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">{currentSubject.toUpperCase()} · {topic}</p>
            </div>
            <button onClick={close} className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label="Close resources"><X className="h-5 w-5" /></button>
          </div>

          <div className="clora-scrollbar min-h-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6">
            <section>
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Lesson resource type">
                  <button type="button" role="tab" aria-selected={activeTab === "resources"} onClick={() => setActiveTab("resources")} className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === "resources" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Resources ({fileResources.length})</button>
                  <button type="button" role="tab" aria-selected={activeTab === "videos"} onClick={() => setActiveTab("videos")} className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === "videos" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>Videos ({videoResources.length})</button>
                </div>
                <input ref={fileInputRef} type="file" accept="application/pdf,image/*,audio/*,video/mp4,video/quicktime,video/webm,.doc,.docx,.ppt,.pptx,.txt" onChange={handleFileInput} className="hidden" id="lesson-resource-upload" disabled={isUploading} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60">
                  <UploadCloud className="h-4 w-4" /> {isUploading ? `${Math.round((telemetry?.progress || 0) * 100)}%` : isAdmin ? "Upload resource / video" : videoPermission === "loading" ? "Checking permission…" : "Upload PDF / image"}
                </button>
              </div>

              {isUploading && telemetry && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{telemetry.fileName}</p>
                      <p className="mt-1 text-xs font-semibold text-blue-600">{telemetry.state === "paused" ? "Paused" : "Uploading securely"}</p>
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

              <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void processFile(file); }} className={`mt-4 rounded-2xl p-0 transition ${isDragging ? "bg-slate-50 ring-2 ring-slate-300 ring-offset-2" : "bg-white"}`}>
                {visibleResources.length === 0 ? (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center py-8 text-center">
                    <UploadCloud className="mb-3 h-8 w-8 text-slate-300" />
                    <span className="text-sm font-bold text-slate-500">No {activeTab === "videos" ? "videos" : "resources"} have been added to this lesson.</span>
                  </button>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={activeTab} initial={{ opacity: 0, x: activeTab === "videos" ? 12 : -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: activeTab === "videos" ? -12 : 12 }} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {visibleResources.map((resource) => {
                      return <div key={resource.videoId || resource.id || resource.sourceId || resource.storagePath || resource.title} className="group flex min-w-0 items-center gap-2">
                        <button type="button" onClick={() => void openResource(resource)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100"><ResourceIcon kind={resource.mediaKind} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-800 group-hover:text-indigo-700">{resource.title}</span>
                            <span className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {mediaKindLabel(resource.mediaKind)}
                              {resource.sizeBytes ? ` · ${formatBytes(resource.sizeBytes)}` : ""}
                            </span>
                          </span>
                        </button>
                        {isAdmin && <button type="button" onClick={() => void deleteResource(resource)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label={`Delete ${resource.title}`}><i className="fa-regular fa-trash-can text-sm" /></button>}
                      </div>
                    })}
                  </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
      {playerResource?.videoId && (
        <SecureVideoPlayer videoId={playerResource.videoId} title={playerResource.title} onClose={() => setPlayerResource(null)} />
      )}
    </AnimatePresence>
  );
}
