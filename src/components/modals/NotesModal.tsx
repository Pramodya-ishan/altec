import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { apiFetch } from '../../lib/api';
import { openPrivateStoragePdf, uploadPdfWithClientStorage, deletePrivateStorageObject } from '../../lib/clientStorageUpload';

export function NotesModal() {
  const { data, saveData, currentSubject, modals, setModals } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const topic = modals.playlist.topic;
  const close = () => setModals(prev => ({ ...prev, playlist: { open: false, topic: "" } }));
  if (!modals.playlist.open) return null;

  const videos = data[currentSubject]?.topics[topic]?.videos || [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large (limit 20MB)");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const { sourceId, storagePath } = await uploadPdfWithClientStorage({
        file,
        subject: currentSubject,
        lesson: topic,
        resourceType: "paper_structure",
        sourceScope: "owner_syllabus"
      });

      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", file.name);
      fd.append("subject", currentSubject);
      fd.append("lesson", topic);
      fd.append("resourceType", "paper_structure");
      fd.append("sourceType", "attachment");
      fd.append("sourceScope", "owner_syllabus");
      fd.append("sourceId", sourceId);
      fd.append("storagePath", storagePath);

      const res = await apiFetch("/api/rag/ingest-uploaded", {
        method: "POST",
        body: fd
      });
      
      const dataJson = await res.json().catch(() => null);
      if (!res.ok || !dataJson?.ok) {
        throw new Error(dataJson?.message || dataJson?.error || "Upload failed");
      }
      
      const nextData = structuredClone(data);
      if (!nextData[currentSubject].topics[topic].videos) {
        nextData[currentSubject].topics[topic].videos = [];
      }
      nextData[currentSubject].topics[topic].videos.push({
        title: file.name,
        url: dataJson.sourceId,
        storagePath: dataJson.storagePath,
        type: file.type
      });
      saveData(nextData);

      setUploadProgress(100);
      setIsUploading(false);
    } catch(err: any) {
       console.error(err);
       alert("Error starting upload: " + err.message);
       setIsUploading(false);
    }
  };

  

  return (
    <AnimatePresence>
      {modals.playlist.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm sm:p-6"
        >
          <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full sm:max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:h-[85vh]"
      >
        <div className="px-6 py-4 flex justify-end items-center shrink-0 z-10 relative">
          <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50 p-4 sm:p-6">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                  <i className="fa-solid fa-file-pdf text-slate-400"></i> Attachments & PDFs
                </h3>
                <div className="relative">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="attachment-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="attachment-upload"
                    className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
                  >
                    {isUploading ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> {Math.round(uploadProgress || 0)}%</>
                    ) : (
                      <><i className="fa-solid fa-cloud-arrow-up"></i> Upload PDF/Image</>
                    )}
                  </label>
                </div>
              </div>

              {videos.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <i className="fa-solid fa-file-pdf text-3xl text-slate-300 mb-2"></i>
                  <p className="text-sm font-medium text-slate-500">No attachments yet. Upload PDFs or reference images here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {videos.map((vid, idx) => (
                    <div key={idx} className="flex items-center gap-2 group w-full">
                      <a
                        href={vid.url?.startsWith('http') ? vid.url : '#'}
                        onClick={(e) => {
                          if (vid.url && !vid.url.startsWith('http')) {
                             e.preventDefault();
                             if (vid.storagePath) {
                               openPrivateStoragePdf(vid.storagePath).catch(() => alert('Failed to open PDF'));
                             }
                          }
                        }}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all bg-white cursor-pointer min-w-0"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                          <i className={`fa-solid ${vid.type?.includes('pdf') || vid.title.endsWith('.pdf') ? 'fa-file-pdf text-rose-500' : 'fa-file-image text-indigo-500'} text-lg`}></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{vid.title}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{vid.type?.includes('pdf') ? 'PDF Document' : 'Image'}</p>
                        </div>
                        <i className="fa-solid fa-arrow-up-right-from-square text-slate-300 group-hover:text-indigo-500 text-xs px-2 shrink-0"></i>
                      </a>

                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!confirm(`Are you sure you want to delete "${vid.title}"?`)) return;
                          try {
                            if (vid.url && !vid.url.startsWith('http')) {
                              await apiFetch(`/api/rag/sources/${vid.url}`, { method: 'DELETE' });
                            }
                            if (vid.storagePath) {
                              await deletePrivateStorageObject(vid.storagePath).catch((err: any) => {
                                console.warn("Storage delete failed client-side (warn only):", err);
                              });
                            }
                            const nextData = structuredClone(data);
                            nextData[currentSubject].topics[topic].videos.splice(idx, 1);
                            saveData(nextData);
                          } catch (err: any) {
                            alert('Delete failed: ' + err.message);
                          }
                        }}
                        className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
                        title="Delete Attachment"
                      >
                        <i className="fa-regular fa-trash-can text-sm"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
