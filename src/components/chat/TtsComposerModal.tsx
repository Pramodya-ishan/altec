import React, { useState } from 'react';
import { Speaker, X, Loader2, Download, Link2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface TtsComposerModalProps {
  uploadedFile?: { sourceId?: string, name?: string, storagePath?: string, mimeType?: string, dataUrl?: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (audioUrl: string, storagePath: string) => void;
}

export function TtsComposerModal({ isOpen, onClose, onComplete, uploadedFile }: TtsComposerModalProps) {
  const [text, setText] = useState('');
  
  React.useEffect(() => {
    if (isOpen && uploadedFile && !text) {
       if (uploadedFile.mimeType === "text/plain" && uploadedFile.dataUrl) {
          fetch(uploadedFile.dataUrl).then(r => r.text()).then(t => setText(t)).catch(console.error);
       } else if (uploadedFile.sourceId) {
          setText(`[PDF Source: ${uploadedFile.name}] Please ask me to read a specific page or section using @live or by typing here.`);
       }
    }
  }, [isOpen, uploadedFile]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { generateTts } = await import("../../lib/ttsClient");
      const data = await generateTts(text, { languageCode: "si-LK" });
      onComplete(data.playableUrl, data.storagePath || "");
      onClose();
      setText('');
    } catch (err: any) {
      setError(err.message || "Failed to generate TTS");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Speaker className="w-5 h-5 text-indigo-600" />
            Text to Speech
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-500">Paste text below to generate natural-sounding voice audio in Sinhala or English.</p>
          
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste Sinhala/English text here..."
            className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
          />

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button"
              onClick={onClose}
              disabled={generating}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button type="button"
              onClick={handleGenerate}
              disabled={generating || !text.trim()}
              className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Speaker className="w-4 h-4" />}
              Generate Voice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
