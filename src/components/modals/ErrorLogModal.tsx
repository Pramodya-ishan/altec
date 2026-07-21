import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Camera, ImagePlus, Images, LoaderCircle, Save, Trash2, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { apiFetch } from "../../lib/api";
import {
  uploadImageWithClientStorage,
  type UploadProgressSnapshot,
  type UploadTaskControls,
} from "../../lib/clientStorageUpload";

interface ErrorLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogged?: () => void;
}

type QueuedImage = { id: string; file: File; preview: string };

const LESSON_SUGGESTIONS: Record<string, string[]> = {
  SFT: ["තරල", "විද්‍යුතය", "කෘෂි තාක්ෂණය", "ආහාර තාක්ෂණය"],
  ET: ["ඉලෙක්ට්‍රොනික විද්‍යාව", "විදුලි තාක්ෂණය", "සිවිල් ඉංජිනේරු තාක්ෂණය", "යාන්ත්‍රික පද්ධති"],
  ICT: ["ජාලකරණය", "දත්ත සමුදා", "Python", "වෙබ් සංවර්ධනය"],
};

const MAX_BULK_IMAGES = 24;

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function ErrorLogModal({ isOpen, onClose, onLogged }: ErrorLogModalProps) {
  const { user, currentSubject, showNotification } = useApp();
  const [subject, setSubject] = useState(currentSubject.toUpperCase());
  const [lesson, setLesson] = useState("");
  const [errorText, setErrorText] = useState("");
  const [images, setImages] = useState<QueuedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgressSnapshot | null>(null);
  const [activeFileName, setActiveFileName] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const controlsRef = useRef<UploadTaskControls | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) setSubject(currentSubject.toUpperCase());
  }, [isOpen, currentSubject]);

  useEffect(() => () => {
    images.forEach((item) => URL.revokeObjectURL(item.preview));
  }, []);

  const totalBytes = useMemo(() => images.reduce((sum, item) => sum + item.file.size, 0), [images]);

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return current.filter((item) => item.id !== id);
    });
  };

  const clearImages = () => {
    setImages((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
    setProgress(null);
    setActiveFileName("");
    setSavedCount(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const addImages = (files: File[]) => {
    const accepted = files.filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type) && file.size > 0 && file.size <= 10 * 1024 * 1024);
    const rejected = files.length - accepted.length;
    setImages((current) => {
      const existing = new Set(current.map((item) => fileKey(item.file)));
      const available = Math.max(0, MAX_BULK_IMAGES - current.length);
      const next = accepted
        .filter((file) => !existing.has(fileKey(file)))
        .slice(0, available)
        .map((file, index) => ({ id: `${Date.now()}-${index}-${fileKey(file)}`, file, preview: URL.createObjectURL(file) }));
      if (accepted.length > next.length + accepted.filter((file) => existing.has(fileKey(file))).length) {
        showNotification(`Error Log එකකට images ${MAX_BULK_IMAGES}ක් දක්වා bulk upload කරන්න පුළුවන්.`, "info");
      }
      return [...current, ...next];
    });
    if (rejected > 0) showNotification("PNG, JPEG, හෝ WebP images (එකකට 10 MB දක්වා) පමණක් භාවිත කරන්න.", "error");
  };

  const reset = () => {
    setLesson("");
    setErrorText("");
    clearImages();
  };

  const handleClose = () => {
    if (saving && !confirm("Uploads are still running. Cancel them?")) return;
    controlsRef.current?.cancel();
    onClose();
  };

  const saveRecord = async (image?: QueuedImage) => {
    let uploaded: { storagePath?: string; mimeType?: string; fileName?: string } = {};
    if (image) {
      setActiveFileName(image.file.name);
      setProgress(null);
      const result = await uploadImageWithClientStorage({
        file: image.file,
        subject,
        onProgress: setProgress,
        onTask: (controls) => { controlsRef.current = controls; },
      });
      uploaded = { storagePath: result.storagePath, mimeType: image.file.type, fileName: image.file.name };
    }

    const response = await apiFetch("/api/student/mistake", {
      method: "POST",
      body: JSON.stringify({
        subject,
        lesson: lesson.trim(),
        errorText: errorText.trim() || (image ? `Uploaded question image: ${image.file.name}` : "Saved mistake"),
        imageStoragePath: uploaded.storagePath,
        imageMimeType: uploaded.mimeType,
        imageFileName: uploaded.fileName,
        batchUpload: images.length > 1,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "The mistake could not be saved.");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email) return showNotification("Sign in before saving a mistake.", "error");
    if (!lesson.trim()) return showNotification("Choose a lesson or enter its name.", "error");
    if (!errorText.trim() && images.length === 0) return showNotification("Describe the mistake or upload one or more images.", "error");

    setSaving(true);
    setSavedCount(0);
    let completed = 0;
    try {
      if (images.length === 0) {
        await saveRecord();
        completed = 1;
      } else {
        for (const image of images) {
          await saveRecord(image);
          completed += 1;
          setSavedCount(completed);
        }
      }
      showNotification(images.length > 1 ? `${completed} mistakes saved to Error Log.` : "Saved to Error Log.", "success");
      reset();
      onLogged?.();
      onClose();
    } catch (error: any) {
      if (error?.code !== "storage/canceled") {
        const partial = completed > 0 ? ` ${completed} item(s) were saved before the error.` : "";
        showNotification(`${error?.message || "The mistakes could not be saved."}${partial}`, "error");
      }
    } finally {
      controlsRef.current = null;
      setSaving(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (files.length === 0) return;
    event.preventDefault();
    addImages(files.map((file, index) => file.name && file.name !== "image.png" ? file : new File([file], `pasted-error-${Date.now()}-${index + 1}.png`, { type: file.type || "image/png" })));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onPaste={handlePaste}>
          <motion.button type="button" aria-label="Close mistake log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} className="fixed inset-0 h-full w-full cursor-default bg-slate-950/35 backdrop-blur-sm" />

          <motion.section
            ref={dialogRef as any}
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-log-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setIsDragging(true); } }}
            onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setIsDragging(false); addImages(Array.from(event.dataTransfer.files || [])); }}
            className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertCircle className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <h2 id="error-log-title" className="truncate text-lg font-bold text-slate-950">Error Log bulk upload</h2>
                  <p className="truncate text-sm text-slate-500">Drop, paste, or select several question screenshots.</p>
                </div>
              </div>
              <button type="button" onClick={handleClose} aria-label="Close" className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </header>

            <form onSubmit={handleSave} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">Subject
                  <select value={subject} onChange={(event) => { setSubject(event.target.value); setLesson(""); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100">
                    <option value="SFT">SFT</option><option value="ET">ET</option><option value="ICT">ICT</option>
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">Lesson
                  <input value={lesson} onChange={(event) => setLesson(event.target.value)} list={`mistake-lessons-${subject}`} placeholder="Choose a lesson or enter its name" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium normal-case text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
                  <datalist id={`mistake-lessons-${subject}`}>{LESSON_SUGGESTIONS[subject].map((item) => <option key={item} value={item} />)}</datalist>
                </label>
              </div>

              <label className="block space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">Shared note (optional for image batches)
                <textarea value={errorText} onChange={(event) => setErrorText(event.target.value)} rows={4} placeholder="What went wrong, the answer you selected, or what needs revision…" className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              </label>

              <div className={`rounded-2xl border-2 border-dashed p-4 transition ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-slate-50/70"}`}>
                <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => addImages(Array.from(event.target.files || []))} className="sr-only" id="mistake-images" />
                <label htmlFor="mistake-images" className="flex cursor-pointer items-center justify-center gap-3 rounded-xl px-4 py-5 text-center text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950">
                  <Images className="h-5 w-5" /> Drag, paste, or choose question images <Camera className="h-4 w-4 text-slate-400" />
                </label>
                <p className="text-center text-[11px] text-slate-400">Up to {MAX_BULK_IMAGES} images · PNG/JPEG/WebP · 10 MB each</p>
              </div>

              {images.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-bold text-slate-900">{images.length} images queued</p><p className="text-xs text-slate-500">{formatBytes(totalBytes)} total</p></div>
                    <button type="button" onClick={clearImages} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Clear all</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {images.map((item, index) => (
                      <div key={item.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img src={item.preview} alt={`Mistake ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                        <div className="px-2 py-2"><p className="truncate text-[11px] font-semibold text-slate-700">{index + 1}. {item.file.name}</p><p className="text-[10px] text-slate-400">{formatBytes(item.file.size)}</p></div>
                        <button type="button" onClick={() => removeImage(item.id)} disabled={saving} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-slate-500 shadow hover:text-rose-600 disabled:hidden" aria-label={`Remove ${item.file.name}`}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {saving && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-semibold text-indigo-950">{activeFileName || "Saving text record"}</span><span className="shrink-0 font-bold text-indigo-700">{images.length > 0 ? `${savedCount}/${images.length}` : "Saving"}</span></div>
                  {progress && <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(2, progress.progress * 100)}%` }} /></div><p className="mt-2 text-[11px] text-indigo-700">{Math.round(progress.progress * 100)}% · {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}</p></>}
                </div>
              )}

              <footer className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/95 pt-5 backdrop-blur">
                <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : images.length > 1 ? <ImagePlus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : images.length > 1 ? `Save ${images.length} mistakes` : "Save mistake"}
                </button>
              </footer>
            </form>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
