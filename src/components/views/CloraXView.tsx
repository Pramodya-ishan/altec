import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { useAIWorkflowStream } from '../../hooks/useAIWorkflowStream';
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
import { isClientImageGenerationIntent, isClientVisualExplanationIntent } from '../../lib/ai/imageIntent';
import { buildProjectFileContext, isProjectArchiveFile, isProjectTextFile, MAX_CHAT_UPLOAD_FILES, readProjectArchive, readProjectTextFile } from '../../lib/projectFileUpload';


type ChatUpload = {
  id: string;
  name: string;
  size: number;
  isImage?: boolean;
  dataUrl?: string;
  previewUrl?: string;
  storagePath?: string;
  mimeType?: string;
  sourceId?: string;
  attachmentType?: "pdf" | "image" | "text" | "archive";
  textContent?: string;
};


type SavedChatHistoryItem = {
  id?: string;
  requestId?: string;
  userPrompt?: string;
  assistantAnswer?: string;
  role?: "user" | "assistant";
  text?: string;
  content?: string;
  createdAt?: string;
  sources?: any[];
  summary?: string[];
  answerCompleted?: boolean;
  answerQuality?: any;
  visualBlocks?: any[];
};

function flattenSavedHistory(history: SavedChatHistoryItem[]) {
  const flattened: any[] = [];
  history.forEach((item) => {
    const baseId = item.id || item.requestId || generateUUID();
    if (item.userPrompt) {
      flattened.push({ role: 'user', content: item.userPrompt, id: `${baseId}_user`, createdAt: item.createdAt || new Date().toISOString() });
    } else if (item.role === 'user') {
      flattened.push({ role: 'user', content: item.text || item.content || '', id: baseId, createdAt: item.createdAt || new Date().toISOString() });
    }
    const answer = item.assistantAnswer || (item.role === 'assistant' ? item.text || item.content || '' : '');
    if (answer) {
      const extracted = extractVisualBlocks(answer);
      flattened.push({
        role: 'assistant',
        content: extracted.cleanText,
        id: item.userPrompt ? `${baseId}_assistant` : baseId,
        serverMessageId: baseId,
        sources: item.sources || [],
        summary: item.summary || [],
        createdAt: item.createdAt || new Date().toISOString(),
        status: item.answerCompleted === false ? 'incomplete' : 'done',
        visualBlocks: [
          ...(Array.isArray(item.visualBlocks) ? item.visualBlocks : []),
          ...extracted.blocks,
        ],
        qualityReport: item.answerQuality || null,
      });
    }
  });
  return flattened;
}

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
    serverMessageId?: string,
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
    attachments?: any[],
    replyTo?: { id: string; role: string; content: string } | null,
    thinkingStatus?: string,
    generatedImage?: { url: string; alt?: string; storagePath?: string; model?: string },
    imageError?: string,
    imagePrompt?: string,
    qualityReport?: any,
    answerStatus?: 'official' | 'ai_solved' | 'predicted' | 'model_question' | 'general',
    sourceMode?: 'locked_pdf' | 'general_ai',
    evidenceContradictions?: any[]
  }[]>([
    {
      role: 'assistant',
      content: 'Ask about a lesson, paper, question, or result.',
      id: 'welcome'
    }
  ]);
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; role: string; content: string } | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState('');
  const [showTtsModal, setShowTtsModal] = useState(false);
  const [showLiveVoiceModal, setShowLiveVoiceModal] = useState(false);
  const [showErrorLogModal, setShowErrorLogModal] = useState(false);
  const [realtimeVoiceEnabled, setRealtimeVoiceEnabled] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<ChatUpload[]>([]);
  const uploadedFile = uploadedFiles[0] || null;
  const [indexingFailed, setIndexingFailed] = useState(false);
  const [pendingIngestData, setPendingIngestData] = useState<any[]>([]);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [savedChatHistory, setSavedChatHistory] = useState<SavedChatHistoryItem[]>([]);
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(false);
  const [sourceMode, setSourceMode] = useState<{ mode: 'locked_pdf' | 'general_ai'; title: string | null }>({ mode: 'general_ai', title: null });
  const chatSessionIdRef = useRef(`chat_${generateUUID()}`);

  useEffect(() => {
    if (!user?.uid) return;
    void apiFetch('/api/ai/conversation/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: chatSessionIdRef.current }),
    }).then((response) => {
      if (response.ok) setSourceMode({ mode: 'general_ai', title: null });
    }).catch(() => undefined);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const controller = new AbortController();
    apiFetch('/api/ai/conversation/source-mode', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload?.ok) setSourceMode({ mode: payload.mode === 'locked_pdf' ? 'locked_pdf' : 'general_ai', title: payload.title || null });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [user?.uid]);

  const unlockPdfSource = async () => {
    try {
      const response = await apiFetch('/api/ai/conversation/source-unlock', { method: 'POST' });
      if (!response.ok) throw new Error('Source unlock failed');
      setSourceMode({ mode: 'general_ai', title: null });
      showNotification('PDF source unlocked. General AI mode is active.', 'success');
    } catch {
      showNotification('The PDF source could not be unlocked.', 'error');
    }
  };

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
      const ttsRes = await apiFetch(apiUrl("/api/tts/generate"), {
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
  const bufferedAnswerRef = useRef(new Map<string, string>());
  const typingTimerRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => () => {
    if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
  }, []);

  const queueVisibleAnswer = React.useCallback((messageId: string, text: string, replace = false) => {
    const nextText = replace ? text : (bufferedAnswerRef.current.get(messageId) || '') + text;
    bufferedAnswerRef.current.set(messageId, nextText);
    if (typingTimerRef.current !== null) return;
    typingTimerRef.current = window.setTimeout(() => {
      typingTimerRef.current = null;
      const visible = bufferedAnswerRef.current.get(messageId) || '';
      setMessages(prev => prev.map(message => message.id === messageId
        ? { ...message, content: visible, status: 'streaming', thinkingStatus: visible ? 'Writing the answer' : message.thinkingStatus }
        : message));
    }, 28);
  }, []);

  const revealBufferedAnswer = React.useCallback((messageId: string, finalStatus: string, onComplete?: (content: string) => void) => {
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    const fullText = bufferedAnswerRef.current.get(messageId) || '';
    bufferedAnswerRef.current.delete(messageId);
    setMessages(prev => prev.map(message => message.id === messageId
      ? { ...message, content: fullText || message.content || '', status: finalStatus, thinkingStatus: undefined }
      : message));
    onComplete?.(fullText);
  }, []);

  const [uploading, setUploading] = useState(false);
  const [uploadTelemetry, setUploadTelemetry] = useState<UploadTelemetry | null>(null);
  const uploadStartedAtRef = useRef(0);
  const [importingStage, setImportingStage] = useState<string | null>(null);
  const [importProgressText, setImportProgressText] = useState("");

  useEffect(() => {
    if (uploadTelemetry?.phase !== "success") return;
    const timer = window.setTimeout(() => setUploadTelemetry(null), 500);
    return () => window.clearTimeout(timer);
  }, [uploadTelemetry?.phase]);

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

  const loadChatHistory = React.useCallback(async (mergeIntoCurrent = true) => {
    setIsLoadingChatHistory(true);
    try {
      const response = await apiFetch("/api/ai/chat-history");
      const data = await response.json().catch(() => null);
      const history = response.ok && Array.isArray(data?.chatHistory) ? data.chatHistory as SavedChatHistoryItem[] : [];
      setSavedChatHistory(history);
      if (mergeIntoCurrent && history.length > 0) {
        const flattened = flattenSavedHistory(history);
        setMessages((previous) => isStreamingRef.current ? previous : mergeMessages(previous, flattened));
      }
      return history;
    } catch (error) {
      console.warn("Failed to load history", error);
      return [];
    } finally {
      setIsLoadingChatHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadChatHistory(true);
  }, [loadChatHistory]);

  const handleRetryIndexing = async () => {
    if (pendingIngestData.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setIndexingFailed(false);
    setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: 'processing' } : null);

    const failed: any[] = [];
    for (const pending of pendingIngestData) {
      try {
        const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: pending?.sourceId || pending?.uploaded?.sourceId || "",
            storagePath: pending?.storagePath || pending?.uploaded?.storagePath || "",
            title: pending?.title || pending?.file?.name || "upload",
            fileName: pending?.title || pending?.file?.name || "upload",
            subject: pending?.subject || currentSubject,
            resourceType: "uploaded_pdf",
            sourceType: "uploaded_pdf",
            sourceScope: "chat_upload",
            medium: "Sinhala"
          })
        });
        const data = await ingestRes.json().catch(() => null);
        if (!ingestRes.ok || !data?.ok) {
          failed.push(pending);
        }
      } catch {
        failed.push(pending);
      }
    }

    setPendingIngestData(failed);
    setIndexingFailed(failed.length > 0);
    setUploading(false);
    if (failed.length > 0) {
      setUploadError(`${failed.length} uploaded PDF${failed.length === 1 ? '' : 's'} still could not be indexed.`);
      setUploadTelemetry((current) => current ? { ...current, phase: 'error' } : null);
    } else {
      setUploadTelemetry((current) => current ? { ...current, phase: 'success' } : null);
      setInput((current) => current || "Please analyze the uploaded project files.");
    }
  };

  const appendUploadedFile = (upload: ChatUpload) => {
    setUploadedFiles((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== upload.id && item.name !== upload.name);
      return [...withoutDuplicate, upload].slice(0, MAX_CHAT_UPLOAD_FILES);
    });
  };

  const readImagePreview = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The image preview could not be created."));
    reader.readAsDataURL(file);
  });

  const requestPdfPreview = async (sourceId: string, storagePath: string, title: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return undefined;
    const response = await apiFetch(apiUrl("/api/pdf/question-preview"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sourceId, storagePath, pageNumber: 1, crop: null, title }),
    });
    const payload = await response.json().catch(() => null);
    return response.ok && payload?.imageUrl ? String(payload.imageUrl) : undefined;
  };

  const processFile = async (file: File) => {
    const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = allowedImageTypes.has(file.type);
    const isProjectText = isProjectTextFile(file);
    const isProjectArchive = isProjectArchiveFile(file);

    setUploadError(null);
    setIndexingFailed(false);

    if (isProjectArchive) {
      setUploading(true);
      beginUploadTelemetry(file);
      setUploadTelemetry((current) => current ? { ...current, progress: 1, bytesTransferred: file.size, remainingBytes: 0, etaSeconds: 0, phase: "processing" } : null);
      try {
        const archive = await readProjectArchive(file);
        appendUploadedFile({
          id: generateUUID(),
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/zip",
          attachmentType: "archive",
          textContent: archive.text,
        });
        setUploadTelemetry((current) => current ? { ...current, phase: "success" } : null);
        if (archive.truncated) {
          setUploadError(`Added ${archive.includedFiles.length} useful files from ${file.name}. Large/generated files were safely skipped.`);
        }
      } catch (error: any) {
        setUploadError(error?.message || "The project ZIP could not be read.");
        setUploadTelemetry((current) => current ? { ...current, phase: "error" } : null);
      } finally {
        setUploading(false);
      }
      return;
    }

    if (isProjectText) {
      try {
        const textContent = await readProjectTextFile(file);
        appendUploadedFile({
          id: generateUUID(),
          name: file.name,
          size: file.size,
          mimeType: file.type || "text/plain",
          attachmentType: "text",
          textContent,
        });
      } catch (error: any) {
        setUploadError(error?.message || "The project file could not be read.");
      }
      return;
    }

    const maxBytes = isPdf ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if ((!isPdf && !isImage) || file.size <= 0 || file.size > maxBytes) {
      const message = !isPdf && !isImage
        ? "Upload PDF, PNG, JPEG, WebP, ZIP, or a supported text/code project file."
        : `The selected ${isPdf ? "PDF" : "image"} exceeds the ${isPdf ? "25 MB" : "10 MB"} limit.`;
      setUploadError(message);
      return;
    }

    setUploading(true);
    beginUploadTelemetry(file);

    try {
      const preview = isImage ? await readImagePreview(file) : undefined;
      const uploaded = await uploadAttachmentWithClientStorage({
        file,
        subject: currentSubject,
        sourceScope: "chat_upload",
        onProgress: trackUploadProgress(file.name),
      });

      appendUploadedFile({
        id: uploaded.sourceId,
        name: file.name,
        size: file.size,
        sourceId: uploaded.sourceId,
        storagePath: uploaded.storagePath,
        mimeType: uploaded.mimeType,
        attachmentType: uploaded.attachmentType,
        isImage,
        dataUrl: preview,
      });

      if (isImage) {
        setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: "success" } : null);
        return;
      }

      setUploadTelemetry((current) => current ? { ...current, progress: 1, remainingBytes: 0, etaSeconds: 0, phase: "processing" } : null);
      const ingestPayload = {
        sourceId: uploaded.sourceId,
        storagePath: uploaded.storagePath,
        title: file.name,
        fileName: file.name,
        subject: currentSubject,
        resourceType: "uploaded_pdf",
        sourceType: "uploaded_pdf",
        sourceScope: "chat_upload",
        medium: "Sinhala",
      };
      const ingestRes = await apiFetch("/api/pdf/process-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingestPayload),
      });
      const data = await ingestRes.json().catch(() => null);
      if (!ingestRes.ok || !data?.ok) {
        setUploadError(data?.message || data?.error || "The PDF was uploaded, but indexing failed.");
        setIndexingFailed(true);
        setUploadTelemetry((current) => current ? { ...current, phase: "error" } : null);
        setPendingIngestData((current) => [...current.filter((item) => item.sourceId !== uploaded.sourceId), ingestPayload]);
      } else {
        setPendingIngestData((current) => current.filter((item) => item.sourceId !== uploaded.sourceId));
        void requestPdfPreview(uploaded.sourceId, uploaded.storagePath, file.name)
          .then((previewUrl) => {
            if (previewUrl) setUploadedFiles((current) => current.map((item) => item.id === uploaded.sourceId ? { ...item, previewUrl } : item));
          })
          .catch(() => undefined);
        setUploadTelemetry((current) => current ? { ...current, phase: "success" } : null);
      }
    } catch (err: any) {
      setUploadError(err?.message || "The file could not be uploaded.");
      setUploadTelemetry((current) => current ? { ...current, phase: "error" } : null);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectedFiles = async (selected: File[]) => {
    if (selected.length === 0) return;

    const availableSlots = Math.max(0, MAX_CHAT_UPLOAD_FILES - uploadedFiles.length);
    const files = selected.slice(0, availableSlots);
    if (availableSlots === 0) {
      setUploadError(`You can attach up to ${MAX_CHAT_UPLOAD_FILES} project files at once.`);
      return;
    }
    if (selected.length > files.length) {
      setUploadError(`Only the first ${availableSlots} file${availableSlots === 1 ? '' : 's'} were added. The limit is ${MAX_CHAT_UPLOAD_FILES}.`);
    }
    for (const file of files) {
      await processFile(file);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await handleSelectedFiles(selected);
  };

  // Implement client-side confirmation and direct proxy import flow
  const handleConfirmCandidateAndImport = async (candidate: any) => {
    if (isStreaming || importingStage) return;

    setImportingStage("fetching");
    setImportProgressText("Downloading PDF file from secure web candidate link...");

    try {
      // 1. Fetch from proxy
      const proxyRes = await apiFetch(apiUrl("/api/web/pdf-proxy"), {
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
      const response = await apiFetch(apiUrl("/api/ai/feedback/wrong-answer"), {
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
        showNotification("The answer was marked as incorrect and will be reviewed next time.", "success");
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

    const continuePrompt = "Continue the previous answer.";
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
        onAnswerReplace: (text) => {
          if (activeStreamIdRef.current !== streamId) return;
          const streamBuffer = (window as any)._cloraStreamBuffer;
          if (streamBuffer?.frameId !== null && streamBuffer?.frameId !== undefined) {
            cancelAnimationFrame(streamBuffer.frameId);
          }
          if (streamBuffer) {
            streamBuffer.text = "";
            streamBuffer.frameId = null;
          }
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: text } : m));
        },
        onQualityReport: (qualityReport) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, qualityReport } : m));
        },
        onAnswerStatus: (provenance) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, answerStatus: provenance.answerStatus as any, sourceMode: provenance.sourceMode as any, evidenceContradictions: provenance.contradictions || [] } : m));
          setSourceMode(current => ({ mode: provenance.sourceMode === 'locked_pdf' || provenance.lockedSourceActive ? 'locked_pdf' : 'general_ai', title: provenance.sourceMode === 'locked_pdf' || provenance.lockedSourceActive ? (provenance.sourceTitle || current.title) : null }));
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
          setMessages(prev => prev.map(m => {
            if (m.id !== assistantMsgId) return m;
            finalContent = m.content || "";
            const failed = data?.finishReason === "direct_pdf_qa_failed";
            return {
              ...m,
              status: failed ? "error" : data?.completed === false ? "incomplete" : "done",
              qualityReport: data?.qualityReport || m.qualityReport,
              paperInfo: data?.paperInfo || m.paperInfo,
              errorCode: data?.errorCode,
              answerStatus: data?.answerStatus || m.answerStatus,
              sourceMode: data?.sourceMode || m.sourceMode,
              evidenceContradictions: data?.evidenceContradictions || m.evidenceContradictions,
              visualBlocks: Array.isArray(data?.visualBlocks) && data.visualBlocks.length > 0 ? data.visualBlocks : m.visualBlocks,
              sources: data?.clearSources === true
                ? []
                : Array.isArray(data?.sources) && data.sources.length > 0
                ? Array.from(new Map([...(m.sources || []), ...data.sources].map((source: any) => [source.id || source.sourceId || source.title, source])).values())
                : m.sources,
            };
          }));
          if (isVoiceFeedbackEnabled && finalContent) speakText(finalContent, assistantMsgId);
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
      thinkingStatus: "Understanding your question",
      replyTo: replyingTo,
      summary: [] as string[],
      sources: lastAssistantMessage.sources || [],
      serverMessageId: lastAssistantMessage.serverMessageId,
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
       chatId: lastAssistantMessage.serverMessageId || lastAssistantMessage.id || undefined,
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
       onAnswerReplace: (text) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: text } : m));
       },
       onQualityReport: (qualityReport) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, qualityReport } : m));
       },
       onAnswerStatus: (provenance) => {
         if (activeStreamIdRef.current !== streamId) return;
         setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, answerStatus: provenance.answerStatus as any, sourceMode: provenance.sourceMode as any, evidenceContradictions: provenance.contradictions || [] } : m));
         setSourceMode(current => ({ mode: provenance.sourceMode === 'locked_pdf' || provenance.lockedSourceActive ? 'locked_pdf' : 'general_ai', title: provenance.sourceMode === 'locked_pdf' || provenance.lockedSourceActive ? (provenance.sourceTitle || current.title) : null }));
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
               return {
                 ...m,
                 status: data?.completed === false ? "incomplete" : "done",
                 serverMessageId: lastAssistantMessage.serverMessageId || m.serverMessageId,
                 visualBlocks: Array.isArray(data?.visualBlocks) && data.visualBlocks.length > 0 ? data.visualBlocks : m.visualBlocks,
               };
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
    if ((!input.trim() && uploadedFiles.length === 0) || isStreaming || uploading) return;
    const currentUploads = [...uploadedFiles];
    const currentUpload = currentUploads[0] || null;
    const userMsg = input.trim() || "Analyze the attached project files.";
    setInput('');
    setSummaryExpanded(false);
    setUploadedFiles([]);
    setUploadError(null);
    setUploadTelemetry(null);

    let imagePayload: { mimeType: string; data: string } | undefined = undefined;
    const inlineImage = currentUploads.find((file) => file.isImage && file.dataUrl);
    if (inlineImage?.dataUrl) {
      const parts = inlineImage.dataUrl.split(",");
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
      replyTo: replyingTo,
      attachments: currentUploads.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType || (file.isImage ? "image/jpeg" : "text/plain"),
        isImage: file.isImage,
        dataUrl: file.dataUrl,
        previewUrl: file.previewUrl,
        storagePath: file.storagePath,
        sourceId: file.sourceId,
        attachmentType: file.attachmentType,
      }))
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
    setReplyingTo(null);
    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);

    const parsedCommand = parseChatCommand(userMsg);

    if (parsedCommand.command === 'tts') {
       let textToSpeak = parsedCommand.text;

       if (parsedCommand.text.trim() === 'last') {
          const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
          if (lastAssistant) {
            textToSpeak = lastAssistant.content;
          } else {
            textToSpeak = "No previous message was found.";
          }
       } else if (parsedCommand.text.trim() === 'file') {
          textToSpeak = "The attached file is being analyzed.";
          if (currentUpload && currentUpload.name) {
             textToSpeak = `The attached file ${currentUpload.name} is ready.`;
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

    if (parsedCommand.command === 'image' || isClientImageGenerationIntent(userMsg, Boolean(imagePayload))) {
      try {
        const referenceMessage = [...messages]
          .reverse()
          .find((message) => message.role === 'assistant' && (message.content || message.paperInfo || message.visualBlocks?.length));
        const referenceText = referenceMessage?.content || '';
        const pdfPreview = referenceMessage?.visualBlocks?.find((block: any) => block?.type === 'pdf_image_preview');
        const evidence = referenceMessage?.paperInfo?.sourceEvidence;
        const referencePdf = (pdfPreview?.sourceId && pdfPreview?.pageNumber)
          ? {
              sourceId: pdfPreview.sourceId,
              storagePath: pdfPreview.storagePath,
              pageNumber: pdfPreview.pageNumber,
              crop: pdfPreview.crop || null,
            }
          : (referenceMessage?.paperInfo?.sourceId && evidence?.pageNumber)
            ? {
                sourceId: referenceMessage.paperInfo.sourceId,
                pageNumber: evidence.pageNumber,
                crop: evidence.imageRegion || null,
              }
            : null;
        const imageRes = await apiFetch(apiUrl("/api/image/generate"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`
          },
          body: JSON.stringify({
            prompt: parsedCommand.command === 'image' ? parsedCommand.text : userMsg,
            subject: referenceMessage?.paperInfo?.subject || currentSubject,
            referenceText: String(referenceText).slice(0, 5_000),
            referencePdf,
            aspectRatio: "4:3",
          })
        });

        if (imageRes.ok) {
          const data = await imageRes.json();
          const imageUrl = data.imageUrl || data.image;
          if (!imageUrl) {
            throw new Error("IMAGE_URL_MISSING");
          }
          const isVisualExplanation = isClientVisualExplanationIntent(userMsg);
          const visualExplanation = isVisualExplanation && referenceText
            ? `මෙන්න එය සැබෑ රූපයක් සමඟ පැහැදිලි කළ ආකාරය.\n\nරූපයේ සංකේත සහ ඊතල කියවීමට අදාළ සාරාංශය:\n${String(referenceText).slice(0, 1_200)}`
            : isVisualExplanation
              ? "මෙන්න එය සැබෑ රූපයක් සමඟ පැහැදිලි කළ ආකාරය. Sinhala විස්තරය රූපයෙන් පිටත දක්වා ඇති නිසා අකුරු පැහැදිලිව පෙනේ."
              : "මෙන්න ඉල්ලූ අධ්‍යාපනික රූපය.";
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
            ...m,
            content: visualExplanation,
            generatedImage: {
              url: imageUrl,
              alt: userMsg || "Generated educational image",
              storagePath: data.storagePath,
              model: data.model,
            },
            imagePrompt: userMsg,
            status: "done",
          } : m));
        } else {
          const data = await imageRes.json().catch(() => null);
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: data?.error || "රූපය නිර්මාණය කිරීමට මේ මොහොතේ නොහැකි වුණා. නැවත උත්සාහ කරන්න.", status: "error" } : m));
        }
      } catch (err: any) {
        const imageError = err?.message === "IMAGE_URL_MISSING"
          ? "රූප නිර්මාණය අවසන් වුණත් preview URL එක ලැබුණේ නැහැ. නැවත උත්සාහ කරන්න."
          : "රූප නිර්මාණ සේවාවට සම්බන්ධ වීමට නොහැකි වුණා. නැවත උත්සාහ කරන්න.";
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: imageError, imageError, imagePrompt: userMsg, status: "error" } : m));
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

    if (replyingTo) {
      messagePrompt = `[Replying to ${replyingTo.role} message: ${replyingTo.content.slice(0, 1200)}]\n\n${messagePrompt}`;
    }

    const projectFileContext = buildProjectFileContext(currentUploads);
    if (projectFileContext) messagePrompt += projectFileContext;

    const attachmentsPayload = currentUploads
      .filter((file) => file.storagePath && file.mimeType && file.id !== inlineImage?.id)
      .map((file) => ({
        sourceId: file.sourceId,
        storagePath: file.storagePath as string,
        mimeType: file.mimeType as string,
        fileName: file.name,
      }));

    await sendAIMessage({
        prompt: messagePrompt,
        // Keep the subject tab as explicit context. Previously this was always
        // undefined, so short follow-ups could drift to SFT or forget the ET
        // paper selected in the previous turn.
        activeSubject: currentSubject.toUpperCase(),
        mode: toolMode,
        history: nextMessages.slice(-10).map(m => ({ role: m.role, text: m.content })),
        image: imagePayload,
        attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
        chatId: chatSessionIdRef.current,
        assistantMessageId: assistantMsgId,
        onToken: (text) => {
          if (activeStreamIdRef.current !== streamId) return;
          queueVisibleAnswer(assistantMsgId, text, false);
        },
        onAnswerReplace: (text) => {
          if (activeStreamIdRef.current !== streamId) return;
          queueVisibleAnswer(assistantMsgId, text, true);
        },
        onQualityReport: (qualityReport) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, qualityReport } : m));
        },
        onAnswerStatus: (provenance) => {
          if (activeStreamIdRef.current !== streamId) return;
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, answerStatus: provenance.answerStatus as any, sourceMode: provenance.sourceMode as any, evidenceContradictions: provenance.contradictions || [] } : m));
          setSourceMode(current => ({ mode: provenance.sourceMode === 'locked_pdf' || provenance.lockedSourceActive ? 'locked_pdf' : 'general_ai', title: provenance.sourceMode === 'locked_pdf' || provenance.lockedSourceActive ? (provenance.sourceTitle || current.title) : null }));
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
          if (activeStreamIdRef.current !== streamId) return;
          const label = statusData?.message || statusData?.label || "Thinking";
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, thinkingStatus: label, status: "streaming" } : m));
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

          setMessages(prev => prev.map(m => {
            if (m.id !== assistantMsgId) return m;
            return {
              ...m,
              status: "streaming",
              paperInfo: data?.paperInfo || m.paperInfo,
              errorCode: data?.errorCode,
              serverMessageId: data?.messageId || m.serverMessageId,
              generatedImage: data?.image?.imageUrl ? { url: data.image.imageUrl, storagePath: data.image.storagePath, model: data.image.model, alt: userMsg } : m.generatedImage,
              visualBlocks: Array.isArray(data?.visualBlocks) && data.visualBlocks.length > 0 ? data.visualBlocks : m.visualBlocks,
              sources: data?.clearSources === true
                ? []
                : Array.isArray(data?.sources) && data.sources.length > 0
                ? Array.from(new Map([...(m.sources || []), ...data.sources].map((source: any) => [source.id || source.sourceId || source.title, source])).values())
                : m.sources,
            };
          }));
          const finalStatus = data?.finishReason === "direct_pdf_qa_failed"
            ? "error"
            : data?.completed === false
              ? "incomplete"
              : "done";
          revealBufferedAnswer(assistantMsgId, finalStatus, (revealedContent) => {
            if (isVoiceFeedbackEnabled && revealedContent) speakText(revealedContent, assistantMsgId);
          });
          if (activeStreamIdRef.current === streamId) {
            activeStreamIdRef.current = null;
            currentRequestIdRef.current = null;
          }
        }
    });
  };

  const handleNewChat = React.useCallback(() => {
     if (isStreamingRef.current || isStreaming) {
       cancel();
     }
     activeStreamIdRef.current = null;
     currentRequestIdRef.current = null;
     bufferedAnswerRef.current.clear();
     if (typingTimerRef.current !== null) {
       window.clearTimeout(typingTimerRef.current);
       typingTimerRef.current = null;
     }
     recognitionRef.current?.stop?.();
     stopSpeaking();
     setMessages([{ role: 'assistant', content: 'Ask about a lesson, paper, question, or result.', id: 'welcome' }]);
     setInput('');
     setReplyingTo(null);
     setUploadedFiles([]);
     setUploadError(null);
     setUploadTelemetry(null);
     setPendingIngestData([]);
     setIndexingFailed(false);
     setImportingStage(null);
     setImportProgressText('');
     setIsDrawerOpen(false);
     setPdfModalUrl('');
     chatSessionIdRef.current = `chat_${generateUUID()}`;
     setSourceMode({ mode: 'general_ai', title: null });
     void apiFetch('/api/ai/conversation/reset', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ conversationId: chatSessionIdRef.current }),
     }).catch(() => undefined);
  }, [cancel, isStreaming]);

  const handleClearChat = React.useCallback(async () => {
    if (isClearingChat) return;
    const confirmed = window.confirm("Clear this chat and remove its saved history? This cannot be undone.");
    if (!confirmed) return;
    setIsClearingChat(true);
    try {
      const response = await apiFetch("/api/ai/chat-history/clear", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Chat history could not be cleared.");
      setSavedChatHistory([]);
      setShowChatHistory(false);
      handleNewChat();
      showNotification("Chat cleared.", "success");
    } catch (error: any) {
      showNotification(error?.message || "Chat history could not be cleared.", "error");
    } finally {
      setIsClearingChat(false);
    }
  }, [handleNewChat, isClearingChat, showNotification]);

  useEffect(() => {
    const startNewChat = () => handleNewChat();
    const clearChat = () => void handleClearChat();
    const openHistory = () => {
      setShowChatHistory(true);
      void loadChatHistory(false);
    };
    window.addEventListener('clora:new-chat', startNewChat);
    window.addEventListener('clora:clear-chat', clearChat);
    window.addEventListener('clora:history', openHistory);
    return () => {
      window.removeEventListener('clora:new-chat', startNewChat);
      window.removeEventListener('clora:clear-chat', clearChat);
      window.removeEventListener('clora:history', openHistory);
    };
  }, [handleClearChat, handleNewChat, loadChatHistory]);

  const isEmptyChat = messages.length <= 1 && !isStreaming;

  const handleComposerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0) return;

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
                  showNotification("The PDF preview could not be opened. Try opening it in a new tab.", "error");
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
                title="Source document"
              />
            </React.Suspense>
          )}
          <TtsComposerModal uploadedFile={uploadedFile}
             isOpen={showTtsModal}
             onClose={() => setShowTtsModal(false)}
            onComplete={(url) => {
              setMessages(prev => [...prev, { role: 'assistant', content: 'Voice answer ready.', id: generateUUID(), audioUrl: url }]);
            }}
          />
          <RealtimeLiveCallPanel
            isOpen={showLiveVoiceModal}
            onClose={() => setShowLiveVoiceModal(false)}
            currentSubject={currentSubject}
            activeSourceId={uploadedFiles.find((file) => file.attachmentType === "pdf")?.storagePath || uploadedFile?.storagePath || undefined}
            recentAttachmentIds={uploadedFiles.map((file) => file.storagePath).filter(Boolean) as string[]}
          />

          <AnimatePresence>
            {showChatHistory && (
              <motion.div
                className="fixed inset-0 z-[120] flex items-stretch justify-end bg-slate-950/30 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(event) => { if (event.target === event.currentTarget) setShowChatHistory(false); }}
              >
                <motion.aside
                  initial={{ x: 36, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 36, opacity: 0 }}
                  className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
                  aria-label="Chat history"
                >
                  <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <History className="h-4 w-4" />
                      Chat history
                    </div>
                    <button type="button" onClick={() => setShowChatHistory(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close chat history"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {isLoadingChatHistory ? (
                      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div>
                    ) : savedChatHistory.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-500">No saved conversations yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {savedChatHistory.map((item, index) => (
                          <button
                            type="button"
                            key={item.id || item.requestId || index}
                            onClick={() => {
                              const restored = flattenSavedHistory(savedChatHistory.slice(0, index + 1));
                              setMessages([{ role: 'assistant', content: 'Ask about a lesson, paper, question, or result.', id: 'welcome' }, ...restored]);
                              setShowChatHistory(false);
                            }}
                            className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <div className="line-clamp-2 text-sm font-semibold text-slate-800">{item.userPrompt || item.text || item.content || 'Saved conversation'}</div>
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.assistantAnswer || (item.role === 'assistant' ? item.text || item.content : '') || 'Open conversation'}</div>
                            <div className="mt-2 text-[11px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Saved chat'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="clora-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white" ref={scrollRef}>
            {isEmptyChat ? (
              <CloraHero />
            ) : (
              <div className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-6 pt-5 sm:px-6 sm:pt-8">
                <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  if (msg.id === 'welcome' && messages.length > 1) return null; // hide welcome if there are other messages
                  return (
                    <CloraMessageBubble
                      key={msg.id || idx}
                      message={msg}
                      isStreaming={(msg.status === 'streaming' || msg.status === 'typing') && idx === messages.length - 1}
                      onReply={(message) => setReplyingTo({ id: message.id, role: message.role, content: String(message.content || '').slice(0, 1200) })}
                      onSuggestionClick={(suggestion) => setInput(suggestion)}
                      onRetryImage={(prompt) => { setInput(prompt); requestAnimationFrame(() => document.getElementById('clora-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))); }}
                      onContinue={msg.status === 'incomplete' ? handleContinue : undefined}
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
                className="absolute bottom-36 left-1/2 z-30 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-lg transition-colors hover:bg-slate-50"
                aria-label="Jump to latest answer"
                title="Jump to latest answer"
              >
                ↓
              </motion.button>
            )}
          </AnimatePresence>

          <div className="relative shrink-0 bg-white/95 pt-2 backdrop-blur">
            <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-between gap-3 px-4 sm:px-6" aria-live="polite">
              <div className={`inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${sourceMode.mode === 'locked_pdf' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                {sourceMode.mode === 'locked_pdf' ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Globe className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{sourceMode.mode === 'locked_pdf' ? `Source locked${sourceMode.title ? ` · ${sourceMode.title}` : ''}` : 'General AI mode'}</span>
              </div>
              {sourceMode.mode === 'locked_pdf' && (
                <button type="button" onClick={() => void unlockPdfSource()} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  Unlock PDF
                </button>
              )}
            </div>
            <CloraComposer
              input={input}
              setInput={setInput}
              replyTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onSubmit={handleComposerSubmit}
              isStreaming={isStreaming}
              onStopClick={cancel}
              onAttachClick={() => fileInputRef.current?.click()}
              onFilesAdded={handleSelectedFiles}
              onMicClick={realtimeVoiceEnabled ? () => setShowLiveVoiceModal(true) : undefined}
              attachments={uploadedFiles}
              onRemoveAttachment={(id) => {
                setUploadedFiles((current) => current.filter((file, index) => file.id !== id && index !== id));
                setUploadError(null);
                if (uploadedFiles.length <= 1) setUploadTelemetry(null);
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
            multiple
            accept="application/pdf,application/zip,application/x-zip-compressed,image/png,image/jpeg,image/webp,text/*,.zip,.md,.markdown,.csv,.json,.jsonl,.js,.jsx,.mjs,.cjs,.ts,.tsx,.html,.htm,.css,.scss,.sass,.less,.xml,.yaml,.yml,.py,.java,.c,.h,.cpp,.hpp,.cs,.go,.rs,.php,.rb,.sh,.sql,.env,.ini,.toml,.log"
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
