import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { useAIWorkflowStream } from '../../hooks/useAIWorkflowStream';
import { AIWorkflowStatus } from '../ai/AIWorkflowStatus';
import { SafeReasoningSummary } from '../ai/SafeReasoningSummary';
import { apiFetch } from '../../lib/api';
import { apiUrl } from '../../lib/apiBase';
import { getRecommendedUploadMode } from '../../lib/uploadMode';
import { uploadPdfWithClientStorage, uploadAttachmentWithClientStorage, type UploadProgressSnapshot } from '../../lib/clientStorageUpload';
import { auth } from '../../lib/firebase';
import { CloraShell } from '../ui/clora/CloraShell';
import { CloraHero } from '../ui/clora/CloraHero';
import { CloraComposer, type UploadTelemetry } from '../ui/clora/CloraComposer';
import { CloraMessageBubble } from '../ui/clora/CloraMessageBubble';
import { CloraToolPalette } from '../ui/clora/CloraToolPalette';
import { CloraSourceDrawer } from '../ui/clora/CloraSourceDrawer';
import { openSourcePdf } from '../../lib/sourceActions';
import { ErrorLogModal } from '../modals/ErrorLogModal';
const PdfViewerModal = React.lazy(() => import('../PdfViewerModal').then(m => ({ default: m.PdfViewerModal })));
import {
  Paperclip,
  Loader2,
  Sparkles,
  Trash2,
  Send,
  Square,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  X,
  Sparkle,
  Globe,
  Database,
  ArrowUpRight,
  ThumbsDown,
  Download,
  BrainCircuit,
  Mic,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Lock,
  Plus,
  History
} from 'lucide-react';
import { SourceCard } from '../ui/SourceCard';
import { MessageRenderer } from '../ui/MessageRenderer';
import { VisualBlockRenderer } from '../ui/VisualBlockRenderer';
import { extractVisualBlocks } from '../../lib/visualBlockExtractor';
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea';
import { useNearBottomAutoScroll } from '../../hooks/useNearBottomAutoScroll';
import { AudioPlayer } from '../AudioPlayer';
import { ToolCommandPalette, CommandOption } from '../chat/ToolCommandPalette';
import { TtsComposerModal } from '../chat/TtsComposerModal';
import { RealtimeLiveCallPanel } from '../ui/clora/RealtimeLiveCallPanel';
import { VoiceAudioCard } from '../chat/VoiceAudioCard';
import { parseChatCommand } from '../../lib/chatCommandParser';

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function mergeMessages(existing: any[], incoming: any[]) {
  const map = new Map();

  for (const m of existing) {
    map.set(m.id, m);
  }

  for (const m of incoming) {
    const id = m.id || generateUUID();

    // never replace non-empty local assistant content with empty server content
    const old = map.get(id);
    if (old && old.content && !m.content) continue;

    map.set(id, { ...old, ...m, id });
  }

  // Sort by createdAt if available
  const result = Array.from(map.values());
  result.sort((a, b) => {
    if (a.id === 'welcome') return -1;
    if (b.id === 'welcome') return 1;
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });
  return result;
}


