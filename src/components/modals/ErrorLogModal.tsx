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
    if (!file.type.startsWith("image/")) {
      showNotification("රූප ගොනුවක් තෝරන්න.", "error");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showNotification("රූප ගොනුව 15 MB ට වඩා කුඩා විය යුතුයි.", "error");
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
    if (saving && !confirm("ගොනුව උඩුගත වෙමින් පවතී. එය අවලංගු කරන්නද?")) return;
    controlsRef.current?.cancel();
    onClose();
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.email) {
      showNotification("වැරැද්ද සුරැකීමට පෙර පිවිසෙන්න.", "error");
      return;
    }
    if (!lesson.trim()) {
      showNotification("පාඩම තෝරන්න හෝ එහි නම ලියන්න.", "error");
      return;
    }
    if (!errorText.trim() && !imageFile) {
      showNotification("වැරැද්ද විස්තර කරන්න හෝ රූපයක් උඩුගත කරන්න.", "error");
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
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "වැරැද්ද සුරැකීමට නොහැකි වුණා.");

      const localRecord = {
        id: payload.id,
        subject,
        lesson: lesson.trim(),
        errorText: errorText.trim(),
        imageStoragePath: image.storagePath || null,
        imageMimeType: image.mimeType || null,
        createdAt: new Date().toISOString(),
      };
      const localKey = `local_mistake_notebook_${user.email.toLowerCase()}`;
      let previous: unknown = [];
      try {
        previous = JSON.parse(localStorage.getItem(localKey) || "[]");
      } catch {
        previous = [];
      }
      localStorage.setItem(localKey, JSON.stringify([localRecord, ...(Array.isArray(previous) ? previous : [])].slice(0, 100)));

      showNotification("සුරැකුණා. දැන් සහායකයාට මෙය පුනරීක්ෂණයට සහ ප්‍රශ්න පුහුණුවට භාවිත කළ හැකියි.", "success");
      reset();
      onLogged?.();
      onClose();
    } catch (error: any) {
      if (error?.code !== "storage/canceled") {
        showNotification(error?.message || "වැරැද්ද සුරැකීමට නොහැකි වුණා.", "error");
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
            aria-label="වැරදි සටහන් කවුළුව වසන්න"
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
                  <h2 id="error-log-title" className="text-lg font-bold text-slate-950">වැරැද්දක් සටහන් කරන්න</h2>
                  <p className="text-sm text-slate-500">පුනරීක්ෂණයට ප්‍රශ්නය හෝ රූපය සුරකින්න.</p>
                </div>
              </div>
              <button type="button" onClick={handleClose} aria-label="වසන්න" className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  විෂයය
                  <select value={subject} onChange={(event) => { setSubject(event.target.value); setLesson(""); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100">
                    <option value="SFT">SFT</option>
                    <option value="ET">ET</option>
                    <option value="ICT">ICT</option>
                  </select>
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  පාඩම
                  <input value={lesson} onChange={(event) => setLesson(event.target.value)} list={`mistake-lessons-${subject}`} placeholder="පාඩම තෝරන්න හෝ නම ලියන්න" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium normal-case text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
                  <datalist id={`mistake-lessons-${subject}`}>
                    {LESSON_SUGGESTIONS[subject].map((item) => <option key={item} value={item} />)}
                  </datalist>
                </label>
              </div>

              <label className="block space-y-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                වැරැද්ද හෝ ප්‍රශ්නය
                <textarea value={errorText} onChange={(event) => setErrorText(event.target.value)} rows={5} placeholder="ප්‍රශ්නය, දෝෂ පණිවිඩය හෝ වැරදුණු තැන පැහැදිලි කරන්න…" className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium normal-case leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              </label>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={(event) => handleImage(event.target.files?.[0])} className="sr-only" id="mistake-image" />
                {imagePreview && imageFile ? (
                  <div className="flex items-center gap-4">
                    <img src={imagePreview} alt="තෝරාගත් වැරදි රූපය" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{imageFile.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{progress ? `${Math.round(progress.progress * 100)}% · ${formatBytes(progress.bytesTransferred)} / ${formatBytes(progress.totalBytes)}` : formatBytes(imageFile.size)}</p>
                    </div>
                    <button type="button" onClick={clearImage} disabled={saving} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-rose-600" aria-label="රූපය ඉවත් කරන්න"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <label htmlFor="mistake-image" className="flex cursor-pointer items-center justify-center gap-3 rounded-xl px-4 py-5 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950">
                    <ImagePlus className="h-5 w-5" /> ප්‍රශ්නයේ හෝ වැරැද්දේ රූපයක් උඩුගත කරන්න
                    <Camera className="h-4 w-4 text-slate-400" />
                  </label>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={handleClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">අවලංගු කරන්න</button>
                <button type="submit" disabled={saving} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "සුරකිමින්…" : "වැරැද්ද සුරකින්න"}
                </button>
              </footer>
            </form>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
