import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { openSourcePdf } from '../../lib/sourceActions';
import { useApp } from '../../context/AppContext';
import { db, storage, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { apiFetch } from '../../lib/api';
import { getRecommendedUploadMode } from '../../lib/uploadMode';
import { uploadPdfWithClientStorage, openPrivateStoragePdf, deletePrivateStorageObject, type UploadProgressSnapshot, type UploadTaskControls } from '../../lib/clientStorageUpload';
import { OcrTextModal } from '../ui/OcrTextModal';

function normalizeSubject(s: string) {
  return String(s || "").trim().toUpperCase();
}

function getPaperKey(paper: any) {
  return String(paper.sourceId || paper.id || paper.storagePath || paper.title);
}

function dedupeBySourceId(items: any[]) {
  const map = new Map();
  for (const item of items || []) {
    const key = getPaperKey(item);
    if (!key) continue;
    const prev = map.get(key);
    map.set(key, { ...(prev || {}), ...item });
  }
  return Array.from(map.values());
}

type UploadTelemetry = UploadProgressSnapshot & {
  speedBytesPerSecond: number;
  remainingBytes: number;
  etaSeconds: number | null;
  phase: "uploading" | "indexing";
};

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatEta(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "Calculating…";
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
}

export default function PastPapersView() {
  const { currentSubject, profile } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('A/L Past Papers');
  const [papers, setPapers] = useState<any[]>([]);
  const [uploadedPapers, setUploadedPapers] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTelemetry, setUploadTelemetry] = useState<UploadTelemetry | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedOcrPaper, setSelectedOcrPaper] = useState<any | null>(null);
  const uploadStartedAtRef = useRef(0);
  const uploadControlsRef = useRef<UploadTaskControls | null>(null);

  const categories = ['A/L Past Papers', 'Model Papers'];

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, 'past_papers'),
      where('subject', '==', normalizeSubject(currentSubject))
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPapers(dedupeBySourceId(data));
    });
    return () => unsubscribe();
  }, [currentSubject]);

  const [reindexingId, setReindexingId] = useState<string | null>(null);

  const handleReprocess = async (paper: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const paperId = paper.sourceId || paper.id;
    setReindexingId(paperId);

    try {
      const res = await apiFetch(`/api/pdf/reprocess/${paperId}`, {
        method: "POST"
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Reprocessing failed");
      }
      setToast({ type: 'success', message: "OCR processing pipeline triggered successfully!" });
    } catch (err: any) {
      console.error("Reprocessing failed:", err);
      setToast({ type: 'error', message: `Reprocessing failed: ${err.message || String(err)}` });
    } finally {
      setReindexingId(null);
    }
  };

  const handleOpenSinhalaTextPdf = async (paper: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (paper.ocrTextPdfStoragePath) {
      try {
        await openPrivateStoragePdf(paper.ocrTextPdfStoragePath);
      } catch (err: any) {
        setToast({ type: 'error', message: `Failed to open Sinhala text PDF: ${err.message}` });
      }
    }
  };

  const renderStatusBadge = (paper: any) => {
    const status = paper.indexStatus || (Number(paper.chunkCount || 0) > 0 ? "ready" : (paper.needsOcr ? "needs_ocr" : "not_indexed"));
    const badges: React.ReactNode[] = [];

    // Main status badge
    if (status === 'ready') {
      badges.push(<span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Ready</span>);
    } else if (status === 'queued' || status === 'running' || status === 'indexing' || status === 'processing') {
      badges.push(
        <span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <i className="fa-solid fa-circle-notch fa-spin text-[8px]"></i> OCR Running
        </span>
      );
    } else if (status === 'needs_ocr') {
      badges.push(<span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Needs OCR</span>);
    } else if (status === 'needs_legacy_conversion') {
      badges.push(<span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Legacy</span>);
    } else if (status === 'legacy_converted') {
      badges.push(<span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200">Converted</span>);
    } else if (status === 'failed') {
      badges.push(<span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">Failed</span>);
    } else {
      badges.push(<span key="main" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Not Indexed</span>);
    }

    // Companion text PDF readiness badge
    if (paper.ocrTextPdfStoragePath) {
      badges.push(
        <span key="companion" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Sinhala Text companion PDF is ready">
          <i className="fa-solid fa-file-pdf text-[8px]"></i> Sinhala Text PDF
        </span>
      );
    }

    return <div className="flex flex-wrap gap-1 items-center">{badges}</div>;
  };

  const renderActionButtons = (paper: any) => {
    const paperId = paper.sourceId || paper.id;
    const status = paper.indexStatus || (Number(paper.chunkCount || 0) > 0 ? "ready" : (paper.needsOcr ? "needs_ocr" : "not_indexed"));
    
    if (reindexingId === paperId) {
      return (
        <span className="text-[11px] font-black text-blue-600 flex items-center gap-1 select-none">
          <i className="fa-solid fa-circle-notch fa-spin"></i> Processing...
        </span>
      );
    }

    const buttons: React.ReactNode[] = [];

    // 1. View OCR Text button
    const hasIndexedText = paper.textIndexed === true || Number(paper.chunkCount || 0) > 0;
    if (hasIndexedText) {
      buttons.push(
        <button
          key="view_ocr"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOcrPaper(paper);
          }}
          className="px-2 py-1 text-[10px] font-black rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition-all flex items-center gap-1 cursor-pointer shrink-0"
          title="View clean page-by-page extracted Unicode text"
        >
          <i className="fa-solid fa-eye text-[8px]"></i> View Text
        </button>
      );
    }

    // 2. Open Sinhala Text PDF button
    if (paper.ocrTextPdfStoragePath) {
      buttons.push(
        <button
          key="open_sinhala_pdf"
          onClick={(e) => handleOpenSinhalaTextPdf(paper, e)}
          className="px-2 py-1 text-[10px] font-black rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all flex items-center gap-1 cursor-pointer shrink-0"
          title="Open generated Sinhala Unicode PDF in a new tab"
        >
          <i className="fa-solid fa-file-export text-[8px]"></i> Text PDF
        </button>
      );
    }

    // 3. Reprocess only when text is not ready.
    if (["needs_ocr", "needs_legacy_conversion", "failed", "not_indexed"].includes(status) || !hasIndexedText) buttons.push(
      <button
        key="reprocess"
        onClick={(e) => handleReprocess(paper, e)}
        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
        title="Trigger processing pipeline (Force OCR fallback)"
      >
        <i className="fa-solid fa-arrows-rotate text-[8px]"></i> Reprocess
      </button>
    );

    return <div className="flex items-center gap-1.5 flex-wrap">{buttons}</div>;
  };

  const filteredPapers = dedupeBySourceId([...uploadedPapers, ...papers]).filter(paper => {
    const matchesSearch = paper.title.toLowerCase().includes(searchTerm.toLowerCase()) || paper.year?.includes(searchTerm);
    const matchesCategory = paper.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    const user = auth.currentUser;
    console.log({
      uid: user?.uid,
      email: user?.email,
      isAnonymous: user?.isAnonymous,
      storageBucket: storage?.app?.options?.storageBucket,
    });

    if (!user || user.isAnonymous) {
      setToast({ type: 'error', message: "Please sign in before uploading PDFs." });
      return;
    }

    // simple metadata gathering
    const year = prompt('Enter Year:') || new Date().getFullYear().toString();
    const type = prompt('Enter Type (MCQ/Essay):') || 'MCQ';
    const title = prompt('Enter Paper Title:') || file.name;
    const category = selectedCategory;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadTelemetry(null);
    uploadStartedAtRef.current = performance.now();
    
    try {
      const mode = await getRecommendedUploadMode();
      const normSubj = normalizeSubject(currentSubject);
      const resType = selectedCategory === "Model Papers" ? "model_paper" : "past_paper";

      let data: any = null;

      if (mode === 'client_firebase_storage') {
        // Step A: Client Firebase Storage upload
        const uploaded = await uploadPdfWithClientStorage({
          file,
          subject: normSubj,
          year,
          resourceType: resType,
          sourceScope: "past_paper",
          onTask: (controls) => { uploadControlsRef.current = controls; },
          onProgress: (snapshot) => {
            const elapsedSeconds = Math.max(0.25, (performance.now() - uploadStartedAtRef.current) / 1000);
            const speed = snapshot.bytesTransferred / elapsedSeconds;
            const remaining = Math.max(0, snapshot.totalBytes - snapshot.bytesTransferred);
            setUploadProgress(snapshot.progress * 100);
            setUploadTelemetry({
              ...snapshot,
              speedBytesPerSecond: speed,
              remainingBytes: remaining,
              etaSeconds: speed > 1024 ? remaining / speed : null,
              phase: "uploading",
            });
          },
        });

        setUploadProgress(100);
        setUploadTelemetry((current) => current ? { ...current, phase: "indexing" } : null);

        // Step B: Call backend ingest-uploaded
        const payload = {
          sourceId: uploaded.sourceId,
          storagePath: uploaded.storagePath,
          title: title,
          fileName: file.name,
          subject: normSubj,
          year: year,
          resourceType: resType,
          sourceType: resType,
          sourceScope: "past_paper",
          medium: "Sinhala"
        };

        const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const ingestData = await ingestRes.json().catch(() => null);
        if (!ingestRes.ok || !ingestData?.ok) {
          throw new Error(ingestData?.message || ingestData?.code || "Upload ingest failed");
        }

        // Step C: Save to past_papers
        const saveRes = await apiFetch("/api/rag/past-papers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: uploaded.sourceId,
            sourceId: uploaded.sourceId,
            title,
            subject: normSubj,
            year,
            category,
            paperType: type,
            resourceType: resType,
            storagePath: uploaded.storagePath,
            chunkCount: ingestData.chunkCount || 0,
            needsOcr: ingestData.needsOcr || false,
            textIndexed: false,
          })
        });

        const saveData = await saveRes.json().catch(() => null);
        if (!saveRes.ok || !saveData?.ok) {
          throw new Error(saveData?.error || "Failed to save past paper document");
        }

        data = {
          sourceId: uploaded.sourceId,
          storagePath: uploaded.storagePath,
          title,
          chunkCount: ingestData.chunkCount || 0,
          needsOcr: ingestData.needsOcr || false,
          indexStatus: ingestData.status || "queued",
        };
      } else {
        // Fallback or Normal backend upload if not forced to client storage
        const fd = new FormData();
        fd.append("file", file);
        fd.append("title", title);
        fd.append("subject", normSubj);
        fd.append("year", year);
        fd.append("resourceType", resType);
        fd.append("sourceType", resType);
        fd.append("sourceScope", "past_paper");
        fd.append("medium", "Sinhala");

        setUploadProgress(40);

        const res = await apiFetch("/api/rag/upload", {
          method: "POST",
          body: fd
        });

        setUploadProgress(70);

        const resData = await res.json().catch(() => null);
        if (!res.ok || !resData?.ok) {
          throw new Error(resData?.message || resData?.code || "Upload failed");
        }
        data = resData;
      }
      
      setUploadProgress(100);

      const newPaper = {
        id: data.sourceId,
        sourceId: data.sourceId,
        title: data.title || title,
        year: year,
        type: type,
        subject: normSubj,
        category: category,
        url: `/api/rag/sources/${data.sourceId}/download`,
        storagePath: data.storagePath,
        chunkCount: data.chunkCount || 0,
        needsOcr: data.needsOcr || false,
        indexStatus: data.indexStatus || data.status || "queued",
        textIndexed: Number(data.chunkCount || 0) > 0,
        ownerUid: auth.currentUser?.uid || "",
        uploaded: true,
        createdAt: new Date()
      };

      setUploadedPapers(prev => dedupeBySourceId([newPaper, ...prev]));
      
      setIsUploading(false);
      setUploadProgress(0);
      setUploadTelemetry(null);
      uploadControlsRef.current = null;
      setToast({ type: 'success', message: "PDF uploaded successfully. Indexing status updated." });
    } catch (error: any) {
      console.error("Upload failed", error);
      setToast({ type: 'error', message: `Upload failed: ${error.message || error}` });
      setIsUploading(false);
      setUploadProgress(0);
      setUploadTelemetry(null);
      uploadControlsRef.current = null;
    }
  };

  const isDeleteAllowed = (paper: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    if (profile?.role === 'admin' || profile?.roles?.includes('admin')) return true;
    if (paper.ownerUid === currentUser.uid) return true;
    if (paper.uploaded === true) return true;
    return false;
  };

  const handleDeletePaper = async (paper: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${paper.title}"?`)) return;

    try {
      const paperId = paper.sourceId || paper.id;
      const res = await apiFetch(`/api/rag/past-papers/${paperId}`, { method: 'DELETE' });
      const resData = await res.json().catch(() => null);

      if (!res.ok || !resData?.ok) {
        throw new Error(resData?.error || "Failed to delete from backend");
      }

      if (paper.storagePath) {
        await deletePrivateStorageObject(paper.storagePath).catch((err) => {
          console.warn("Storage delete failed client-side (warn only):", err);
        });
      }

      setUploadedPapers(prev => prev.filter(p => (p.sourceId || p.id) !== paperId));
      setPapers(prev => prev.filter(p => (p.sourceId || p.id) !== paperId));

      setToast({ type: 'success', message: "Deleted successfully!" });
    } catch (err: any) {
      setToast({ type: 'error', message: `Deletion failed: ${err.message}` });
    }
  };

 const containerVariants = {
 hidden: { opacity: 0 },
 show: {
 opacity: 1,
 transition: {
 staggerChildren: 0.1
 }
 }
 };

 const itemVariants = {
 hidden: { opacity: 0, y: 20 },
 show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
 exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
 };

 return (
 <div className="space-y-6 ">
 <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-[1.8rem] shadow-sm relative overflow-visible">
 
 <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
 <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
 {categories.map(cat => (
 <button
 key={cat}
 onClick={() => setSelectedCategory(cat)}
 className={cn(
 "px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
 selectedCategory === cat 
 ? "bg-white text-primary-600 shadow-sm" 
 : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
 )}
 >
 {cat}
 </button>
 ))}
 </div>
 {auth.currentUser && !auth.currentUser.isAnonymous && (
  <div className="relative">
 <input 
 type="file" 
 accept="application/pdf"
 onChange={handleFileUpload} 
 className="hidden" 
 id="pdf-upload"
 disabled={isUploading}
 />
 <label 
 htmlFor="pdf-upload"
 className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
 >
 {isUploading ? (
 <><i className="fa-solid fa-circle-notch fa-spin"></i> {uploadTelemetry?.phase === "indexing" ? "Indexing…" : `Uploading ${Math.round(uploadProgress)}%`}</>
 ) : (
 <><i className="fa-solid fa-cloud-arrow-up"></i> Upload PDF</>
 )}
 </label>
 {isUploading && uploadTelemetry && (
   <div className="fixed left-4 right-4 top-24 z-50 w-auto rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-72" role="status" aria-live="polite">
     <div className="mb-2 flex items-center justify-between font-bold text-slate-800">
       <span>{uploadTelemetry.phase === "indexing" ? "Upload complete · indexing" : "Uploading PDF"}</span>
       <span>{Math.round(uploadTelemetry.progress * 100)}%</span>
     </div>
     <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${uploadTelemetry.progress * 100}%` }} /></div>
     <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-500">
       <span>Uploaded</span><strong className="text-right text-slate-700">{formatBytes(uploadTelemetry.bytesTransferred)} / {formatBytes(uploadTelemetry.totalBytes)}</strong>
       <span>Remaining</span><strong className="text-right text-slate-700">{formatBytes(uploadTelemetry.remainingBytes)}</strong>
       <span>Speed</span><strong className="text-right text-slate-700">{formatBytes(uploadTelemetry.speedBytesPerSecond)}/s</strong>
       <span>ETA</span><strong className="text-right text-slate-700">{uploadTelemetry.phase === "indexing" ? "Processing…" : formatEta(uploadTelemetry.etaSeconds)}</strong>
     </div>
     {uploadTelemetry.phase === "uploading" && (
       <button type="button" onClick={() => uploadControlsRef.current?.cancel()} className="mt-3 w-full rounded-lg border border-slate-200 py-2 font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Cancel upload</button>
     )}
   </div>
 )}
 </div>
 )}
 </div>

 <div className="relative z-10 mb-6">
 <div className="relative">
 <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
 <input
 type="text"
 placeholder="Search by year or paper title..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-primary-50 focus:border-primary-500 transition-all font-medium"
 />
 </div>
 </div>

 <div className="relative z-10">
 {filteredPapers.length === 0 ? (
 <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
 <i className="fa-solid fa-folder-open text-3xl text-slate-300 mb-3"></i>
 <h3 className="text-slate-600 font-bold mb-1">No Papers Found</h3>
 <p className="text-slate-400 text-sm">Upload some papers or adjust your search.</p>
 </div>
 ) : (
 <motion.div 
 variants={containerVariants}
 initial="hidden"
 animate="show"
 className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
 >
 <AnimatePresence mode="popLayout">
 {filteredPapers.map(paper => (
 <motion.div
 key={getPaperKey(paper)}
 layout
 variants={itemVariants as any}
 exit="exit"
 className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer flex flex-col justify-between h-full relative overflow-hidden"
 onClick={() => {
    openSourcePdf({ storagePath: paper.storagePath, url: paper.url, id: paper.id }).catch((e: any) => {
      console.error('Download trigger failed:', e);
      if (e.message?.includes('LOGIN_REQUIRED')) {
         alert('PDF open කරන්න login අවශ්‍යයි. නැවත sign in කරන්න.');
      } else if (e.message?.includes('storage/unauthorized')) {
         alert('PDF permission denied. Storage rules / App Check / login check කරන්න.');
      } else if (e.message?.includes('NOT_A_PDF_RESPONSE')) {
         alert('PDF වෙනුවට server error response එකක් ආවා. Source route/auth fix කරන්න.');
      } else if (e.message?.includes('NO_OPENABLE_PDF_SOURCE')) {
         alert('මේ source එකට storagePath හෝ public URL එකක් නැහැ.');
      } else {
         alert('Error opening PDF: ' + e.message);
      }
    });
  }}
 >
 <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-100 to-transparent rounded-bl-full opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none"></div>
 <div className="relative z-10">
 <div className="flex justify-between items-start mb-3">
 <span className={cn(
 "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
 paper.type === 'MCQ' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
 )}>
 {paper.type}
 </span>
 <div className="flex items-center gap-1.5">
 {renderStatusBadge(paper)}
 <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md shadow-inner">
 {paper.year}
 </span>
 </div>
 </div>
 <h4 className="font-bold text-slate-800 text-base mb-1 group-hover:text-primary-600 transition-colors leading-tight">{paper.title}</h4>
 <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-2">{paper.category}</p>
 </div>
 
 <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center relative z-10">
 <div className="flex items-center gap-2">
 {renderActionButtons(paper)}
 </div>
 <div className="flex items-center gap-2">
  {isDeleteAllowed(paper) && (
    <button
    onClick={(e) => handleDeletePaper(paper, e)}
    className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 flex items-center justify-center transition-all shadow-sm cursor-pointer shrink-0"
    title="Delete Paper"
   >
    <i className="fa-regular fa-trash-can text-xs"></i>
   </button>
  )}
  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-primary-500 group-hover:border-primary-500 group-hover:text-white flex items-center justify-center transition-all shadow-sm shrink-0">
  <i className="fa-solid fa-arrow-right"></i>
  </div>
 </div>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 </motion.div>
 )}
 </div>
 </div>

 <AnimatePresence>
 {toast && (
 <motion.div
 initial={{ opacity: 0, y: 50, scale: 0.9 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 20, scale: 0.9 }}
 className={cn(
 "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-xl shadow-lg border text-xs font-bold font-sans tracking-wide max-w-sm backdrop-blur-md transition-all",
 toast.type === 'success'
 ? "bg-emerald-500/90 text-white border-emerald-400/20 shadow-emerald-500/10"
 : toast.type === 'error'
 ? "bg-rose-500/90 text-white border-rose-400/20 shadow-rose-500/10"
 : "bg-slate-800/95 text-white border-slate-700/20 shadow-slate-900/10"
 )}
 >
 {toast.type === 'success' ? (
 <i className="fa-solid fa-circle-check text-sm text-emerald-100"></i>
 ) : toast.type === 'error' ? (
 <i className="fa-solid fa-circle-exclamation text-sm text-rose-100"></i>
 ) : (
 <i className="fa-solid fa-circle-info text-sm text-slate-300"></i>
 )}
 <span className="flex-1 leading-normal">{toast.message}</span>
 <button
 onClick={() => setToast(null)}
 className="text-white/60 hover:text-white transition-colors cursor-pointer ml-1"
 >
 <i className="fa-solid fa-xmark text-sm"></i>
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 <AnimatePresence>
 {selectedOcrPaper && (
   <OcrTextModal
     sourceId={selectedOcrPaper.sourceId || selectedOcrPaper.id}
     title={selectedOcrPaper.title}
     onClose={() => setSelectedOcrPaper(null)}
   />
 )}
 </AnimatePresence>
 </div>
 );
}
