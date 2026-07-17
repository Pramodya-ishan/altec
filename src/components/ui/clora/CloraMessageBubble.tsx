import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, CheckCircle2, Copy, FileText, Loader2 } from 'lucide-react';
import { MathMarkdown } from '../../chat/MathMarkdown';
import { VisualBlockRenderer } from '../VisualBlockRenderer';

interface CloraMessageBubbleProps {
  message: any;
  isStreaming: boolean;
  onToolClick?: (tool: string) => void;
}

export const CloraMessageBubble = React.memo(function CloraMessageBubble({ message, isStreaming, onToolClick }: CloraMessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
  }, []);

  const copyMessage = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  if (isUser) {
    return (
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-7 flex w-full justify-end px-4 sm:px-6">
        <div className="max-w-[88%] min-w-0 rounded-[22px] rounded-br-md bg-[#f4f4f4] px-4 py-3 text-[15px] leading-6 text-slate-900 [overflow-wrap:anywhere] [word-break:normal] sm:max-w-[75%]">
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              {message.attachments.map((attachment: any, index: number) => (
                <span key={attachment.storagePath || attachment.name || index} className="inline-flex max-w-[220px] items-center gap-2 rounded-lg bg-white p-2 text-xs text-slate-600 ring-1 ring-slate-200">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate font-semibold">{attachment.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={isStreaming ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isStreaming ? 0 : 0.2 }}
      className="group mb-9 flex w-full min-w-0 justify-start"
    >
      <div className="flex w-full min-w-0 gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {message.status && (message.status === 'streaming' || message.status === 'searching') && (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {message.status === 'searching' ? 'Searching sources' : 'Preparing answer'}
            </div>
          )}

          {message.content && (
            <div className="prose prose-slate min-w-0 max-w-none text-[15px] leading-7 text-slate-800 [overflow-wrap:anywhere] [word-break:normal] prose-headings:mb-3 prose-headings:mt-6 prose-p:my-2 prose-pre:max-w-full prose-pre:overflow-x-auto prose-table:block prose-table:max-w-full prose-table:overflow-x-auto">
              <MathMarkdown content={message.content} isStreaming={isStreaming} />
            </div>
          )}

          {message.visualBlocks?.length > 0 && (
            <div className="grid grid-cols-1 gap-4 pt-1">
              {message.visualBlocks.map((block: any, index: number) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <VisualBlockRenderer block={block} />
                </div>
              ))}
            </div>
          )}

          {!isStreaming && (message.content || message.sources?.length > 0) && (
            <div className="flex items-center gap-1 pt-1 text-slate-400 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {message.content && (
                <button type="button" onClick={copyMessage} className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-700" aria-label="Copy answer" title="Copy answer">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
              {message.sources?.length > 0 && (
                <button type="button" onClick={() => onToolClick?.('sources')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-700">
                  <FileText className="h-4 w-4" /> Sources {message.sources.length}
                </button>
              )}
              {message.status === 'done' && <CheckCircle2 className="ml-1 h-3.5 w-3.5 text-emerald-500" aria-label="Answer complete" />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}, (previous, next) => (
  previous.message.id === next.message.id
  && previous.message.content === next.message.content
  && previous.isStreaming === next.isStreaming
  && previous.message.status === next.message.status
  && previous.message.sources?.length === next.message.sources?.length
  && previous.message.visualBlocks?.length === next.message.visualBlocks?.length
));
