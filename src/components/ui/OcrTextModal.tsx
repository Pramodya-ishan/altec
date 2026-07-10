import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Copy, Download, Check, Sparkles, AlertCircle } from 'lucide-react';

interface OcrPage {
  pageNumber: number;
  text: string;
  confidence?: number;
  method?: string;
}

interface OcrTextModalProps {
  sourceId: string;
  title: string;
  onClose: () => void;
}

export const OcrTextModal: React.FC<OcrTextModalProps> = ({ sourceId, title, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<OcrPage[]>([]);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchOcrText = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch(`/api/pdf/ocr-text/${sourceId}`);
        const data = await res.json().catch(() => null);

        if (!active) return;

        if (res.ok && data?.ok) {
          setPages(data.pages || []);
        } else {
          setError(data?.error || "Failed to retrieve OCR text.");
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "An unexpected error occurred while fetching OCR text.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchOcrText();
    return () => {
      active = false;
    };
  }, [sourceId]);

  const handleCopyPage = async () => {
    if (pages.length === 0) return;
    try {
      const currentText = pages[selectedPageIdx]?.text || "";
      await navigator.clipboard.writeText(currentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const handleDownloadTranscript = () => {
    if (pages.length === 0) return;
    try {
      const fullText = pages
        .map((p) => `--- PAGE ${p.pageNumber} ---\n\n${p.text}`)
        .join("\n\n");
      const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_\u0D80-\u0DFF-]/g, "_")}_extracted_text.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download text", err);
    }
  };

  const currentPage = pages[selectedPageIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative flex flex-col w-full max-w-4xl h-[85vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-800 truncate" title={title}>
                {title}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Extracted Sinhala Unicode Text View
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
              <span className="text-xs font-semibold text-slate-500 animate-pulse">
                Sinhala text index කියවමින් පවතී...
              </span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="font-bold text-slate-800 mb-1">Text Loading Failed</h4>
              <p className="text-slate-500 text-xs max-w-md mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition-all"
              >
                Close View
              </button>
            </div>
          ) : pages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
              <h4 className="font-bold text-slate-800 mb-1">No Extracted Text Available</h4>
              <p className="text-slate-500 text-xs max-w-md">
                මෙම PDF පත්‍රිකාවේ extract කරන ලද text අඩංගු නොවේ. කරුණාකර නැවත Reindex/OCR කරන්න.
              </p>
            </div>
          ) : (
            <>
              {/* Sidebar: Page selection tabs */}
              <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-100 flex flex-row md:flex-col shrink-0 overflow-x-auto md:overflow-y-auto p-3 gap-1.5 bg-slate-50/50">
                {pages.map((p, idx) => (
                  <button
                    key={p.pageNumber}
                    onClick={() => setSelectedPageIdx(idx)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition-all text-left shrink-0 flex items-center justify-between gap-2 ${
                      idx === selectedPageIdx
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>Page {p.pageNumber}</span>
                    {p.confidence !== undefined && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded-full font-black ${
                          idx === selectedPageIdx
                            ? "bg-indigo-700/50 text-indigo-100"
                            : p.confidence > 0.85
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {(p.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Text viewer area */}
              <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Actions & Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-50 bg-slate-50/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Method:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                      <Sparkles className="w-2.5 h-2.5" />
                      {currentPage?.method === "cloud_vision_ocr" ? "Cloud Vision OCR" : "Native PDF Extraction"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyPage}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-bold transition-all shadow-sm"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Page</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadTranscript}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-bold transition-all shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download All</span>
                    </button>
                  </div>
                </div>

                {/* Text Body */}
                <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed text-slate-700 selection:bg-indigo-100 whitespace-pre-wrap">
                  {currentPage?.text || "No text available for this page."}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
