import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { MathMarkdown } from '../../chat/MathMarkdown';
import { Sparkles, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { VisualBlockRenderer } from '../VisualBlockRenderer';

interface CloraMessageBubbleProps {
  message: any;
  isStreaming: boolean;
  onToolClick?: (tool: string) => void;
}

export const CloraMessageBubble = React.memo(function CloraMessageBubble({ message, isStreaming, onToolClick }: CloraMessageBubbleProps) {
  const isUser = message.role === 'user';
  
  if (isUser) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex w-full justify-end px-4 mb-8"
      >
        <div className="bg-indigo-600 text-white rounded-3xl rounded-br-lg px-5 py-3 max-w-[85%] md:max-w-[70%] text-[15px] leading-relaxed shadow-lg">
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map((att: any, i: number) => (
                <div key={i} className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-xl text-sm text-white/90 shadow-sm flex items-center gap-2">
                  <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Assistant Message
  return (
    <motion.div
      layout
      initial={isStreaming ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: isStreaming ? 0 : 0.2, ease: "easeOut" }}
      className="flex w-full justify-start px-4 mb-8 group"
    >
      <div className="flex gap-4 max-w-4xl w-full">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
          <Sparkles className="w-4 h-4 text-white" />
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-4">
          
          {/* Answer Status Panel (replaces ThoughtProcessPanel) */}
          {message.status && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-600">
                {message.status === 'streaming' || message.status === 'searching' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="capitalize">
                  {message.status === 'streaming' ? 'Generating answer...' : 
                   message.status === 'searching' ? 'Searching internet...' : 
                   'Finished'}
                </span>
                
                {/* Expandable step details could go here via a popover, keeping UI clean */}
                <button className="ml-1 p-0.5 hover:bg-slate-100 rounded-full transition-colors">
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {/* Actual Markdown Content */}
          {message.content && (
            <div className="prose prose-slate max-w-none text-[15px] leading-relaxed prose-p:my-2 prose-headings:mb-3 prose-headings:mt-6 text-slate-800">
              <MathMarkdown content={message.content} isStreaming={isStreaming} />
            </div>
          )}

          {/* Visual Blocks (if any) */}
          {message.visualBlocks && message.visualBlocks.length > 0 && (
             <div className="grid grid-cols-1 gap-4 mt-4">
                {message.visualBlocks.map((block: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-lg">
                    <VisualBlockRenderer block={block} />
                  </div>
                ))}
             </div>
          )}

          {/* Action Row (Sources, Copy, TTS) */}
          {!isStreaming && (message.content || message.sources?.length > 0) && (
            <div className="flex items-center gap-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
               {message.sources && message.sources.length > 0 && (
                 <button 
                   onClick={() => onToolClick?.('sources')}
                   className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
                 >
                   <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                     {message.sources.length}
                   </span>
                   Sources
                 </button>
               )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}, (prev, next) => {
  return prev.message.id === next.message.id && 
         prev.message.content === next.message.content && 
         prev.isStreaming === next.isStreaming &&
         prev.message.status === next.message.status &&
         prev.message.visualBlocks?.length === next.message.visualBlocks?.length;
});
