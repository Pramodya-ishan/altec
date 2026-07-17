import React from 'react';
import { motion } from 'motion/react';
import { FileText, X, ExternalLink } from 'lucide-react';

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
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">භාවිත මූලාශ්‍ර</h3>
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
            <p className="text-sm font-medium text-slate-500">මෙම පිළිතුරට මූලාශ්‍ර භාවිත කර නැහැ.</p>
          </div>
        ) : (
          uniqueSources.map((source, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              key={source.id || i}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-3 transition-all hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="line-clamp-2 text-xs font-bold text-slate-800 transition-colors group-hover:text-black">
                  {source.title || source.name || "නම නොදන්නා මූලාශ්‍රය"}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-900" />
              </div>
              
              {source.snippet && (
                <p className="my-2 line-clamp-3 border-l-2 border-slate-200 pl-2 text-[11px] italic leading-relaxed text-slate-500">
                  "{source.snippet}"
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-auto pt-2 text-[10px] text-slate-400 font-medium justify-between">
                {source.pageNumber ? (
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-500">
                    පිටුව {source.pageNumber}
                  </span>
                ) : <span />}
                {source.relevanceScore && (
                  <span>අදාළත්වය: {Math.round(source.relevanceScore * 100)}%</span>
                )}
              </div>

              {/* Keep the source action simple: open the authenticated document. */}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onSourceClick(source, false)}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-white transition hover:bg-black"
                >
                  <ExternalLink className="w-3 h-3" />
                  PDF ගොනුව විවෘත කරන්න
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
