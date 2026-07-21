import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowUp,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { CloraToolPalette, type ToolOption } from './CloraToolPalette';

export type UploadTelemetry = {
  fileName: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  remainingBytes: number;
  speedBytesPerSecond: number;
  etaSeconds: number;
  phase: 'uploading' | 'processing' | 'success' | 'error';
};

interface CloraComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onAttachClick?: () => void;
  onFilesAdded?: (files: File[]) => void | Promise<void>;
  onMicClick?: () => void;
  onStopClick?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  attachments?: any[];
  onRemoveAttachment?: (id: string | number) => void;
  onErrorLogSelect?: () => void;
  uploadTelemetry?: UploadTelemetry | null;
  uploadError?: string | null;
  indexingFailed?: boolean;
  onRetryIndexing?: () => void;
  replyTo?: { id: string; role: string; content: string } | null;
  onCancelReply?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Calculating…';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.ceil(seconds % 60);
  return `${minutes} min ${remainder} sec`;
}

function AttachmentIcon({ attachment }: { attachment: any }) {
  const type = String(attachment?.mimeType || attachment?.type || '').toLowerCase();
  if (attachment?.attachmentType === 'archive' || type.includes('zip')) return <FileArchive className="h-4 w-4" />;
  if (type.startsWith('video/')) return <FileVideo className="h-4 w-4" />;
  if (type.startsWith('audio/')) return <FileAudio className="h-4 w-4" />;
  if (type.startsWith('image/') || attachment?.isImage) return <ImageIcon className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function CloraComposer({
  input,
  setInput,
  onSubmit,
  onAttachClick,
  onFilesAdded,
  onMicClick,
  onStopClick,
  isStreaming,
  disabled,
  attachments = [],
  onRemoveAttachment,
  onErrorLogSelect,
  uploadTelemetry,
  uploadError,
  indexingFailed,
  onRetryIndexing,
  replyTo,
  onCancelReply,
  onFocusChange,
}: CloraComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncViewport = () => {
      document.documentElement.style.setProperty('--app-viewport-height', `${viewport.height}px`);
      if (document.activeElement === textareaRef.current) {
        window.requestAnimationFrame(() => textareaRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      }
    };
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
      document.documentElement.style.removeProperty('--app-viewport-height');
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && (input.trim() || attachments.length > 0)) onSubmit();
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setInput(value);
    const match = value.slice(0, event.target.selectionStart || 0).match(/@(\w*)$/);
    setCommandQuery(match?.[1] || '');
    setShowCommandPalette(Boolean(match));
  };

  const submitFiles = (files: File[]) => {
    const usable = files.filter((file) => file && file.size > 0);
    if (usable.length > 0 && !disabled) void onFilesAdded?.(usable);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = Array.from(event.clipboardData?.files || []);
    if (clipboardFiles.length === 0) return;
    event.preventDefault();
    const prepared = clipboardFiles.map((file, index) => {
      if (file.name && file.name !== 'image.png') return file;
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
      return new File([file], `pasted-question-${Date.now()}-${index + 1}.${extension}`, { type: file.type || `image/${extension}` });
    });
    submitFiles(prepared);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    submitFiles(Array.from(event.dataTransfer?.files || []));
  };

  const handleToolSelect = (tool: ToolOption) => {
    const cursor = textareaRef.current?.selectionStart || 0;
    const before = input.slice(0, cursor).replace(/@\w*$/, tool.id === 'error' ? '' : `${tool.command} `);
    const nextValue = before + input.slice(cursor);

    if (tool.id === 'error' && onErrorLogSelect) onErrorLogSelect();
    setInput(nextValue);
    setShowCommandPalette(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(before.length, before.length);
    });
  };

  const canSubmit = !disabled && (input.trim().length > 0 || attachments.length > 0);
  const notifyFocus = (focused: boolean) => {
    onFocusChange?.(focused);
    window.dispatchEvent(new CustomEvent('clora:composer-focus', { detail: { focused } }));
  };

  const telemetryLabel = uploadTelemetry?.phase === 'processing'
    ? 'Processing file'
    : uploadTelemetry?.phase === 'success'
      ? 'Upload complete'
      : uploadTelemetry?.phase === 'error'
        ? 'Upload failed'
        : 'Uploading securely';

  return (
    <div
      className="relative mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => { if (event.dataTransfer?.types?.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CloraToolPalette
        isOpen={showCommandPalette}
        query={commandQuery}
        onSelect={handleToolSelect}
        position={{ top: 0, left: 18 }}
      />

      <motion.div
        layout
        className={`relative overflow-hidden rounded-[26px] border bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] transition focus-within:border-slate-400 focus-within:shadow-[0_12px_36px_rgba(15,23,42,0.12)] ${isDraggingFiles ? 'border-indigo-400 ring-4 ring-indigo-100' : 'border-slate-200'}`}
      >
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-white/95 backdrop-blur-sm">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4 text-center shadow-sm">
              <Paperclip className="mx-auto h-6 w-6 text-indigo-600" />
              <p className="mt-2 text-sm font-bold text-indigo-950">Drop files into this chat</p>
              <p className="mt-0.5 text-xs text-indigo-700">PDF, image, ZIP, or project files</p>
            </div>
          </div>
        )}
        {replyTo && (
          <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <div className="min-w-0 border-l-2 border-slate-300 pl-3">
              <p className="text-[11px] font-semibold text-slate-600">Replying to {replyTo.role === 'assistant' ? 'Assistant' : 'your message'}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{replyTo.content}</p>
            </div>
            <button type="button" onClick={onCancelReply} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Cancel reply">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {((uploadTelemetry && uploadTelemetry.phase !== 'success') || uploadError) && (
          <div className="border-b border-slate-100 px-4 py-3">
            {uploadTelemetry && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{uploadTelemetry.fileName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      {uploadTelemetry.phase === 'uploading' || uploadTelemetry.phase === 'processing' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      {telemetryLabel}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{Math.round(uploadTelemetry.progress * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900 transition-[width] duration-300" style={{ width: `${Math.max(2, uploadTelemetry.progress * 100)}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-500 sm:grid-cols-4">
                  <span><strong className="text-slate-700">{formatBytes(uploadTelemetry.bytesTransferred)}</strong> / {formatBytes(uploadTelemetry.totalBytes)}</span>
                  <span>Remaining <strong className="text-slate-700">{formatBytes(uploadTelemetry.remainingBytes)}</strong></span>
                  <span>Speed <strong className="text-slate-700">{formatBytes(uploadTelemetry.speedBytesPerSecond)}/s</strong></span>
                  <span>ETA <strong className="text-slate-700">{formatEta(uploadTelemetry.etaSeconds)}</strong></span>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <span className="flex min-w-0 items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><span className="truncate">{uploadError}</span></span>
                {indexingFailed && onRetryIndexing && (
                  <button type="button" onClick={onRetryIndexing} className="inline-flex shrink-0 items-center gap-1 font-semibold hover:text-rose-900">
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pt-3">
            {attachments.map((attachment, index) => (
              <div key={attachment.id || attachment.storagePath || `${attachment.name}-${index}`} className="flex max-w-[270px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                {attachment?.isImage && attachment?.dataUrl ? (
                  <img src={attachment.dataUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="text-slate-500"><AttachmentIcon attachment={attachment} /></span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-700">{attachment.name || 'Attached file'}</span>
                  {attachment.size ? <span className="text-[10px] text-slate-400">{formatBytes(attachment.size)}</span> : null}
                </span>
                <button type="button" onClick={() => onRemoveAttachment?.(attachment.id || index)} className="ml-1 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`Remove ${attachment.name || 'file'}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => notifyFocus(true)}
          onBlur={() => window.setTimeout(() => notifyFocus(false), 120)}
          placeholder="Ask about a lesson, paper, or result"
          disabled={disabled}
          rows={1}
          className="block max-h-32 min-h-11 w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[15px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:min-h-14 sm:px-5 sm:pb-2 sm:pt-4"
          aria-label="Message the study assistant"
          enterKeyHint="send"
        />

        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onAttachClick} disabled={disabled} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" aria-label="Upload project files" title="Upload project files">
              <Paperclip className="h-5 w-5" />
              <span className="text-xs font-semibold">Upload files</span>
            </button>
            <span className="hidden rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:inline">@ tools</span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isStreaming && !input.trim() && onMicClick && (
              <button type="button" onClick={onMicClick} disabled={disabled} className="rounded-full p-2.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Start voice input">
                <Mic className="h-5 w-5" />
              </button>
            )}

            {isStreaming ? (
              <button type="button" onClick={onStopClick} className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-white hover:bg-black" aria-label="Stop response">
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <AnimatePresence initial={false}>
                <motion.button
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-white transition hover:bg-black disabled:bg-slate-200 disabled:text-slate-400"
                  aria-label="Send message"
                >
                  <ArrowUp className="h-5 w-5" />
                </motion.button>
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
      <p className="mt-2 text-center text-[10px] text-slate-400">Verify important exam information with an official source.</p>
    </div>
  );
}