function ThoughtProcessPanel({ msg, isStreamingActive, status, tools }: any) {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand while streaming, collapse when done
  useEffect(() => {
    if (isStreamingActive) setExpanded(true);
  }, [isStreamingActive]);

  // If there's no summary, no sources, and not streaming, hide completely
  if (!isStreamingActive && !msg.summary?.length && !msg.sources?.length) return null;

  return (
    <div className="flex flex-col gap-2 mb-3 max-w-full">
      <div className="flex flex-wrap items-center gap-2">
        <AIWorkflowStatus
          status={isStreamingActive && status ? status : { stage: 'done', label: 'Reasoning Process' }}
          onClick={() => setExpanded(!expanded)}
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200/60 rounded-xl sm:rounded-2xl mt-1 space-y-3 sm:space-y-4 shadow-inner text-sm sm:text-base">
              {msg.sources && msg.sources.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/40 pb-1">
                    <Database className="w-3 h-3 text-slate-400" />
                    Mapped Sources
                  </h4>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
                    {msg.sources.filter((s: any) => s.usedInAnswer !== false && (s.storagePath || s.url || s.id || s.sourceId)).map((src: any, i: number) => (
                      <button
                        key={i}
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left pl-2 pr-4 py-2 rounded-xl transition-all shadow-sm group active:scale-95"
                        onClick={() => {
                          if (src.url) {
                            window.open(src.url, '_blank');
                            return;
                          }
                          import('../../lib/sourceActions').then(m => {
                            m.openSourcePdf(src).catch((e: any) => {
                              console.error('Download trigger failed:', e);
                              if (e.message?.includes('LOGIN_REQUIRED')) {
                                 alert('PDF open කරන්න login අවශ්‍යයි. නැවත sign in කරන්න.');
                              } else if (e.message?.includes('storage/unauthorized')) {
                                 alert('PDF permission denied. Storage rules / App Check / login check කරන්න.');
                              } else if (e.message?.includes('NOT_A_PDF_RESPONSE')) {
                                 alert('PDF වෙනුවට server error response එකක් ආවා. Source route/auth fix කරන්න.');
                              } else if (e.message?.includes('NO_OPENABLE_PDF_SOURCE')) {
                                 alert('මේ source එකට storagePath හෝ public URL එකක් නැහැ.');
                              } else {
                                 alert('Error opening PDF: ' + e.message);
                              }
                            });
                          });
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors border border-indigo-100/50">
                          <Globe className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[200px] leading-tight flex items-center gap-1">
                            {src.title || src.fileName || (src.url ? new URL(src.url).hostname : "Document")}
                          </p>
                          {(src.subject || src.year) ? (
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px]">
                              {src.subject} {src.year ? `• ${src.year}` : ''}
                            </p>
                          ) : src.url && (
                            <p className="text-[9px] font-medium text-slate-400 mt-0.5 truncate max-w-[200px]">
                              {src.url}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msg.summary && msg.summary.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/40 pb-1 mt-2">
                    <BrainCircuit className="w-3 h-3 text-slate-400" />
                    Internal Reasoning
                  </h4>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs leading-relaxed text-slate-600">
                    <SafeReasoningSummary items={msg.summary} />
                  </div>
                </div>
              )}

              {isStreamingActive && (!msg.summary || msg.summary.length === 0) && (
                <div className="text-xs text-slate-400 font-medium italic pl-1 flex items-center gap-2 mt-2">
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                  Analyzing query...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CloraXView() {
  const { currentSubject, showNotification, user } = useApp();


  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<any[]>([]);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalUrl, setPdfModalUrl] = useState('');

const [messages, setMessages] = useState<{
    role: 'user' | 'assistant',
    content: string,
    id: string,
    summary?: string[],
    sources?: any[],
    status?: string,
    createdAt?: string,
    webCandidates?: any[],
    visualBlocks?: any[],
    suggestions?: string[],
    paperInfo?: any,
    errorCode?: string,
    audioUrl?: string,
    attachments?: any[]
  }[]>([
    {
      role: 'assistant',
      content: 'ආයුබෝවන්! මම Clora X Assistant. ඔබට අද කුමන විභාග ප්‍රශ්නයක් හෝ පාඩමක් ගැනද දැනගන්න අවශ්‍ය?',
      id: 'welcome'
    }
  ]);
  const [input, setInput] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState('');
  const [showTtsModal, setShowTtsModal] = useState(false);
  const [showLiveVoiceModal, setShowLiveVoiceModal] = useState(false);
  const [showErrorLogModal, setShowErrorLogModal] = useState(false);
  const [realtimeVoiceEnabled, setRealtimeVoiceEnabled] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; isImage?: boolean; dataUrl?: string; storagePath?: string; mimeType?: string; sourceId?: string; attachmentType?: string } | null>(null);
  const [indexingFailed, setIndexingFailed] = useState(false);
  const [pendingIngestData, setPendingIngestData] = useState<any>(null);

  // Voice Tutor States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceFeedbackEnabled, setIsVoiceFeedbackEnabled] = useState(false);
  const [isTtsAvailable, setIsTtsAvailable] = useState(true);

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        const [realtimeResponse, healthResponse] = await Promise.all([
          apiFetch('/api/realtime/status'),
          apiFetch('/api/ai/model-health'),
        ]);

        if (realtimeResponse.ok) {
          const realtime = await realtimeResponse.json();
          setRealtimeVoiceEnabled(Boolean(realtime?.enabled));
        }

        if (healthResponse.ok) {
          const health = await healthResponse.json();
          if (health?.models?.tts && (health.models.tts.available === false || health.models.tts.enabled === false)) {
            setIsTtsAvailable(false);
            setIsVoiceFeedbackEnabled(false);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Optional AI capability checks failed', error);
      }
    };

    void loadCapabilities();
  }, []);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const currentUtteranceRef = useRef<any>(null);

  const speakText = async (text: string, messageId?: string) => {
    // strip out markdown tags, emojis, braces, asterisks to make speech clean
    const clean = text
      .replace(/[\*\#\`\_\-\[\]\(\)]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return;

    setIsSpeaking(true);

    try {
      const ttsRes = await fetch(apiUrl("/api/tts/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ text: clean, languageCode: "si-LK" })
      });

      if (ttsRes.ok) {
        const data = await ttsRes.json();
        const url = data.audioUrl || data.storagePath;

        if (messageId) {
           setMessages(prev => prev.map(m => m.id === messageId ? { ...m, audioUrl: url } : m));
        } else {
           // Fallback to playing it directly if no messageId is provided
           const audio = new Audio(url);
           currentUtteranceRef.current = audio;
           audio.onended = () => setIsSpeaking(false);
           audio.play().catch(() => setIsSpeaking(false));
        }
      } else {
         setIsSpeaking(false);
      }
    } catch (err) {
      console.error("TTS fetch failed", err);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (currentUtteranceRef.current instanceof Audio) {
       currentUtteranceRef.current.pause();
    } else if (synthRef.current) {
       synthRef.current.cancel();
    }
    setIsSpeaking(false);
  };

  // Speech to Text Web Speech API Initialization
  useEffect(() => {
    const SpeechReq = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechReq) {
      const rec = new SpeechReq();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'si-LK'; // default to Sinhala A/L

      rec.onstart = () => {
        setIsListening(true);
        if (synthRef.current) synthRef.current.cancel();
        setIsSpeaking(false);
      };

      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        if (text) {
          setInput(text);
          // auto submit voice prompt!
          setTimeout(() => {
            const form = document.getElementById("clora-form") as HTMLFormElement;
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }, 300);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoiceTutor = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (isSpeaking) {
        stopSpeaking();
      }
      setIsVoiceFeedbackEnabled(true);
      recognitionRef.current?.start();
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom SSE Stream state hooks
  const {
    answer,
    status,
    tools,
    isStreaming,
    safeSummary,
    sources,
    error,
    isRecoverableError,
    webCandidates,
    pendingImport,
    importStatus,
    importComplete,
    sendAIMessage,
    cancel
  } = useAIWorkflowStream();

  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const currentRequestIdRef = useRef<string | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const [uploading, setUploading] = useState(false);
  const [uploadTelemetry, setUploadTelemetry] = useState<UploadTelemetry | null>(null);
  const uploadStartedAtRef = useRef(0);
  const [importingStage, setImportingStage] = useState<string | null>(null);
  const [importProgressText, setImportProgressText] = useState("");

  // Clear chat custom dialog state (Avoid iframe restricted window.confirm)
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const beginUploadTelemetry = (file: File) => {
    uploadStartedAtRef.current = performance.now();
    setUploadTelemetry({
      fileName: file.name,
      progress: 0,
      bytesTransferred: 0,
      totalBytes: file.size,
      remainingBytes: file.size,
      speedBytesPerSecond: 0,
      etaSeconds: 0,
      phase: 'uploading',
    });
  };

  const trackUploadProgress = (fileName: string) => (snapshot: UploadProgressSnapshot) => {
    const elapsedSeconds = Math.max((performance.now() - uploadStartedAtRef.current) / 1000, 0.1);
    const speedBytesPerSecond = snapshot.bytesTransferred / elapsedSeconds;
    const remainingBytes = Math.max(0, snapshot.totalBytes - snapshot.bytesTransferred);
    setUploadTelemetry({
      fileName,
      progress: snapshot.progress,
      bytesTransferred: snapshot.bytesTransferred,
      totalBytes: snapshot.totalBytes,
      remainingBytes,
      speedBytesPerSecond,
      etaSeconds: speedBytesPerSecond > 0 ? remainingBytes / speedBytesPerSecond : 0,
      phase: snapshot.state === 'error' || snapshot.state === 'canceled'
        ? 'error'
        : snapshot.state === 'success'
          ? 'processing'
          : 'uploading',
    });
  };

  // Initialize hooks
  useAutosizeTextarea(textareaRef.current, input);
  const { showScrollButton, scrollToBottom } = useNearBottomAutoScroll(scrollRef, messages, isStreaming, answer);

  // Quick Action Chips
  const quickChips = [
    { text: "මගේ Z-score එක", label: "මගේ Z-score එක" },
    { text: "2023 SFT Paper structure", label: "2023 SFT Paper structure" },
    { text: "ජෛවාණු notes", label: "ජෛවාණු notes" },
    { text: "SFT MCQ Weights", label: "SFT MCQ Weights" }
  ];

  useEffect(() => {
    const handleSend = (e: any) => {
      setInput(e.detail);
      setTimeout(() => {
         const form = document.getElementById("clora-form");
         if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }, 50);
    };
    window.addEventListener('clora-send', handleSend);
    return () => window.removeEventListener('clora-send', handleSend);
  }, []);

  // Load chat history from /api/ai/chat-history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await apiFetch("/api/ai/chat-history");
        const data = await res.json().catch(() => null);
        if (res.ok && data?.chatHistory && data.chatHistory.length > 0) {
            const flattened: any[] = [];
            data.chatHistory.forEach((m: any) => {
              const baseId = m.id || m.requestId || generateUUID();
              if (m.userPrompt) {
                flattened.push({
                  role: 'user',
                  content: m.userPrompt,
                  id: baseId + '_user',
                  createdAt: m.createdAt || new Date().toISOString()
                });
              } else if (m.role === 'user') {
                flattened.push({
                  role: 'user',
                  content: m.text || m.content,
                  id: baseId,
                  createdAt: m.createdAt || new Date().toISOString()
                });
              }

              if (m.assistantAnswer) {
                const extracted = extractVisualBlocks(m.assistantAnswer);
                flattened.push({
                  role: 'assistant',
                  content: extracted.cleanText,
                  id: baseId,
                  sources: m.sources || [],
                  summary: m.summary || [],
                  createdAt: m.createdAt || new Date().toISOString(),
                  status: 'done',
                  visualBlocks: extracted.blocks
                });
              } else if (m.role === 'assistant') {
                const extracted = extractVisualBlocks(m.text || m.content || "");
                flattened.push({
                  role: 'assistant',
                  content: extracted.cleanText,
                  id: baseId,
                  sources: m.sources || [],
                  summary: m.summary || [],
                  createdAt: m.createdAt || new Date().toISOString(),
                  status: 'done',
                  visualBlocks: extracted.blocks
                });
              }
            });
            setMessages(prev => {
              if (isStreamingRef.current) return prev;
              return mergeMessages(prev, flattened);
            });
          }
        } catch (e) {
          console.warn("Failed to load history", e);
        }
      };
      loadHistory();
    }, []);

  const handleRetryIndexing = async () => {
    if (!pendingIngestData) return;
    setUploading(true);
    setUploadError(null);
    setIndexingFailed(false);
    setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: 'processing' } : null);

    try {
      const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: pendingIngestData?.sourceId || pendingIngestData?.uploaded?.sourceId || "",
          storagePath: pendingIngestData?.storagePath || pendingIngestData?.uploaded?.storagePath || "",
          title: pendingIngestData?.title || pendingIngestData?.file?.name || "upload",
          fileName: pendingIngestData?.title || pendingIngestData?.file?.name || "upload",
          subject: currentSubject,
          resourceType: "uploaded_pdf",
          sourceType: "uploaded_pdf",
          sourceScope: "chat_upload",
          medium: "Sinhala"
        })

      });

      const data = await ingestRes.json().catch(() => null);
      if (!ingestRes.ok || !data?.ok) {
        setUploadError("Uploaded, indexing failed. Retry indexing.");
        setIndexingFailed(true);
        setUploadTelemetry((current) => current ? { ...current, phase: 'error' } : null);
        setUploading(false);
        return;
      }

      if (data.needsOcr) {
        setInput(prev => prev + `\n[Uploaded PDF: ${pendingIngestData.title}] ${data.message} `);
      } else {
        setInput(prev => prev + `\n[Uploaded PDF: ${pendingIngestData.title}] Please read this pdf and answer: `);
      }
      setUploading(false);
      setPendingIngestData(null);
      setUploadTelemetry((current) => current ? { ...current, phase: 'success' } : null);
    } catch (err: any) {
      console.error("Retry indexing failed:", err);
      setUploadError("Uploaded, indexing failed. Retry indexing.");
      setIndexingFailed(true);
      setUploadTelemetry((current) => current ? { ...current, phase: 'error' } : null);
      setUploading(false);
    }
  };

  const processFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setIndexingFailed(false);
    setPendingIngestData(null);
    beginUploadTelemetry(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUploadedFile({
          name: file.name,
          size: file.size,
          isImage: true,
          dataUrl: dataUrl
        });
        setUploading(false);
        setUploadTelemetry(null);
      };
      reader.onerror = () => {
        setUploadError("Failed to read image file.");
        setUploadedFile(null);
        setUploading(false);
        setUploadTelemetry(null);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let previewUrl = "";
    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      previewUrl = URL.createObjectURL(file);
    }

    setUploadedFile({ name: file.name, size: file.size, dataUrl: previewUrl });

    try {
      if (!file.type.includes("pdf") && !file.type.includes("text") && !file.name.endsWith(".pdf") && !file.name.endsWith(".txt")) {
         const uploaded = await uploadAttachmentWithClientStorage({
           file,
           subject: currentSubject,
           sourceScope: "chat_upload",
           onProgress: trackUploadProgress(file.name),
         });
         setUploadedFile({
            name: file.name,
            size: file.size,
            storagePath: uploaded.storagePath,
            mimeType: file.type || "application/octet-stream",
            isImage: file.type.startsWith("image/"),
            dataUrl: previewUrl
         });
         setInput(prev => prev + `\n[Attached File: ${file.name}] Please analyze this file: `);
         setUploading(false);
         setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: 'success' } : null);
         if (fileInputRef.current) fileInputRef.current.value = "";
         return;
      }

      const uploaded = await uploadPdfWithClientStorage({
        file,
        subject: currentSubject,
        sourceScope: "chat_upload",
        onProgress: trackUploadProgress(file.name),
      });

      setUploadedFile({
        name: file.name,
        size: file.size,
        sourceId: uploaded.sourceId,
        storagePath: uploaded.storagePath,
        mimeType: file.type || "application/pdf",
        attachmentType: "pdf"
      });
      setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: 'processing' } : null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: uploaded.sourceId,
          storagePath: uploaded.storagePath,
          title: file.name,
          fileName: file.name,
          subject: currentSubject,
          resourceType: "uploaded_pdf",
          sourceType: "uploaded_pdf",
          sourceScope: "chat_upload",
          medium: "Sinhala"
        })

      });

      const data = await ingestRes.json().catch(() => null);
      if (!ingestRes.ok || !data?.ok) {
        setUploadError("Uploaded, indexing failed. Retry indexing.");
        setIndexingFailed(true);
        setUploadTelemetry((current) => current ? { ...current, phase: 'error' } : null);
        setPendingIngestData({
          file,
          sourceId: uploaded.sourceId,
          storagePath: uploaded.storagePath,
          title: file.name,
          subject: currentSubject,
          resourceType: "uploaded_pdf",
          sourceType: "uploaded_pdf",
          sourceScope: "chat_upload",
          medium: "Sinhala"
        });
      } else {
        const followUp = data.needsOcr
          ? data.message || 'This document needs OCR before all text can be searched.'
          : 'Please read this document and answer: ';
        setInput((current) => `${current}\n[Uploaded PDF: ${file.name}] ${followUp}`);
        setUploadTelemetry((current) => current ? { ...current, phase: 'success' } : null);
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file.");
      setUploadedFile(null);
      setUploadTelemetry((current) => current ? { ...current, phase: 'error' } : null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Upload file using FormData with fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Implement client-side confirmation and direct proxy import flow
  const handleConfirmCandidateAndImport = async (candidate: any) => {
    if (isStreaming || importingStage) return;

    setImportingStage("fetching");
    setImportProgressText("Downloading PDF file from secure web candidate link...");

    try {
      // 1. Fetch from proxy
      const proxyRes = await fetch(apiUrl("/api/web/pdf-proxy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: candidate.url })
      });

      if (!proxyRes.ok) {
        const errData = await proxyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to download candidate PDF via secure proxy.");
      }

      const blob = await proxyRes.blob();
      setImportingStage("uploading");
      setImportProgressText("Uploading and registering document to Firebase Storage...");

      // 2. Create File object
      const safeName = (candidate.title || "imported_document").replace(/[^a-zA-Z0-9.\-_]/g, "_") + ".pdf";
      const file = new File([blob], safeName, { type: "application/pdf" });

      // 3. Upload with client Firebase Storage SDK (bypasses any backend permissions issue)
      const uploaded = await uploadPdfWithClientStorage({
        file,
        subject: candidate.subject || currentSubject,
        sourceScope: "official_library"
      });

      setImportingStage("ingesting");
      setImportProgressText("Running AI text extraction and building RAG index vectors...");

      // 4. Ingest on the backend
      const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: uploaded.sourceId,
          storagePath: uploaded.storagePath,
          title: file.name,
          fileName: file.name,
          subject: currentSubject,
          resourceType: "uploaded_pdf",
          sourceType: "uploaded_pdf",
          sourceScope: "chat_upload",
          medium: "Sinhala"
        })

      });

      const ingestData = await ingestRes.json().catch(() => null);
      if (!ingestRes.ok || !ingestData?.ok) {
        throw new Error(ingestData?.message || "RAG Ingest indexing failed.");
      }

      setImportingStage("complete");
      setImportProgressText("Import complete! Re-initiating original question with newly indexed source...");

      setTimeout(() => {
        setImportingStage(null);
        setImportProgressText("");

        // 5. Auto-resend original prompt so user gets the answer instantly
        const origPrompt = pendingImport?.originalPrompt || `Explain ${candidate.year} ${candidate.subject} MCQ Answers`;
        setInput(origPrompt);
        setTimeout(() => {
          const form = document.getElementById("clora-form");
          if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 100);
      }, 1500);

    } catch (err: any) {
      console.error("Direct candidate import failed:", err);
      setUploadError(err.message || "Failed to download and import verified candidate.");
      setImportingStage(null);
      setImportProgressText("");
    }
  };

  const handleWrongAnswer = async (msg: any) => {
    if (!msg.paperInfo) return;
    try {
      const response = await fetch(apiUrl("/api/ai/feedback/wrong-answer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({
          sourceId: msg.paperInfo.sourceId,
          questionType: msg.paperInfo.questionType,
          questionNo: msg.paperInfo.questionNo,
          reason: "User manually flagged as wrong"
        }),
      });
      if (response.ok) {
        showNotification("පිළිතුර වැරදි බව සටහන් කරගත්තා. ඊළඟ වතාවේ මෙය පරීක්ෂා කෙරේ.", "success");
      }
    } catch (err) {
      console.error("Feedback failed", err);
    }
  };

  const handleContinue = () => {
    if (isStreaming) return;

    // Find the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) return;

    // Get original prompt
    const assistantIndex = messages.findIndex(m => m.id === lastAssistantMessage.id);
    let originalPrompt = "";
    if (assistantIndex > 0) {
      const prevMsg = messages[assistantIndex - 1];
      if (prevMsg && prevMsg.role === 'user') {
        originalPrompt = prevMsg.content;
      }
    }

    const continuePrompt = "Continue the previous answer (ඉතිරි ටික කියන්න).";
    const userMsgId = generateUUID();
    const assistantMsgId = generateUUID();

    const isDirectQaFailure = lastAssistantMessage.errorCode === "AI_CLIENT_RUNTIME_ERROR" ||
                              lastAssistantMessage.errorCode === "EXACT_QUESTION_EVIDENCE_MISSING" ||
                              (lastAssistantMessage.status === "error" && lastAssistantMessage.paperInfo);

    if (isDirectQaFailure) {
      // Retry the clean stream (direct PDF flow) rather than continuing/final_answer!
      const userMessage = {
        id: userMsgId,
        role: 'user' as const,
        content: originalPrompt || continuePrompt,
        status: "sent",
        createdAt: new Date().toISOString()
      };

      const assistantPlaceholder = {
        id: assistantMsgId,
        role: 'assistant' as const,
        content: "",
        status: "streaming",
        summary: [] as string[],
        sources: [],
        createdAt: new Date().toISOString(),
        webCandidates: [] as any[]
      };

      setMessages(prev => [...prev, userMessage, assistantPlaceholder]);

      currentRequestIdRef.current = assistantMsgId;
      const streamId = assistantMsgId;
      activeStreamIdRef.current = streamId;
      setSummaryExpanded(false);

      sendAIMessage({
        isContinue: false,
        prompt: originalPrompt || continuePrompt,
        assistantMessageId: assistantMsgId,
        onToken: (text) => {
          if (activeStreamIdRef.current !== streamId) return;

          if (!(window as any)._cloraStreamBuffer) {
             (window as any)._cloraStreamBuffer = {
                text: "",
                frameId: null
             };
          }

          (window as any)._cloraStreamBuffer.text += text;

          if ((window as any)._cloraStreamBuffer.frameId === null) {
            (window as any)._cloraStreamBuffer.frameId = requestAnimationFrame(() => {
              const flushText = (window as any)._cloraStreamBuffer.text;
              (window as any)._cloraStreamBuffer.text = "";
              (window as any)._cloraStreamBuffer.frameId = null;

              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, content: (m.content || "") + flushText }
                    : m
                )
              );
            });
          }
        },
        onSources: (newSources) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    sources: Array.from(new Map([...(m.sources || []), ...newSources].map(s => [s.id || s.sourceId || s.title || Math.random().toString(), s])).values())
                  }
                : m
            )
          );
        },
        onSummary: (items) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, summary: items }
                : m
            )
          );
        },
        onStatus: (statusData) => {},
        onWebCandidates: (candidates) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, webCandidates: candidates }
                : m
            )
          );
        },
        onError: (errObj) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, status: "error" }
                : m
            )
          );
        },
        onDone: (data) => {
          if (activeStreamIdRef.current !== streamId) return;

          if (data?.finishReason === "pending_direct_pdf_qa" || data?.pending === true) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, status: "streaming" }
                  : m
              )
            );
            return;
          }

          let finalContent = "";
          setMessages(prev => {
            return prev.map(m => {
              if (m.id === assistantMsgId) {
                finalContent = m.content || "";
                const hasScanFailure = data?.finishReason === "direct_pdf_qa_failed" || data?.errorCode === "AI_CLIENT_RUNTIME_ERROR" || data?.errorCode === "EXACT_QUESTION_EVIDENCE_MISSING";
                return {
                  ...m,
                  status: hasScanFailure ? "error" : (data?.completed === false ? "incomplete" : "done"),
                  paperInfo: data?.paperInfo || m.paperInfo,
                  errorCode: data?.errorCode
                };
              }
              return m;
            });
          });
          if (isVoiceFeedbackEnabled && finalContent) {
            speakText(finalContent, assistantMsgId);
          }
          if (activeStreamIdRef.current === streamId) {
            activeStreamIdRef.current = null;
            currentRequestIdRef.current = null;
          }
        }
      });
      return;
    }

    const userMessage = {
      id: userMsgId,
      role: 'user' as const,
      content: continuePrompt,
      status: "sent",
      createdAt: new Date().toISOString()
    };

    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant' as const,
      content: "",
      status: "streaming",
      summary: [] as string[],
      sources: lastAssistantMessage.sources || [],
      createdAt: new Date().toISOString(),
      webCandidates: [] as any[]
    };

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);

    currentRequestIdRef.current = assistantMsgId;
    const streamId = assistantMsgId;
    activeStreamIdRef.current = streamId;
    setSummaryExpanded(false);

    sendAIMessage({
       isContinue: true,
       originalPrompt: originalPrompt || continuePrompt,
       previousAssistantText: lastAssistantMessage.content,
       sources: lastAssistantMessage.sources || [],
       chatId: lastAssistantMessage.id || undefined,
       reason: "incomplete",
       assistantMessageId: assistantMsgId,
       onToken: (text) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev =>
           prev.map(m =>
             m.id === assistantMsgId
               ? { ...m, content: (m.content || "") + text }
               : m
           )
         );
       },
       onSources: (newSources) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev =>
           prev.map(m =>
             m.id === assistantMsgId
               ? {
                   ...m,
                   sources: Array.from(new Map([...(m.sources || []), ...newSources].map(s => [s.id || s.sourceId || s.title || Math.random().toString(), s])).values())
                 }
               : m
           )
         );
       },
       onSummary: (items) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev =>
           prev.map(m =>
             m.id === assistantMsgId
               ? { ...m, summary: items }
               : m
           )
         );
       },
       onStatus: (statusData) => {
       },
       onWebCandidates: (candidates) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev =>
           prev.map(m =>
             m.id === assistantMsgId
               ? { ...m, webCandidates: candidates }
               : m
           )
         );
       },
       onError: (errObj) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev =>
           prev.map(m =>
             m.id === assistantMsgId
               ? { ...m, status: "error" }
               : m
           )
         );
       },
       onDone: (data) => {
         if (activeStreamIdRef.current !== streamId) return;
         let finalContent = "";
         setMessages(prev => {
           return prev.map(m => {
             if (m.id === assistantMsgId) {
               finalContent = m.content || "";
               return { ...m, status: data?.completed === false ? "incomplete" : "done" };
             }
             return m;
           });
         });
         if (isVoiceFeedbackEnabled && finalContent) {
           speakText(finalContent);
         }
         if (activeStreamIdRef.current === streamId) {
           activeStreamIdRef.current = null;
           currentRequestIdRef.current = null;
         }
       }
    });
  };

  const handleChipClick = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const form = document.getElementById("clora-form");
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput('');
    setSummaryExpanded(false);

    const currentUpload = uploadedFile;
    setUploadedFile(null);
    setUploadError(null);

    let imagePayload: { mimeType: string; data: string } | undefined = undefined;
    if (currentUpload?.isImage && currentUpload.dataUrl) {
      const parts = currentUpload.dataUrl.split(",");
      if (parts.length === 2) {
        const mimeType = parts[0].split(";")[0].split(":")[1];
        const data = parts[1];
        imagePayload = { mimeType, data };
      }
    }

    const userMsgId = generateUUID();
    const assistantMsgId = generateUUID();
    currentRequestIdRef.current = assistantMsgId;
    const streamId = assistantMsgId;
    activeStreamIdRef.current = streamId;

    const userMessage = {
      id: userMsgId,
      role: 'user' as const,
      content: userMsg,
      status: "sent",
      createdAt: new Date().toISOString(),
      attachments: currentUpload ? [{
        name: currentUpload.name,
        mimeType: currentUpload.mimeType || (currentUpload.isImage ? "image/jpeg" : undefined),
        dataUrl: currentUpload.dataUrl,
        storagePath: currentUpload.storagePath
      }] : []
    };

    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant' as const,
      content: "",
      status: "streaming",
      summary: [] as string[],
      sources: [] as any[],
      createdAt: new Date().toISOString(),
      webCandidates: [] as any[]
    };

    const nextMessages = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);

    const parsedCommand = parseChatCommand(userMsg);

    if (parsedCommand.command === 'tts') {
       let textToSpeak = parsedCommand.text;

       if (parsedCommand.text.trim() === 'last') {
          const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
          if (lastAssistant) {
            textToSpeak = lastAssistant.content;
          } else {
            textToSpeak = "කිසිදු පණිවිඩයක් සොයාගැනීමට නොහැකි විය.";
          }
       } else if (parsedCommand.text.trim() === 'file') {
          textToSpeak = "ඔබ විසින් file එකක් ලබාදී ඇත්නම් එය විශ්ලේෂණය කරමින් පවතී.";
          if (currentUpload && currentUpload.name) {
             textToSpeak = `ඔබ ලබාදුන් ${currentUpload.name} ගොනුව කියවීමට හැකිවිය.`;
             // In a real app we would extract text from the file here
          }
       } else if (parsedCommand.text.trim() === 'podcast') {
          textToSpeak = "Podcast version is generated by splitting long text into natural segments. " + textToSpeak;
          // In a real app, podcast logic would split chunks and use multi-voice endpoints
       }

       try {
         const { generateTts } = await import("../../lib/ttsClient");
         const ttsData = await generateTts(textToSpeak, { languageCode: "si-LK" });

         setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: "Generated Voice Audio", status: "done", audioUrl: ttsData.playableUrl } : m));
       } catch (err: any) {
         setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: `TTS failed: ${err.message}`, status: "error" } : m));
       }
       if (activeStreamIdRef.current === streamId) {
         activeStreamIdRef.current = null;
         currentRequestIdRef.current = null;
       }
       return;
    }

    if (parsedCommand.command === 'image') {
      try {
        const imageRes = await fetch(apiUrl("/api/image/generate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`
          },
          body: JSON.stringify({ prompt: parsedCommand.text })
        });

        if (imageRes.ok) {
          const data = await imageRes.json();
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: `Here is your generated image: ![Generated Image](${data.imageUrl || data.image})`, status: "done" } : m));
        } else {
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: "Image generation failed or is disabled.", status: "error" } : m));
        }
      } catch (err: any) {
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: `Image generation error: ${err.message}`, status: "error" } : m));
      }
      if (activeStreamIdRef.current === streamId) {
        activeStreamIdRef.current = null;
        currentRequestIdRef.current = null;
      }
      return;
    }

    if (parsedCommand.command === 'live') {
      setShowLiveVoiceModal(true);
      // Remove placeholders if we are opening modal instead of adding to chat
      setMessages(prev => prev.filter(m => m.id !== userMsgId && m.id !== assistantMsgId));
      return;
    }

    if (parsedCommand.command === 'file') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      if (activeStreamIdRef.current === streamId) {
        activeStreamIdRef.current = null;
        currentRequestIdRef.current = null;
      }
      setMessages(prev => prev.filter(m => m.id !== userMsgId && m.id !== assistantMsgId));
      return;
    }

    let toolMode: "auto" | "web_search" | "deep_search" = "auto";
    let messagePrompt = userMsg;

    if (parsedCommand.command === 'websearch') {
      toolMode = "web_search";
      messagePrompt = parsedCommand.text;
    } else if (parsedCommand.command === 'deepsearch') {
      toolMode = "deep_search";
      messagePrompt = parsedCommand.text;
    } else if (parsedCommand.command === 'pdf') {
      messagePrompt = `[PDF Intent] ${parsedCommand.text || "Please answer from the uploaded PDF"}`;
    }

    let attachmentsPayload = undefined;
    if (currentUpload && !currentUpload.isImage && currentUpload.storagePath && currentUpload.mimeType) {
       attachmentsPayload = [{
          storagePath: currentUpload.storagePath,
          mimeType: currentUpload.mimeType,
          fileName: currentUpload.name
       }];
    }

    await sendAIMessage({
        prompt: messagePrompt,
        activeSubject: currentSubject,
        mode: toolMode,
        history: nextMessages.slice(-10).map(m => ({ role: m.role, text: m.content })),
        image: imagePayload,
        attachments: attachmentsPayload,
        assistantMessageId: assistantMsgId,
        onToken: (text) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: (m.content || "") + text }
                : m
            )
          );
        },
        onSources: (newSources) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    sources: Array.from(new Map([...(m.sources || []), ...newSources].map(s => [s.id || s.sourceId || s.title || Math.random().toString(), s])).values())
                  }
                : m
            )
          );
        },
        onSummary: (items) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, summary: items }
                : m
            )
          );
        },
        onStatus: (statusData) => {
        },
        onWebCandidates: (candidates) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, webCandidates: candidates }
                : m
            )
          );
        },
        onVisualBlocks: (blocks) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, visualBlocks: blocks }
                : m
            )
          );
        },
        onSuggestions: (suggestions) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, suggestions: suggestions }
                : m
            )
          );
        },
        onError: (errObj) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, status: "error" }
                : m
            )
          );
        },
        onDone: (data) => {
          if (activeStreamIdRef.current !== streamId) return;

          if (data?.finishReason === "pending_direct_pdf_qa" || data?.pending === true) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, status: "streaming" }
                  : m
              )
            );
            return;
          }

          let finalContent = "";
          setMessages(prev => {
            return prev.map(m => {
              if (m.id === assistantMsgId) {
                finalContent = m.content || "";
                const hasScanFailure = data?.finishReason === "direct_pdf_qa_failed" || data?.errorCode === "AI_CLIENT_RUNTIME_ERROR" || data?.errorCode === "EXACT_QUESTION_EVIDENCE_MISSING";
                return {
                  ...m,
                  status: hasScanFailure ? "error" : (data?.completed === false ? "incomplete" : "done"),
                  paperInfo: data?.paperInfo || m.paperInfo,
                  errorCode: data?.errorCode
                };
              }
              return m;
            });
          });
          if (isVoiceFeedbackEnabled && finalContent) {
            speakText(finalContent, assistantMsgId);
          }
          if (activeStreamIdRef.current === streamId) {
            activeStreamIdRef.current = null;
            currentRequestIdRef.current = null;
          }
        }
    });
  };

  const executeClearHistory = async () => {
     if (isStreaming) {
       cancel();
     }
     setShowClearConfirm(false);
     setMessages([{ role: 'assistant', content: 'ආයුබෝවන්! මම Clora X Assistant. ඔබට අද කුමන විභාග ප්‍රශ්නයක් හෝ පාඩමක් ගැනද දැනගන්න අවශ්‍ය?', id: 'welcome' }]);
     await apiFetch("/api/ai/chat-history/clear", { method: "POST" });
  };

  const handleNewChat = () => {
     if (isStreaming) {
       cancel();
     }
     setMessages([{ role: 'assistant', content: 'ආයුබෝවන්! මම Clora X Assistant. ඔබට අද කුමන විභාග ප්‍රශ්නයක් හෝ පාඩමක් ගැනද දැනගන්න අවශ්‍ය?', id: 'welcome' }]);
     setInput('');
     setUploadedFile(null);
     setUploadError(null);
     setUploadTelemetry(null);
  };

  const isEmptyChat = messages.length <= 1 && !isStreaming;

  const handleComposerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && (!uploadedFile || !uploadedFile.storagePath)) return;

    // Check if we need to call the actual submit
    const syntheticEvent = new Event('submit', { cancelable: true, bubbles: true }) as any;
    handleSubmit(syntheticEvent);
  };

  return (
    <CloraShell
      isDrawerOpen={isDrawerOpen}
      drawer={
        <CloraSourceDrawer
          sources={activeSources}
          onClose={() => setIsDrawerOpen(false)}
          onSourceClick={async (source, preview) => {
             if (preview) {
                try {
                  const { getPdfUrl } = await import("../../lib/sourceActions");
                  const url = await getPdfUrl(source);
                  setPdfModalUrl(url);
                  setPdfModalOpen(true);
                } catch (e) {
                  showNotification("PDF preview open කරන්න බැහැ. Open in new tab try කරන්න.", "error");
                }
             } else {
                openSourcePdf(source).catch((e: any) => {
                   console.error("Failed to open source:", e);
                });
             }
          }}
        />
      }
      main={
        <>
          {pdfModalOpen && (
            <React.Suspense fallback={null}>
              <PdfViewerModal
                isOpen={pdfModalOpen}
                onClose={() => setPdfModalOpen(false)}
                pdfUrl={pdfModalUrl}
                title="Source Document"
              />
            </React.Suspense>
          )}
          <TtsComposerModal uploadedFile={uploadedFile}
             isOpen={showTtsModal}
             onClose={() => setShowTtsModal(false)}
            onComplete={(url) => {
              setMessages(prev => [...prev, { role: 'assistant', content: 'Generated Voice Audio', id: generateUUID(), audioUrl: url }]);
            }}
          />
          <RealtimeLiveCallPanel
            isOpen={showLiveVoiceModal}
            onClose={() => setShowLiveVoiceModal(false)}
            currentSubject={currentSubject}
            activeSourceId={uploadedFile?.storagePath || undefined}
            recentAttachmentIds={uploadedFile?.storagePath ? [uploadedFile.storagePath] : undefined}
          />

          <div className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><Sparkles className="h-3.5 w-3.5" /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-semibold text-slate-900">Clora X</h1>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online</span>
                </div>
                <p className="truncate text-[10px] uppercase tracking-wider text-slate-400">{currentSubject || 'A/L Learning Assistant'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button type="button" onClick={handleNewChat} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900" aria-label="Start a new chat" title="New chat">
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">New chat</span>
              </button>
              <button type="button" onClick={() => setShowClearConfirm(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Clear chat history" title="Clear chat history">
                <History className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Custom Clear Chat Confirmation Dialog */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 10 }}
                  className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="clear-chat-title"
                >
                  <h3 id="clear-chat-title" className="text-lg font-bold text-slate-800 mb-2">Clear Chat History?</h3>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed text-left">
                    This will permanently clear your conversation history and reset the assistant. Are you sure you want to continue?
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeClearHistory}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Yes, Clear Chat
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white clora-scrollbar" ref={scrollRef}>
            {isEmptyChat ? (
              <CloraHero
                onSelectPrompt={(prompt) => {
                  setInput(prompt);
                }}
                prompts={[
                  { title: "2023 Paper Structure", icon: <FileText className="h-4 w-4"/>, prompt: "What is the structure of the 2023 SFT paper?" },
                  { title: "Explain Z-Score", icon: <BrainCircuit className="h-4 w-4"/>, prompt: "How is the Z-score calculated in A/L exams?" },
                  { title: "Review Mistakes", icon: <CheckCircle className="h-4 w-4"/>, prompt: "Can you quiz me on my recent mistakes?" },
                  { title: "Summarize Notes", icon: <Database className="h-4 w-4"/>, prompt: "Provide a short summary on SFT main units." }
                ]}
              />
            ) : (
              <div className="mx-auto max-w-3xl pb-8 pt-8">
                <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  if (msg.id === 'welcome' && messages.length > 1) return null; // hide welcome if there are other messages
                  return (
                    <CloraMessageBubble
                      key={msg.id || idx}
                      message={msg}
                      isStreaming={isStreaming && idx === messages.length - 1}
                      onToolClick={(tool) => {
                         if (tool === 'sources') {
                            setActiveSources(msg.sources || []);
                            setIsDrawerOpen(true);
                         }
                      }}
                    />
                  );
                })}
                </AnimatePresence>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                key="scroll-btn"
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                onClick={() => scrollToBottom('smooth')}
                className="absolute bottom-36 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg transition-colors hover:bg-slate-50"
              >
                New message ↓
              </motion.button>
            )}
          </AnimatePresence>

          <div className="relative shrink-0 border-t border-slate-100 bg-white/95 pt-3 backdrop-blur">
            <CloraComposer
              input={input}
              setInput={setInput}
              onSubmit={handleComposerSubmit}
              isStreaming={isStreaming}
              onStopClick={cancel}
              onAttachClick={() => fileInputRef.current?.click()}
              onMicClick={realtimeVoiceEnabled ? () => setShowLiveVoiceModal(true) : undefined}
              attachments={uploadedFile ? [uploadedFile] : []}
              onRemoveAttachment={() => {
                setUploadedFile(null);
                setUploadError(null);
                setUploadTelemetry(null);
              }}
              disabled={uploading || isStreaming}
              onErrorLogSelect={() => setShowErrorLogModal(true)}
              uploadTelemetry={uploadTelemetry}
              uploadError={uploadError}
              indexingFailed={indexingFailed}
              onRetryIndexing={handleRetryIndexing}
            />
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.mp3,.mp4,.webm,.mov,.wav,.m4a"
          />

          <ErrorLogModal
            isOpen={showErrorLogModal}
            onClose={() => setShowErrorLogModal(false)}
          />
        </>
      }
    />
  );
}
