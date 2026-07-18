import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Camera, ImagePlus, LoaderCircle, Save, X } from "lucide-react";
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

const LESSON_SUGGESTIONS: Record<string, string[]> = {
  SFT: ["තරල", "විද්‍යුතය", "කෘෂි තාක්ෂණය", "ආහාර තාක්ෂණය"],
  ET: ["මූලික ඉලෙක්ට්‍රොනික විද්‍යාව", "විදුලි තාක්ෂණය", "සිවිල් ඉංජිනේරු තාක්ෂණය", "යාන්ත්‍රික පද්ධති"],
  ICT: ["ජාලකරණය", "දත්ත සමුදා", "Python", "වෙබ් සංවර්ධනය"],
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ErrorLogModal({ isOpen, onClose, onLogged }: ErrorLogModalProps) {
  const { user, showNotification } = useApp();
  const [subject, setSubject] = useState("SFT");
  const [lesson, setLesson] = useState("");
  const [errorText, setErrorText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<UploadProgressSnapshot | null>(null);
  const controlsRef = useRef<UploadTaskControls | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageFile(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showNotification("Choose a PNG, JPEG, or WebP image.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification("The image must be 10 MB or smaller.", "error");
      return;
    }
    clearImage();
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const reset = () => {
    setLesson("");
    setErrorText("");
    clearImage();
  };

  const handleClose = () => {
    if (saving && !confirm("An upload is in progress. Cancel it?")) return;
    controlsRef.current?.cancel();
    onClose();
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email) {
      showNotification("Sign in before saving a mistake.", "error");
      return;
    }
    if (!lesson.trim()) {
      showNotification("Choose a lesson or enter its name.", "error");
      return;
    }
    if (!errorText.trim() && !imageFile) {
      showNotification("Describe the mistake or upload an image.", "error");
      return;
    }

    setSaving(true);
    try {
      let image: { storagePath?: string; mimeType?: string; fileName?: string } = {};
      if (imageFile) {
        const uploaded = await uploadImageWithClientStorage({
          file: imageFile,
          subject,
          onProgress: setProgress,
          onTask: (controls) => { controlsRef.current = controls; },
        });
        image = { storagePath: uploaded.storagePath, mimeType: imageFile.type, fileName: imageFile.name };
      }

      const response = await apiFetch("/api/student/mistake", {
        method: "POST",
        body: JSON.stringify({
          subject,
          lesson: lesson.trim(),
          errorText: errorText.trim(),
          imageStoragePath: image.storagePath,
          imageMimeType: image.mimeType,
          imageFileName: image.fileName,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "The mistake could not be saved.");



      showNotification("Saved. The Assistant can now use it for revision and practice.", "success");
      reset();
      onLogged?.();
      onClose();
    } catch (error: any) {
      if (error?.code !== "storage/canceled") {
        showNotification(error?.message || "The mistake could not be saved.", "error");
      }
    } finally {
      controlsRef.current = null;
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close mistake log"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 h-full w-full cursor-default bg-slate-950/35 backdrop-blur-sm"
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-log-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="error-log-title" className="text-lg font-bold text-slate-950">Log a mistake</h2>
                  <p className="text-sm text-slate-500">Save a question or image for revision.</p>
                </div>
              </div>
              <button type="button" onClick={handleClose} aria-label="Close" className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Subject
                  <select value={subject} onChange={(event) => { setSubject(event.target.value); setLesson(""); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100">
                    <option value="SFT">SFT</option>
                    <option value="ET">ET</option>
                    <option value="ICT">ICT</option>
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Lesson
                  <input value={lesson} onChange={(event) => setLesson(event.target.value)} list={`mistake-lessons-${subject}`} placeholder="Choose a lesson or enter its name" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium normal-case text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
                  <datalist id={`mistake-lessons-${subject}`}>
                    {LESSON_SUGGESTIONS[subject].map((item) => <option key={item} value={item} />)}
                  </datalist>
                </label>
              </div>

              <label className="block space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Mistake or question
                <textarea value={errorText} onChange={(event) => setErrorText(event.target.value)} rows={5} placeholder="Describe the question, error message, or what went wrong…" className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              </label>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(event) => handleImage(event.target.files?.[0])} className="sr-only" id="mistake-image" />
                {imagePreview && imageFile ? (
                  <div className="flex items-center gap-4">
                    <img src={imagePreview} alt="Selected mistake image" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{imageFile.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{progress ? `${Math.round(progress.progress * 100)}% · ${formatBytes(progress.bytesTransferred)} / ${formatBytes(progress.totalBytes)}` : formatBytes(imageFile.size)}</p>
                    </div>
                    <button type="button" onClick={clearImage} disabled={saving} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-rose-600" aria-label="Remove image"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <label htmlFor="mistake-image" className="flex cursor-pointer items-center justify-center gap-3 rounded-xl px-4 py-5 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950">
                    <ImagePlus className="h-5 w-5" /> Upload a question or mistake image
                    <Camera className="h-4 w-4 text-slate-400" />
                  </label>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving…" : "Save mistake"}
                </button>
              </footer>
            </form>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
