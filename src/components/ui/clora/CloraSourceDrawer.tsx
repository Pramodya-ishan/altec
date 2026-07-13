import React from 'react';
import { motion } from 'motion/react';
import { FileText, X, ExternalLink } from 'lucide-react';
import { getPdfUrl } from '../../../lib/sourceActions';

interface CloraSourceDrawerProps {
  sources: any[];
  onClose: () => void;
  onSourceClick: (source: any, preview: boolean) => void;
}

export function CloraSourceDrawer({ sources, onClose, onSourceClick }: CloraSourceDrawerProps) {
  // Deduplicate sources by ID or title
  const uniqueSources = Array.from(
    new Map(sources.map((s) => [s.id || s.sourceId || s.title, s])).values()
  );

  return (
    <div className="flex flex-col h-full bg-white text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Used Sources</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto clora-scrollbar p-3 space-y-2">
        {uniqueSources.length === 0 ? (
          <div className="text-center py-10 px-4">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No sources referenced in this answer.</p>
          </div>
        ) : (
          uniqueSources.map((source, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              key={source.id || i}
              onClick={() => onSourceClick(source, false)}
              className="flex flex-col p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/50 transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {source.title || source.name || "Unknown Source"}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
              </div>
              
              {source.snippet && (
                <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed border-l-2 border-indigo-200 pl-2 my-2 italic">
                  "{source.snippet}"
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-auto pt-2 text-[10px] text-slate-400 font-medium justify-between">
                {source.pageNumber ? (
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-500">
                    Page {source.pageNumber}
                  </span>
                ) : <span />}
                {source.relevanceScore && (
                  <span>Relevance: {Math.round(source.relevanceScore * 100)}%</span>
                )}
              </div>

              {/* Action buttons offering Open PDF and Preview */}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onSourceClick(source, false)}
                  className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open PDF
                </button>
                <button
                  onClick={() => onSourceClick(source, true)}
                  className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  Preview
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
