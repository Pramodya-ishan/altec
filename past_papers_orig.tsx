import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { db, storage, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { apiFetch } from '../../lib/api';
import { getRecommendedUploadMode } from '../../lib/uploadMode';
import { uploadPdfWithClientStorage, openPrivateStoragePdf } from '../../lib/clientStorageUpload';

export function PastPapersView() {
 const { currentSubject, profile } = useApp();
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('A/L Past Papers');
 const [papers, setPapers] = useState<any[]>([]);
 const [uploadedPapers, setUploadedPapers] = useState<any[]>([]);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadProgress, setUploadProgress] = useState(0);

 const categories = ['A/L Past Papers', 'Model Papers'];

 useEffect(() => {
 if (!db) return;
 const q = query(
 collection(db, 'past_papers'),
 where('subject', '==', currentSubject)
 );
 const unsubscribe = onSnapshot(q, (snapshot) => {
 const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
 setPapers(data);
 });
 return () => unsubscribe();
 }, [currentSubject]);

 const filteredPapers = [...uploadedPapers, ...papers].filter(paper => {
 const matchesSearch = paper.title.toLowerCase().includes(searchTerm.toLowerCase()) || paper.year?.includes(searchTerm);
 const matchesCategory = paper.category === selectedCategory;
 return matchesSearch && matchesCategory;
 });

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !db) return;

 // simple metadata gathering (in a real app, maybe a modal form)
 const year = prompt('Enter Year:') || new Date().getFullYear().toString();
 const type = prompt('Enter Type (MCQ/Essay):') || 'MCQ';
 const title = prompt('Enter Paper Title:') || file.name;
 const category = selectedCategory;

 setIsUploading(true);
 setUploadProgress(20);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("subject", currentSubject.toUpperCase());
      fd.append("year", year);
      fd.append("resourceType", selectedCategory === "Model Papers" ? "model_paper" : "past_paper");
      fd.append("sourceType", selectedCategory === "Model Papers" ? "model_paper" : "past_paper");
      fd.append("sourceScope", "owner_syllabus");
      fd.append("medium", "Sinhala");

      setUploadProgress(50);

      const res = await apiFetch("/api/rag/upload", {
        method: "POST",
        body: fd
      });

      setUploadProgress(80);

      let data = await res.json().catch(() => null);
      let isFallback = false;

      if (!res.ok || data?.code === "GOOGLE_AUTH_TOKEN_FETCH_FAILED" || data?.code === "UPLOAD_STORAGE_FAILED" || (data?.message && (data.message.includes("oauth2") || data.message.includes("Premature close")))) {
        console.warn("Backend upload failed with auth or storage issue. Falling back to client upload...", data);
        isFallback = true;
      }

      if (isFallback) {
        // Step B: Automatically fallback to client Firebase Storage upload
        const uploaded = await uploadPdfWithClientStorage({
          file,
          subject: currentSubject.toUpperCase(),
          year,
          resourceType: selectedCategory === "Model Papers" ? "model_paper" : "past_paper",
          sourceScope: "owner_syllabus"
        });

        // Step C: Call backend ingest route
        const ingestFd = new FormData();
        // file appended later
        ingestFd.append("sourceId", uploaded.sourceId);
        ingestFd.append("storagePath", uploaded.storagePath);
        ingestFd.append("title", title);
        ingestFd.append("subject", currentSubject.toUpperCase());
        ingestFd.append("year", year);
        ingestFd.append("resourceType", selectedCategory === "Model Papers" ? "model_paper" : "past_paper");
        ingestFd.append("sourceType", selectedCategory === "Model Papers" ? "model_paper" : "past_paper");
        ingestFd.append("sourceScope", "owner_syllabus");
        ingestFd.append("medium", "Sinhala");
        ingestFd.append("file", file);

        const ingestRes = await apiFetch("/api/rag/ingest-uploaded", {
          method: "POST",
          body: ingestFd
        });

        data = await ingestRes.json().catch(() => null);
        if (!ingestRes.ok || !data?.ok) {
          throw new Error(data?.message || data?.code || "Upload ingest failed");
        }
      } else {
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || data?.code || "Upload failed");
        }
      }
      
      setUploadProgress(100);

      const newPaper = {
        id: data.sourceId,
        title: data.title || title,
        year: year,
        type: type,
        subject: currentSubject,
        category: category,
        url: `/api/rag/sources/${data.sourceId}/download`,
        storagePath: data.storagePath,
        chunkCount: data.chunkCount,
        needsOcr: data.needsOcr,
        createdAt: new Date()
      };

      setUploadedPapers(prev => [newPaper, ...prev]);
      
      setIsUploading(false);
      setUploadProgress(0);
      alert('Upload successful!');
    } catch (error: any) {
      console.error("Upload failed", error);
      alert(`Upload failed: ${error.message || error}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
 };

 const handleDeletePaper = async (paper: any, e: React.MouseEvent) => {
   e.stopPropagation();
   if (!confirm(`Are you sure you want to delete "${paper.title}"?`)) return;

   try {
     const res = await apiFetch(`/api/rag/sources/${paper.id}`, { method: 'DELETE' });
     const resData = await res.json().catch(() => null);

     if (db) {
       const { doc, deleteDoc } = await import('firebase/firestore');
       try {
         await deleteDoc(doc(db, 'past_papers', paper.id));
       } catch (dbErr) {
         console.warn("Could not delete from past_papers collection:", dbErr);
       }
     }

     setUploadedPapers(prev => prev.filter(p => p.id !== paper.id));
     setPapers(prev => prev.filter(p => p.id !== paper.id));

     alert('Deleted successfully!');
   } catch (err: any) {
     alert('Deletion failed: ' + err.message);
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
 <div className="bg-white p-6 border border-slate-200 rounded-[1.8rem] shadow-sm relative overflow-hidden">
 
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
 {profile?.email === '26002ishan@gmail.com' && (
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
 <><i className="fa-solid fa-circle-notch fa-spin"></i> Uploading {Math.round(uploadProgress)}%</>
 ) : (
 <><i className="fa-solid fa-cloud-arrow-up"></i> Upload PDF</>
 )}
 </label>
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
 key={paper.id}
 layout
 variants={itemVariants as any}
 exit="exit"
 className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer flex flex-col justify-between h-full relative overflow-hidden"
 onClick={() => {
    if (paper.url && paper.url.startsWith('http')) {
       window.open(paper.url, '_blank');
    } else if (paper.storagePath) {
      openPrivateStoragePdf(paper.storagePath).catch(() => {
        if (paper.url) window.open(paper.url, '_blank');
      });
    } else if (paper.url) {
      window.open(paper.url, '_blank');
    }
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
 <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md shadow-inner">
 {paper.year}
 </span>
 </div>
 <h4 className="font-bold text-slate-800 text-base mb-1 group-hover:text-primary-600 transition-colors leading-tight">{paper.title}</h4>
 <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-2">{paper.category}</p>
 </div>
 
 <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center relative z-10">
 <span className="text-[11px] font-bold text-primary-500 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
 View Paper
 </span>
 <div className="flex items-center gap-2">
  {profile?.email === '26002ishan@gmail.com' && (
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
 </div>
 );
}
