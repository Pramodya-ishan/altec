content = """import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { apiFetch } from '../../lib/api';

export function NotesModal({ topic, close }: { topic: string; close: () => void }) {
  const { data, saveData, currentSubject } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videos = data[currentSubject]?.topics[topic]?.videos || [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large (limit 20MB)");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storage = getStorage();
      const filename = `attachments/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(p);
        },
        (err) => {
          console.error("Upload failed", err);
          alert("Upload failed: " + err.message);
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Add to data
            const nextData = structuredClone(data);
            if (!nextData[currentSubject].topics[topic].videos) {
              nextData[currentSubject].topics[topic].videos = [];
            }
            nextData[currentSubject].topics[topic].videos.push({
              title: file.name,
              url: downloadURL,
              type: file.type
            });
            saveData(nextData);
            
            // Also index for AI RAG!
            await apiFetch('/api/rag/ingest', {
              method: 'POST',
              body: JSON.stringify({
                sourceId: filename,
                storagePath: filename,
                downloadURL: downloadURL,
                subject: currentSubject,
                lesson: topic,
                sourceScope: 'private',
                sourceType: 'attachment'
              })
            }).catch(e => console.warn("Background RAG ingestion failed", e));
            
            setIsUploading(false);
            setUploadProgress(0);
          } catch(e: any) {
             alert("Upload finalizing failed: " + e.message);
             setIsUploading(false);
          }
        }
      );
    } catch(err: any) {
       console.error(err);
       alert("Error starting upload: " + err.message);
       setIsUploading(false);
    }
  };

  const openPrivateStoragePdf = async (path: string) => {
      // It's a full download url if it starts with http, we just let the browser open it.
      // If it's a gs:// or something else, we handle it. But we stored downloadURL!
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full sm:max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:h-[85vh]"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 shadow-sm z-10 relative">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <i className="fa-solid fa-paperclip"></i>
            </div>
            <span className="truncate hidden sm:inline">Attachments</span>
            <span className="truncate sm:hidden text-lg">Attachments</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
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
                             // Use fallback api if needed, though they should be http now.
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
    </div>
  );
}
"""
with open("src/components/modals/NotesModal.tsx", "w") as f:
    f.write(content)
