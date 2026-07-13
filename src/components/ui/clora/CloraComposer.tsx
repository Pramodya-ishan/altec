import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { Paperclip, Mic, ArrowUp, X, StopCircle } from 'lucide-react';
import { CloraToolPalette, ToolOption } from './CloraToolPalette';

interface CloraComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onAttachClick?: () => void;
  onMicClick?: () => void;
  onStopClick?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  attachments?: any[];
  onRemoveAttachment?: (id: string) => void;
  onErrorLogSelect?: () => void;
}

export function CloraComposer({
  input,
  setInput,
  onSubmit,
  onAttachClick,
  onMicClick,
  onStopClick,
  isStreaming,
  disabled,
  attachments = [],
  onRemoveAttachment,
  onErrorLogSelect
}: CloraComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [palettePos, setPalettePos] = useState({ top: 0, left: 16 });
  const [viewportOffset, setViewportOffset] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;
    
    const viewport = window.visualViewport;
    const updateOffset = () => {
      // Calculate if the visual viewport is smaller than the layout viewport
      const offset = window.innerHeight - viewport.height;
      // Account for scroll offset within the viewport
      const offsetTop = viewport.offsetTop;
      
      // If there's a significant shrink, it's typically the keyboard
      setViewportOffset(Math.max(0, offset - offsetTop));
    };

    viewport.addEventListener('resize', updateOffset);
    viewport.addEventListener('scroll', updateOffset);
    
    updateOffset();
    
    return () => {
      viewport.removeEventListener('resize', updateOffset);
      viewport.removeEventListener('scroll', updateOffset);
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachments.length > 0) {
        onSubmit();
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Command palette detection (@ trigger)
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursor);
    const lastAtMatch = textBeforeCursor.match(/@(\w*)$/);

    if (lastAtMatch) {
      setCommandQuery(lastAtMatch[1]);
      setShowCommandPalette(true);
    } else {
      setShowCommandPalette(false);
    }
  };

  const handleToolSelect = (tool: ToolOption) => {
    if (tool.id === "error" && onErrorLogSelect) {
      onErrorLogSelect();
      setShowCommandPalette(false);
      const cursor = textareaRef.current?.selectionStart || 0;
      const textBefore = input.slice(0, cursor);
      const textAfter = input.slice(cursor);
      const clearedTextBefore = textBefore.replace(/@\w*$/, "");
      setInput(clearedTextBefore + textAfter);
      return;
    }

    const cursor = textareaRef.current?.selectionStart || 0;
    const textBefore = input.slice(0, cursor);
    const textAfter = input.slice(cursor);
    
    // Replace the @query part with the full command
    const newTextBefore = textBefore.replace(/@\w*$/, tool.command + " ");
    
    setInput(newTextBefore + textAfter);
    setShowCommandPalette(false);
    
    // Focus and move cursor after the inserted command
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newTextBefore.length;
        textareaRef.current.selectionEnd = newTextBefore.length;
      }
    }, 0);
  };

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto px-4 pb-6"
      style={{
        transform: viewportOffset > 0 ? `translateY(-${viewportOffset}px)` : 'none',
        transition: 'transform 0.1s ease-out'
      }}
    >
      <CloraToolPalette 
        isOpen={showCommandPalette} 
        query={commandQuery} 
        onSelect={handleToolSelect}
        position={palettePos}
      />

      <motion.div 
        layout
        className={cn(
          "relative flex flex-col bg-white border border-slate-200/80 rounded-[28px] shadow-lg shadow-slate-100/50 transition-all duration-300",
          input.length > 0 ? "border-indigo-500/30 shadow-md shadow-indigo-500/5" : ""
        )}
      >
        {/* Attachments Area */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl text-sm max-w-[200px]">
                <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate text-slate-700 font-medium">{att.name || "Attachment"}</span>
                <button 
                  onClick={() => onRemoveAttachment?.(att.id || i)}
                  className="ml-auto p-1 hover:bg-slate-200/60 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 p-3">
          <button
            type="button"
            onClick={onAttachClick}
            className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors flex-shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or type @ to use tools..."
            disabled={disabled}
            className="flex-1 max-h-[200px] py-3 px-2 bg-transparent resize-none outline-none clora-scrollbar text-slate-800 placeholder:text-slate-400"
            rows={1}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopClick}
              className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors flex-shrink-0"
            >
              <StopCircle className="w-6 h-6 fill-current" />
            </button>
          ) : (
            <>
              {!input.trim() && onMicClick && (
                <button
                  type="button"
                  onClick={onMicClick}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors flex-shrink-0"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
              
              <AnimatePresence>
                {(input.trim() || attachments.length > 0) && (
                  <motion.button
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    type="button"
                    onClick={onSubmit}
                    className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-lg flex-shrink-0 transition-transform active:scale-95"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
      <div className="text-center mt-3">
        <p className="text-[11px] text-slate-400 font-medium">Clora X can make mistakes. Check important info.</p>
      </div>
    </div>
  );
}
