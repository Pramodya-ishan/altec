import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { FileText, Download, Sparkles, CheckCircle, Lock, Globe, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { getPdfOpenErrorMessage, openSourcePdf } from '../../lib/sourceActions';
import { cn } from '../../lib/utils';

export interface SourceCardProps {
  id: string;
  title: string;
  subject?: string;
  lesson?: string;
  year?: string;
  page?: string | number;
  confidence?: number;
  sourceScope?: string;
  sourceType?: string;
  storagePath?: string;
  ownerUid?: string;
  onAskClick?: () => void;
  compact?: boolean;
}

export const SourceCard: React.FC<SourceCardProps> = ({
  id,
  title,
  subject,
  lesson,
  year,
  page,
  confidence,
  sourceScope = 'personal',
  sourceType,
  storagePath,
  ownerUid,
  onAskClick,
  compact = false
}) => {
  const getReliabilityBadge = () => {
    if (sourceType === 'estimated') {
      return { text: 'Estimated', icon: <AlertTriangle className="w-3 h-3" />, colorClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (sourceScope === 'owner_syllabus' || sourceType === 'syllabus' || sourceType === 'past_paper' || sourceType === 'model_paper') {
      return { text: 'Verified PDF', icon: <CheckCircle className="w-3 h-3" />, colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (sourceScope === 'candidate_web' || sourceScope === 'web_search') {
      return { text: 'Candidate Web', icon: <Globe className="w-3 h-3" />, colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    return { text: 'Private PDF', icon: <Lock className="w-3 h-3" />, colorClass: 'bg-slate-100 text-slate-700 border-slate-300' };
  };

  const badgeInfo = getReliabilityBadge();

  const handleDownload = async () => {
    try {
      await openSourcePdf({ storagePath, id, sourceId: id, title, url: `/api/rag/sources/${id}/download` });
    } catch (error: unknown) {
      console.warn('Secure PDF open failed:', error);
      alert(getPdfOpenErrorMessage(error));
    }
  };


  if (compact) {
    return (
      <Card className="flex items-center justify-between gap-2.5 p-2 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all rounded-xl w-full shadow-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-1.5 bg-slate-100 rounded-lg shrink-0 text-slate-500">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-bold text-xs text-slate-900 truncate block max-w-[180px] sm:max-w-[280px]">
                {title}
              </span>
              {confidence !== undefined && (
                <span className={cn(
                  "inline-block shrink-0 px-1.5 py-0.5 text-[9px] font-bold border rounded-full",
                  confidence > 0.85 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  confidence > 0.6 ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-rose-50 text-rose-700 border-rose-200"
                )}>
                  {(confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
              <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-black uppercase text-[8px]", badgeInfo.colorClass)}>
                {badgeInfo.icon}
                {badgeInfo.text}
              </span>
              {(page !== undefined || year) && (
                <span className="flex items-center gap-1">
                  {year && <span>{year}</span>}
                  {year && page !== undefined && <span className="opacity-50">•</span>}
                  {page !== undefined && <span>Pg {page}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 pr-1">
           <button 
             onClick={handleDownload}
             className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm"
             title="Download PDF"
           >
             <Download className="w-3.5 h-3.5" />
           </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col p-4 bg-white border border-slate-200 hover:border-indigo-300 transition-all rounded-2xl w-full shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
           <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
             <FileText className="w-5 h-5" />
           </div>
           <div>
             <h4 className="font-bold text-sm text-slate-900 leading-tight mb-1 line-clamp-2">
               {title}
             </h4>
             <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-black uppercase text-[9px]", badgeInfo.colorClass)}>
               {badgeInfo.icon}
               {badgeInfo.text}
             </span>
           </div>
        </div>
        {confidence !== undefined && (
          <div className="text-right">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Match</div>
             <div className={cn(
               "text-sm font-black",
               confidence > 0.85 ? "text-emerald-600" :
               confidence > 0.6 ? "text-amber-600" :
               "text-rose-600"
             )}>
               {(confidence * 100).toFixed(0)}%
             </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
        {subject && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Subject:</span>
            <span className="text-slate-800 font-bold uppercase">{subject}</span>
          </div>
        )}
        {lesson && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Lesson:</span>
            <span className="text-slate-800 font-bold truncate max-w-[120px]" title={lesson}>{lesson}</span>
          </div>
        )}
        {(year || page !== undefined) && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Ref:</span>
            <span className="text-slate-800 font-bold">
              {year}{year && page !== undefined ? ', ' : ''}{page !== undefined ? `Page ${page}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-auto">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleDownload}
          className="text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Download
        </Button>
        {onAskClick && (
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onAskClick}
            className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Analyze
          </Button>
        )}
      </div>
    </Card>
  );
};
