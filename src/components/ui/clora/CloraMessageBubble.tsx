import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CheckCircle2, Copy, FileText, Image as ImageIcon, Reply, RotateCcw } from 'lucide-react';
import { MathMarkdown } from '../../chat/MathMarkdown';
import { VisualBlockRenderer } from '../VisualBlockRenderer';
import { sanitizeAssistantDisplayText } from '../../../lib/assistantTextHygiene';

interface CloraMessageBubbleProps {
  message: any;
  isStreaming: boolean;
  onToolClick?: (tool: string) => void;
  onReply?: (message: any) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onRetryImage?: (prompt: string) => void;
}

function ReplyPreview({ replyTo }: { replyTo: any }) {
  if (!replyTo) return null;
  return (
    <div className="mb-2 min-w-0 border-l-2 border-slate-300 pl-3 text-xs text-slate-500">
      <p className="font-semibold text-slate-600">Replying to {replyTo.role === 'assistant' ? 'Assistant' : 'you'}</p>
      <p className="mt-0.5 line-clamp-2 [overflow-wrap:anywhere]">{replyTo.content}</p>
    </div>
  );
}

function ThinkingSkeleton({ label }: { label?: string }) {
  return (
    <div className="max-w-xl py-1" role="status" aria-live="polite">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-300 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-500" />
        </span>
        {label || 'Thinking'}
      </div>
      <div className="space-y-2.5" aria-hidden="true">
        <motion.div className="h-2.5 rounded-full bg-slate-100" initial={{ width: '35%' }} animate={{ width: ['35%', '82%', '48%'] }} transition={{ duration: 1.5, repeat: Infinity }} />
        <motion.div className="h-2.5 rounded-full bg-slate-100" initial={{ width: '70%' }} animate={{ width: ['70%', '42%', '76%'] }} transition={{ duration: 1.7, repeat: Infinity }} />
        <motion.div className="h-2.5 rounded-full bg-slate-100" initial={{ width: '52%' }} animate={{ width: ['52%', '68%', '32%'] }} transition={{ duration: 1.6, repeat: Infinity }} />
      </div>
    </div>
  );
}

export const CloraMessageBubble = React.memo(function CloraMessageBubble({
  message,
  isStreaming,
  onToolClick,
  onReply,
  onSuggestionClick,
  onRetryImage,
}: CloraMessageBubbleProps) {
  const isUser = message.role === 'user';
  const displayContent = isUser ? String(message.content || '') : sanitizeAssistantDisplayText(message.content);
  const [copied, setCopied] = useState(false);
  const visualBlocks = Array.isArray(message.visualBlocks) ? message.visualBlocks : [];
  const leadVisualBlocks = visualBlocks.filter((block: any) => block?.type === 'pdf_image_preview');
  const supportingVisualBlocks = visualBlocks.filter((block: any) => block?.type !== 'source_evidence' && block?.type !== 'pdf_image_preview');
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
  }, []);

  const copyMessage = async () => {
    if (!displayContent) return;
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  if (isUser) {
    return (
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group mb-7 flex w-full justify-end px-0 sm:px-0">
        <div className="max-w-[88%] min-w-0 sm:max-w-[75%]">
          <ReplyPreview replyTo={message.replyTo} />
          <div className="rounded-[22px] rounded-br-md bg-[#f4f4f4] px-4 py-3 text-[15px] leading-6 text-slate-900 [overflow-wrap:anywhere] [word-break:normal]">
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
          <button type="button" onClick={() => onReply?.(message)} className="mt-1 ml-auto flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-slate-400 opacity-100 hover:bg-slate-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Reply to message">
            <Reply className="h-3.5 w-3.5" /> Reply
          </button>
        </div>
      </motion.div>
    );
  }

  const showThinking = isStreaming && !message.content;
  const generatedImage = message.generatedImage;

  return (
    <motion.div layout initial={isStreaming ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: isStreaming ? 0 : 0.2 }} className="group mb-9 flex w-full min-w-0 justify-start">
      <div className="flex w-full min-w-0 gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <ReplyPreview replyTo={message.replyTo} />

          <AnimatePresence mode="wait">
            {showThinking && <ThinkingSkeleton key="thinking" label={message.thinkingStatus || 'Thinking'} />}
          </AnimatePresence>

          {leadVisualBlocks.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {leadVisualBlocks.map((block: any, index: number) => <VisualBlockRenderer key={`lead-${index}`} block={block} />)}
            </div>
          )}

          {generatedImage?.url && (
            <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img src={generatedImage.url} alt={generatedImage.alt || 'Generated educational image'} className="block h-auto max-h-[680px] w-full object-contain" loading="lazy" />
              <figcaption className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"><ImageIcon className="h-3.5 w-3.5" /> Generated educational visual</figcaption>
            </figure>
          )}

          {message.imageError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>{message.imageError}</span>
              <button type="button" onClick={() => onRetryImage?.(message.imagePrompt || '')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold shadow-sm ring-1 ring-amber-200"><RotateCcw className="h-3.5 w-3.5" /> Retry</button>
            </div>
          )}

          {message.content && (
            <div lang={/[\u0D80-\u0DFF]/u.test(displayContent) ? 'si' : 'en'} className="sinhala-rendering prose prose-slate min-w-0 max-w-none text-[15px] leading-7 text-slate-800 [overflow-wrap:anywhere] [word-break:normal] prose-headings:mb-3 prose-headings:mt-6 prose-p:my-3 prose-pre:max-w-full prose-pre:overflow-x-auto prose-table:block prose-table:max-w-full prose-table:overflow-x-auto">
              <MathMarkdown content={displayContent} isStreaming={message.status === 'typing'} />
            </div>
          )}

          {supportingVisualBlocks.length > 0 && (
            <div className="grid grid-cols-1 gap-3 pt-1">
              {supportingVisualBlocks.map((block: any, index: number) => <VisualBlockRenderer key={`support-${index}`} block={block} />)}
            </div>
          )}

          {!isStreaming && Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.suggestions.slice(0, 3).map((suggestion: string) => (
                <button key={suggestion} type="button" onClick={() => onSuggestionClick?.(suggestion)} className="min-h-10 rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {!isStreaming && (message.content || message.sources?.length > 0 || generatedImage?.url) && (
            <div className="flex items-center gap-1 pt-1 text-slate-400 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {message.content && <button type="button" onClick={copyMessage} className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-700" aria-label="Copy answer" title="Copy answer">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>}
              <button type="button" onClick={() => onReply?.(message)} className="rounded-lg p-2 hover:bg-slate-100 hover:text-slate-700" aria-label="Reply to answer" title="Reply"><Reply className="h-4 w-4" /></button>
              {message.sources?.length > 0 && <button type="button" onClick={() => onToolClick?.('sources')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-slate-100 hover:text-slate-700"><FileText className="h-4 w-4" /> Sources {message.sources.length}</button>}
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
  && previous.message.thinkingStatus === next.message.thinkingStatus
  && previous.message.sources?.length === next.message.sources?.length
  && previous.message.visualBlocks?.length === next.message.visualBlocks?.length
  && previous.message.suggestions?.join('|') === next.message.suggestions?.join('|')
  && previous.message.generatedImage?.url === next.message.generatedImage?.url
));
