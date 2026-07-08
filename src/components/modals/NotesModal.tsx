import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { apiFetch } from '../../lib/api';

export function NotesModal() {
  const { data, currentSubject, saveData, showNotification, modals, setModals } = useApp();
  const isOpen = modals?.playlist?.open;
  const topic = modals?.playlist?.topic || '';
  
  const close = () => {
    if (setModals) {
      setModals(prev => ({ ...prev, playlist: { ...prev.playlist, open: false } }));
    }
  };
  const [textNotes, setTextNotes] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'attachments'>('notes');
  
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTextNotes(data[currentSubject]?.topics[topic]?.notes || '');
  }, [topic, currentSubject, data]);

  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextNotes(e.target.value);
  };

  const saveNotes = (content: string) => {
    if (!topic.trim()) {
      showNotification('Select a valid lesson topic before saving notes.', 'error');
      return;
    }
    const nextData = structuredClone(data);
    if (!nextData[currentSubject]) {
       nextData[currentSubject] = { topics: {}, paperMarks: [], questionMarks: {}, lessonHistory: [] } as any;
    }
    if (!nextData[currentSubject].topics[topic]) {
      nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes: '' };
    }
    nextData[currentSubject].topics[topic].notes = content;
    saveData(nextData);
  };
  
  // Save on blur
  const handleNotesBlur = () => {
    if(topic) saveNotes(textNotes);
  };

  const insertText = (tag: string) => {
    setTextNotes(prev => prev + tag);
  };

  const handleGenerateAI = async () => {
    if (!topic.trim()) {
      showNotification('Select a valid lesson topic before generating notes.', 'error');
      return;
    }
    setIsGenerating(true);
    showNotification('AI generating notes...', 'info');
    try {
      const response = await apiFetch('/api/ai/respond-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: `Create a clean, well-structured, detailed educational summary study note in Sinhala and English about: ${topic}. Use bullets, markdown, code blocks if relevant.`,
          activeSubject: currentSubject,
          mode: 'tutor_explanation'
        })
      });
      if (!response.ok) throw new Error('AI generation failed');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Failed to get stream reader');

      let generated = '';
      const initialText = textNotes;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        
        const events = text.split("\n\n");
        for (const raw of events) {
          const eventName = raw.match(/^event:\s*(.+)$/m)?.[1]?.trim();
          const dataText = raw.match(/^data:\s*(.+)$/m)?.[1];
          if (eventName === 'chunk' && dataText) {
            try {
              const data = JSON.parse(dataText);
              generated += data.text || '';
              setTextNotes(initialText + generated);
            } catch (e) {}
          }
        }
      }
      
      saveNotes(initialText + generated);
      showNotification('AI notes generated!', 'success');
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'AI notes generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
        return;
    }
    if (!topic.trim()) {
        showNotification('Select a valid lesson topic before uploading files.', 'error');
        e.target.value = '';
        return;
    }

    setIsUploading(true);
    showNotification('Uploading file...', 'info');
    
    try {
      setUploadProgress(10);
      
      const response = await apiFetch(`/api/upload-proxy?name=${encodeURIComponent('files/' + Date.now() + '_' + file.name)}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });
      
      if (!response.ok) throw new Error('Upload failed');
      const { url: downloadURL } = await response.json();
      
      setUploadProgress(100);
      
      const finalTitle = file.name;
      const nextData = structuredClone(data);
      if (!nextData[currentSubject]) {
         nextData[currentSubject] = { topics: {}, paperMarks: [], questionMarks: {}, lessonHistory: [] } as any;
      }
      if (!nextData[currentSubject].topics[topic]) {
        nextData[currentSubject].topics[topic] = { checked: false, videos: [], notes: '' };
      }
      if (!nextData[currentSubject].topics[topic].videos) {
        nextData[currentSubject].topics[topic].videos = [];
      }
      nextData[currentSubject].topics[topic].videos.push({ url: downloadURL, title: finalTitle, type: file.type || 'application/pdf' });
      saveData(nextData);
      showNotification('File uploaded and attached!', 'success');
      setIsUploading(false);
      setUploadProgress(null);
    } catch (err) {
      console.error(err);
      showNotification('Upload error occurred.', 'error');
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const videos = data[currentSubject]?.topics[topic]?.videos || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-end sm:items-center justify-center z-[10000] backdrop-blur-sm p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full sm:max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:h-[85vh]"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 shadow-sm z-10 relative">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 tracking-tight min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm shrink-0">
              <i className="fa-solid fa-file-pdf"></i>
            </div>
            <span className="truncate hidden sm:inline">Lesson Notes: {topic}</span>
            <span className="truncate sm:hidden text-lg">Notes</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
        </div>
        
        
        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">
          <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('notes')}
              className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer", activeTab === 'notes' ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700")}
            >
              Smart Notes
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer", activeTab === 'attachments' ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700")}
            >
              Attachments
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={contentRef}>
            
              {activeTab === 'notes' && (
                <div className={cn("transition-opacity duration-200 flex flex-col gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm", activeTab !== 'notes' && "hidden")}>
                  <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                        <i className="fa-solid fa-pen text-amber-500"></i> Smart Notes
                      </h3>
                      <button
                        onClick={handleGenerateAI}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isGenerating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                        {isGenerating ? "Generating..." : "AI Perfect Note"}
                      </button>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                      {!isPreviewMode && (
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200 hidden sm:flex">
                          <button onClick={() => insertText('- ')} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer" title="Add Bullet">
                            <i className="fa-solid fa-list-ul text-xs"></i>
                          </button>
                          <button onClick={() => insertText('1. ')} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer" title="Add Number">
                            <i className="fa-solid fa-list-ol text-xs"></i>
                          </button>
                          <button onClick={() => insertText('**Bold**')} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer" title="Bold text">
                            <i className="fa-solid fa-bold text-xs"></i>
                          </button>
                          <button onClick={() => insertText('`Code`')} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-sm transition-all cursor-pointer" title="Inline code">
                            <i className="fa-solid fa-code text-xs"></i>
                          </button>
                        </div>
                      )}
                      {textNotes.trim() && (
                        <button
                          onClick={() => setIsPreviewMode(!isPreviewMode)}
                          className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                          <i className={`fa-solid ${isPreviewMode ? 'fa-pen-to-square' : 'fa-eye'}`}></i>
                          {isPreviewMode ? 'Edit Mode' : 'Preview'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-2 relative">
                    {isPreviewMode && textNotes.trim() ? (
                      <div className="w-full min-h-[16rem] p-4 sm:p-6 bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden transition-all text-sm text-slate-800 prose prose-sm prose-amber max-w-none shadow-inner">
                        <div className="markdown-body">
                          <Markdown>{textNotes}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <textarea
                        value={textNotes}
                        onChange={handleNotesChange}
                        onBlur={handleNotesBlur}
                        placeholder="Type your study notes here or generate a perfect note with AI..."
                        className="w-full h-64 sm:h-96 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-50 transition-all resize-none text-sm font-medium leading-relaxed placeholder:text-slate-400 shadow-inner"
                      />
                    )}
                  </div>
                </div>
              )}
              
              {activeTab === 'attachments' && (
                <div className={cn("transition-opacity duration-200 flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm", activeTab !== 'attachments' && "hidden")}>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                      <i className="fa-solid fa-paperclip text-slate-400"></i> Attachments & PDFs
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
                        <a
                          key={idx}
                          href={vid.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all bg-white group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-50 transition-colors">
                            <i className={`fa-solid ${vid.type?.includes('pdf') || vid.title.endsWith('.pdf') ? 'fa-file-pdf text-rose-500' : 'fa-file-image text-emerald-500'} text-lg`}></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{vid.title}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{vid.type?.includes('pdf') ? 'PDF Document' : 'Image'}</p>
                          </div>
                          <i className="fa-solid fa-arrow-up-right-from-square text-slate-300 group-hover:text-emerald-500 text-xs px-2"></i>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            
          </div>
        </div>
      </motion.div>
    </div>
  );
}
