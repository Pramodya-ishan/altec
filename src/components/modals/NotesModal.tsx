import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { saveVideoFile, deleteVideoFile, getVideoFile } from '../../lib/indexedDB';
import Markdown from 'react-markdown';

export function NotesModal() {
  const { modals, setModals, data, currentSubject, saveData, showNotification } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { open, topic } = modals.playlist;
  if (!open) return null;

  const subjectData = data[currentSubject];
  const topicData = subjectData.topics[topic] || { checked: false, videos: [], notes: '' };
  const files = topicData.videos || [];
  const textNotes = topicData.notes || '';

  const close = () => {
    setModals(prev => ({ ...prev, playlist: { open: false, topic: '' } }));
    setShowAddForm(false);
    setUrl('');
    setTitle('');
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextData = structuredClone(data);
    if (!nextData[currentSubject].topics[topic]) {
      nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes: '' };
    }
    nextData[currentSubject].topics[topic].notes = e.target.value;
    saveData(nextData);
  };

  const handleAddLink = () => {
    if (!url.trim()) {
      showNotification('Please enter a valid URL', 'error');
      return;
    }
    const finalTitle = title.trim() !== '' ? title.trim() : `Link ${files.length + 1}`;
    
    const nextData = structuredClone(data);
    if (!nextData[currentSubject].topics[topic]) {
      nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes: '' };
    }
    nextData[currentSubject].topics[topic].videos.push({ url: url.trim(), title: finalTitle });
    saveData(nextData);
    setUrl('');
    setTitle('');
    setShowAddForm(false);
    showNotification('Link added to notes', 'success');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      await saveVideoFile(id, file); // Reusing indexedDB generic file save
      const finalTitle = title.trim() !== '' ? title.trim() : file.name;
      
      const nextData = structuredClone(data);
      if (!nextData[currentSubject].topics[topic]) {
        nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes: '' };
      }
      nextData[currentSubject].topics[topic].videos.push({ url: `localdb://${id}`, title: finalTitle, type: file.type });
      saveData(nextData);
      
      setUrl('');
      setTitle('');
      setShowAddForm(false);
      showNotification('Local file attached successfully!', 'success');
    }
  };

  const removeFile = async (index: number) => {
    try {
      const targetFile = data[currentSubject]?.topics[topic]?.videos?.[index];
      if (targetFile && typeof targetFile.url === 'string' && targetFile.url.startsWith('localdb://')) {
        const fileId = targetFile.url.replace('localdb://', '');
        if (fileId) {
          await deleteVideoFile(fileId);
        }
      }
    } catch (err) {
      console.warn("Failed to flush local file on removal:", err);
    }
    const nextData = structuredClone(data);
    nextData[currentSubject].topics[topic].videos.splice(index, 1);
    saveData(nextData);
    showNotification('File removed', 'info');
  };

  const openAddForm = () => {
    setShowAddForm(true);
    setTimeout(() => {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type === 'application/pdf') {
        const file = items[i].getAsFile();
        if (file) {
           const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
           await saveVideoFile(id, file);
           const finalTitle = `Pasted ${file.type.includes('pdf') ? 'PDF' : 'Image'}`;
           const nextData = structuredClone(data);
           if (!nextData[currentSubject].topics[topic]) {
             nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes: '' };
           }
           nextData[currentSubject].topics[topic].videos.push({ url: `localdb://${id}`, title: finalTitle, type: file.type });
           saveData(nextData);
           showNotification(`Pasted file attached!`, 'success');
        }
      }
    }
  };

  const openFile = async (fileUrl: string) => {
    if (fileUrl.startsWith('localdb://')) {
       const id = fileUrl.replace('localdb://', '');
       try {
         const blob = await getVideoFile(id);
         if (blob) {
           const blobUrl = URL.createObjectURL(blob);
           window.open(blobUrl, '_blank');
         } else {
           showNotification('File not found in local storage.', 'error');
         }
       } catch (err) {
         showNotification('Error opening file.', 'error');
       }
    } else {
       window.open(fileUrl, '_blank');
    }
  };

  const getFileIcon = (file: any) => {
    if (file.type?.includes('pdf') || file.title.toLowerCase().endsWith('.pdf')) return 'fa-file-pdf text-red-500';
    if (file.type?.includes('image') || file.url.match(/\.(jpeg|jpg|gif|png)$/i)) return 'fa-image text-emerald-500';
    if (file.url.includes('youtube') || file.url.includes('youtu.be')) return 'fa-youtube text-red-500';
    return 'fa-link text-blue-500';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[10000] backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
              <i className="fa-solid fa-book-open"></i>
            </div>
            <span className="truncate">Lesson Notes: {topic}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={close} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 relative" ref={contentRef} onPaste={handlePaste}>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <i className="fa-solid fa-pen"></i> Quick Text Notes
              </label>
              {textNotes.trim() && (
                <button
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className="text-[11px] font-bold text-slate-500 hover:text-amber-600 transition-colors uppercase tracking-wider"
                >
                  <i className={`fa-solid ${isPreviewMode ? 'fa-pen-to-square' : 'fa-eye'} mr-1`}></i>
                  {isPreviewMode ? 'Edit' : 'Preview'}
                </button>
              )}
            </div>
            {isPreviewMode && textNotes.trim() ? (
              <div className="w-full min-h-[8rem] p-4 bg-white border border-slate-200 rounded-xl overflow-hidden transition-all text-sm text-slate-800 prose prose-sm prose-amber max-w-none">
                <div className="markdown-body">
                  <Markdown>{textNotes}</Markdown>
                </div>
              </div>
            ) : (
              <textarea 
                value={textNotes}
                onChange={handleNotesChange}
                placeholder="Type your study notes here. You can also paste images directly into this window..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition-all resize-y text-sm"
              />
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <i className="fa-solid fa-paperclip"></i> Attached Files & Links
            </label>
            {!showAddForm && (
              <button 
                onClick={openAddForm} 
                className="px-3 py-1.5 flex items-center gap-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors text-xs font-bold"
              >
                <i className="fa-solid fa-plus"></i> Add Attachment
              </button>
            )}
          </div>

          <AnimatePresence>
            {showAddForm && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col gap-4 relative">
                  <button 
                    onClick={() => setShowAddForm(false)}
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                  <h3 className="text-sm font-bold text-slate-700 tracking-tight flex items-center gap-2">
                    <i className="fa-solid fa-paperclip text-amber-500"></i> Attach Link or File
                  </h3>
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Title (Optional)"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition-all font-medium"
                    />
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Web Link (URL)"
                          value={url}
                          onChange={e => setUrl(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition-all"
                        />
                        <button
                          onClick={handleAddLink}
                          className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 active:scale-[0.98] transition-all whitespace-nowrap shadow-sm"
                        >
                          Add Link
                        </button>
                      </div>
                      <div className="text-center font-bold text-slate-400 text-xs my-0.5">OR</div>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileChange} 
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-4 py-2.5 bg-white border-2 border-dashed border-slate-300 text-slate-600 font-bold text-sm rounded-lg hover:bg-slate-50 hover:border-amber-400 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-upload"></i> Upload PDF / Image
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="col-span-full text-center py-8 bg-slate-50 hover:bg-slate-100 cursor-pointer border-2 border-dashed border-slate-300 hover:border-primary-400 transition-colors rounded-xl flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-10 h-10 bg-slate-200 group-hover:bg-primary-100 group-hover:text-primary-600 text-slate-400 rounded-full flex items-center justify-center text-lg transition-colors">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                </div>
                <p className="text-slate-500 group-hover:text-primary-600 text-xs font-bold transition-colors">Click to upload files or add links.</p>
              </div>
            ) : (
              files.map((file, index) => (
                <li key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                  <div 
                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                    onClick={() => openFile(file.url)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <i className={`fa-solid ${getFileIcon(file)} text-xl`}></i>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-slate-800 text-sm truncate">{file.title}</span>
                      <span className="text-[10px] text-slate-400 truncate">{file.url.startsWith('localdb://') ? 'Local File' : file.url}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0 ml-2"
                    title="Remove File"
                  >
                    <i className="fa-solid fa-trash-can text-sm"></i>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
