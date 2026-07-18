import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { motion, AnimatePresence } from 'motion/react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Let Vite fingerprint and serve the exact worker version used by react-pdf.
// A runtime manifest fetch could be intercepted by a stale service worker and
// return index.html, which PDF.js rejected as a non-JavaScript module.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title: string;
}

export function PdfViewerModal({ isOpen, onClose, pdfUrl, title }: PdfViewerModalProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !pdfUrl) return null;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error);
    setError(error.message);
    setLoading(false);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm truncate pr-4">{title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" 
                  onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-medium text-slate-500 w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button type="button" 
                  onClick={() => setScale(s => Math.min(3, s + 0.25))}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-300 mx-2" />
                <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-auto bg-slate-100 flex justify-center relative p-4">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-100">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                  <span className="text-sm font-medium text-slate-500">Opening PDF…</span>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-100 text-rose-500">
                  <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-center max-w-md">
                    <p className="font-bold mb-1">The PDF could not be opened</p>
                    <p className="text-xs">{error}</p>
                    <button type="button" 
                      onClick={() => window.open(pdfUrl, '_blank')}
                      className="mt-4 text-xs font-bold underline hover:text-rose-700"
                    >
                      Open in a new tab
                    </button>
                  </div>
                </div>
              )}
              
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                className="flex flex-col items-center shadow-lg"
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale} 
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="bg-white"
                  loading={null}
                />
              </Document>
            </div>

            {/* Footer / Controls */}
            {numPages && (
              <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-slate-100 bg-white">
                <button type="button"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold text-slate-600 font-mono">
                  {pageNumber} <span className="text-slate-400">/</span> {numPages}
                </span>
                <button type="button"
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber(prev => Math.min(numPages, prev + 1))}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
