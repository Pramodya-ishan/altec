import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { useAIWorkflowStream } from '../../hooks/useAIWorkflowStream';
import { AIWorkflowStatus } from '../ai/AIWorkflowStatus';
import { SafeReasoningSummary } from '../ai/SafeReasoningSummary';
import { apiFetch } from '../../lib/api';
import { getRecommendedUploadMode } from '../../lib/uploadMode';
import { uploadPdfWithClientStorage } from '../../lib/clientStorageUpload';
import { auth } from '../../lib/firebase';
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
  Lock
} from 'lucide-react';
import { SourceCard } from '../ui/SourceCard';
import { MessageRenderer } from '../ui/MessageRenderer';
import { VisualBlockRenderer } from '../ui/VisualBlockRenderer';
import { extractVisualBlocks } from '../../lib/visualBlockExtractor';
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea';
import { useNearBottomAutoScroll } from '../../hooks/useNearBottomAutoScroll';

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
                    {msg.sources.map((src: any, i: number) => (
                      <button 
                        key={i} 
                        className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left pl-2 pr-4 py-2 rounded-xl transition-all shadow-sm group active:scale-95"
                        onClick={() => {
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
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors border border-rose-100/50">
                          <FileText className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[200px] leading-tight">
                            {src.title || src.fileName || "Document"}
                          </p>
                          {(src.subject || src.year) && (
                            <p className="text-[9px] font-bold text-slate-400 mt-0.5 truncate max-w-[200px]">
                              {src.subject} {src.year ? `• ${src.year}` : ''}
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
  
  if (user?.email !== "26002ishan@gmail.com") {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-slate-500 font-medium leading-relaxed">
            This component is currently restricted and can only be accessed by the administrator account.
          </p>
        </div>
      </div>
    );
  }

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
    errorCode?: string
  }[]>([
    {
      role: 'assistant',
      content: 'ආයුබෝවන්! මම Clora X Assistant. ඔබට අද කුමන විභාග ප්‍රශ්නයක් හෝ පාඩමක් ගැනද දැනගන්න අවශ්‍ය?',
      id: 'welcome'
    }
  ]);
  const [input, setInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; isImage?: boolean; dataUrl?: string } | null>(null);
  
  // Voice Tutor States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceFeedbackEnabled, setIsVoiceFeedbackEnabled] = useState(false);
  const [isTtsAvailable, setIsTtsAvailable] = useState(true);

  useEffect(() => {
    fetch('/api/ai/model-health')
      .then(r => r.json())
      .then(data => {
        if (data && data.models && data.models.tts && (data.models.tts.available === false || data.models.tts.enabled === false)) {
          setIsTtsAvailable(false);
          setIsVoiceFeedbackEnabled(false);
        }
      })
      .catch(err => console.error("Health check failed", err));
  }, []);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const currentUtteranceRef = useRef<any>(null);

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    // strip out markdown tags, emojis, braces, asterisks to make speech clean
    const clean = text
      .replace(/[\*\#\`\_\-\[\]\(\)]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return;

    setIsSpeaking(true);
    // Split into smaller segments for reliable pronunciation flow
    const chunks = clean.match(/.{1,160}(?=\s|$)/g) || [clean];
    let idx = 0;

    const speakChunk = () => {
      if (idx >= chunks.length) {
        setIsSpeaking(false);
        return;
      }
      const chunk = chunks[idx];
      const utterance = new SpeechSynthesisUtterance(chunk);
      currentUtteranceRef.current = utterance;

      const isSinhala = /[\u0D80-\u0DFF]/.test(chunk);
      utterance.lang = isSinhala ? 'si-LK' : 'en-US';

      const voices = synthRef.current?.getVoices() || [];
      const v = voices.find(voice => 
        isSinhala 
          ? voice.lang.startsWith('si') 
          : (voice.lang.startsWith('en') && (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Premium')))
      );
      if (v) utterance.voice = v;
      utterance.rate = isSinhala ? 0.95 : 1.0;

      utterance.onend = () => {
        idx++;
        speakChunk();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };
      synthRef.current?.speak(utterance);
    };

    speakChunk();
  };

  const stopSpeaking = () => {
    if (synthRef.current) synthRef.current.cancel();
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
  const [importingStage, setImportingStage] = useState<string | null>(null);
  const [importProgressText, setImportProgressText] = useState("");

  // Clear chat custom dialog state (Avoid iframe restricted window.confirm)
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  // Upload file using FormData with fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    
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
      };
      reader.onerror = () => {
        setUploadError("Failed to read image file.");
        setUploadedFile(null);
        setUploading(false);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadedFile({ name: file.name, size: file.size });
    
    try {
      const uploaded = await uploadPdfWithClientStorage({
        file,
        subject: currentSubject,
        sourceScope: "chat_upload"
      });

      const ingestFd = new FormData();
      ingestFd.append("file", file);
      ingestFd.append("sourceId", uploaded.sourceId);
      ingestFd.append("storagePath", uploaded.storagePath);
      ingestFd.append("title", file.name);
      ingestFd.append("subject", currentSubject);
      ingestFd.append("resourceType", "uploaded_pdf");
      ingestFd.append("sourceType", "uploaded_pdf");
      ingestFd.append("sourceScope", "chat_upload");
      ingestFd.append("medium", "Sinhala");

      const ingestRes = await apiFetch("/api/rag/ingest-uploaded", {
        method: "POST",
        body: ingestFd
      });

      const data = await ingestRes.json().catch(() => null);
      if (!ingestRes.ok || !data?.ok) {
        setUploadError(data?.message || data?.code || "Upload ingest failed");
        setUploadedFile(null);
        setUploading(false);
        return;
      }

      if (data.needsOcr) {
        setInput(prev => prev + `\n[Uploaded PDF: ${file.name}] ${data.message} `);
      } else {
        setInput(prev => prev + `\n[Uploaded PDF: ${file.name}] Please read this pdf and answer: `);
      }
      setUploading(false);
    } catch (err: any) {
      setUploadError(err.message || "Error reading file.");
      setUploadedFile(null);
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Implement client-side confirmation and direct proxy import flow
  const handleConfirmCandidateAndImport = async (candidate: any) => {
    if (isStreaming || importingStage) return;
    
    setImportingStage("fetching");
    setImportProgressText("Downloading PDF file from secure web candidate link...");

    try {
      // 1. Fetch from proxy
      const proxyRes = await fetch("/api/web/pdf-proxy", {
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
      const ingestFd = new FormData();
      ingestFd.append("file", file);
      ingestFd.append("sourceId", uploaded.sourceId);
      ingestFd.append("storagePath", uploaded.storagePath);
      ingestFd.append("title", candidate.title);
      ingestFd.append("subject", candidate.subject || currentSubject);
      ingestFd.append("year", candidate.year || "");
      ingestFd.append("resourceType", candidate.resourceType || "past_paper");
      ingestFd.append("sourceType", "past_paper");
      ingestFd.append("sourceScope", "official_library");
      ingestFd.append("medium", "Sinhala");

      const ingestRes = await apiFetch("/api/rag/ingest-uploaded", {
        method: "POST",
        body: ingestFd
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
      const response = await fetch("/api/ai/feedback/wrong-answer", {
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
            speakText(finalContent);
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
      createdAt: new Date().toISOString()
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
    
    await sendAIMessage({
        prompt: userMsg,
        activeSubject: currentSubject,
        mode: "auto",
        history: nextMessages.slice(-10).map(m => ({ role: m.role, text: m.content })),
        image: imagePayload,
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
            speakText(finalContent);
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

  const isEmptyChat = messages.length <= 1 && !isStreaming;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#f8fafd] text-[#1f1f1f] font-sans relative">
      
      {/* Floating Clear Chat Button */}
      {!isEmptyChat && (
        <div className="absolute top-4 left-4 z-20">
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200/60 hover:border-rose-200 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Clear Chat History"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      )}

      {/* PURE REACT CONFIRMATION DIALOG */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">Clear Chat History?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">ඔබගේ පෙර සියලුම සංවාද දත්ත මකා දැමීමට සහතිකද?</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeClearHistory}
                  className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 rounded-full text-xs font-bold text-white transition-colors shadow-xs"
                >
                  Yes, Clear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Proxy Candidate Importing Modal */}
      <AnimatePresence>
        {importingStage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          >
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Syncing and Ingesting PDF...</h3>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-600">Clora X RAG Pipeline</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-black/5">
                  <div className={cn(
                    "h-full bg-indigo-600 transition-all duration-500",
                    importingStage === "fetching" ? "w-[25%]" :
                    importingStage === "uploading" ? "w-[50%]" :
                    importingStage === "ingesting" ? "w-[85%]" : "w-full"
                  )} />
                </div>
                <p className="text-xs font-bold text-slate-500 italic leading-snug">{importProgressText}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Message Scrolling Box */}
      <div className="flex-1 min-h-0 relative">
        <div 
          ref={scrollRef} 
          className="absolute inset-0 overflow-y-auto scrollbar-none scroll-smooth"
        >
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
            {isEmptyChat ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] mt-10 sm:mt-20 px-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-3xl bg-white shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-indigo-500" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight text-center mb-3">
                  Hello, {(user as any)?.username || (user as any)?.displayName || 'Student'}
                </h2>
                <p className="text-slate-500 font-medium text-center max-w-md mx-auto leading-relaxed">
                  How can I help you today? I can answer questions from past papers, explain complex topics, or help you study efficiently.
                </p>
                
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mx-auto">
                  {[
                    { title: "2023 Paper Structure", icon: <FileText className="w-4 h-4 text-emerald-500"/>, prompt: "What is the structure of the 2023 SFT paper?" },
                    { title: "Explain Z-Score", icon: <BrainCircuit className="w-4 h-4 text-purple-500"/>, prompt: "How is the Z-score calculated in A/L exams?" },
                    { title: "Review Mistakes", icon: <CheckCircle className="w-4 h-4 text-rose-500"/>, prompt: "Can you quiz me on my recent mistakes?" },
                    { title: "Summarize Notes", icon: <Database className="w-4 h-4 text-blue-500"/>, prompt: "Provide a short summary on SFT main units." }
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInput(chip.prompt)}
                      className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all active:scale-95 text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {chip.icon}
                        <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{chip.title}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium line-clamp-1">{chip.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message Thread */
              <div className="space-y-12">
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const isStreamingActive = msg.status === 'streaming';
                  return (
                    <motion.div
                      key={msg.id || index}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className={cn(
                        "flex w-full gap-5",
                        isUser ? "justify-end animate-fadeIn" : "justify-start"
                      )}
                    >
                      
                      
                      <div
                        className={cn(
                          "transition-all leading-relaxed tracking-normal",
                          isUser
                            ? "bg-[#f0f4f9] text-[#1f1f1f] border border-slate-200/40 rounded-3xl rounded-br-lg px-6 py-4 text-[16px] max-w-[85%] sm:max-w-[75%] shadow-sm"
                            : "text-[#1f1f1f] max-w-full flex-1 bg-transparent"
                        )}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <div className="space-y-4">
                            
                            {/* Workflow Chips & Reasoning Log */}
                            <ThoughtProcessPanel msg={msg} isStreamingActive={isStreamingActive} status={status} tools={tools} />
                            {/* Markdown Answer Area */}
                            {msg.content && msg.content.trim().length > 0 && (
                              <MessageRenderer content={msg.content} />
                            )}
                            
                            {/* Visual Blocks */}
                            {msg.visualBlocks?.map((block, idx) => (
                              <div key={idx} className="mt-4">
                                <VisualBlockRenderer block={block} />
                              </div>
                            ))}

                            {/* Loading Dots before first token */}
                            {isStreamingActive && !msg.content && (
                              <div className="flex items-center gap-1 mt-2 pl-1 h-6">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                              </div>
                            )}

                            {/* Suggestions */}
                            {msg.suggestions && msg.suggestions.length > 0 && !isStreaming && (
                              <div className="flex flex-col items-start gap-2 mt-4 pt-4 border-t border-slate-100">
                                {msg.suggestions.map((suggestion, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => handleChipClick(suggestion)}
                                    className="px-3 py-1.5 bg-white border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer shadow-2xs active:scale-95 text-left"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                                
                                {msg.paperInfo && (
                                  <button 
                                    onClick={() => handleWrongAnswer(msg)}
                                    className="mt-2 px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center gap-1 rounded-lg border border-transparent hover:border-rose-100 cursor-pointer"
                                  >
                                    <ThumbsDown className="w-3 h-3" />
                                    <span>වැරදි පිළිතුරක්ද? (Wrong Answer?)</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Direct Candidate PDF Ingestion Actions (Web Confirmation UI) */}
                            {msg.webCandidates && msg.webCandidates.length > 0 && (
                              <div className="space-y-2 mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-fadeIn">
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4 text-indigo-600 animate-spin" />
                                  <p className="text-xs font-black text-indigo-700 uppercase tracking-wider">Candidate Web PDFs Found:</p>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {msg.webCandidates.map((cand: any, i: number) => (
                                    <div 
                                      key={i}
                                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 p-3 rounded-xl gap-3 hover:border-slate-300 transition-colors shadow-2xs"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-800 truncate">{cand.title}</p>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{cand.url}</p>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                                        <a 
                                          href={cand.url} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all border border-slate-200 shadow-2xs"
                                          title="Open PDF to verify"
                                        >
                                          <ArrowUpRight className="w-4 h-4" />
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => handleConfirmCandidateAndImport(cand)}
                                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg active:scale-95 transition-all cursor-pointer shadow-md"
                                        >
                                          <Download className="w-3 h-3" />
                                          <span>Confirm & Save</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Error Block */}
                            {((error && isStreamingActive) || msg.status === "error" || msg.errorCode) && (
                              <div className="text-rose-600 font-semibold text-xs p-3.5 bg-rose-50 rounded-xl mb-2 border border-rose-100 flex items-start gap-2 shadow-2xs mt-2">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p>
                                    {msg.errorCode === "AI_BILLING_EXHAUSTED" || (error && (error.includes("credits") || error.includes("depleted") || error.includes("Billing")))
                                      ? "AI credits අවසන් වී ඇත. Billing/credits update කරන්න."
                                      : msg.errorCode === "AI_RATE_LIMITED"
                                      ? "AI rate limit එකක් වුණා. ටිකකින් උත්සාහ කරන්න."
                                      : msg.errorCode === "AI_CLIENT_RUNTIME_ERROR"
                                      ? "AI client runtime error එකක් සිදුවිය."
                                      : error || "පිළිතුර ලබාගැනීමට නොහැකි විය. (Unable to retrieve answer)"}
                                  </p>
                                  {(msg.errorCode === "AI_BILLING_EXHAUSTED" || (error && (error.includes("credits") || error.includes("depleted") || error.includes("Billing")))) ? (
                                    <div className="mt-2">
                                      <p className="text-[10px] text-rose-500/80 mb-2">Local features are still available without AI.</p>
                                      <div className="flex flex-wrap gap-2">
                                        <button onClick={() => setInput("give all pdfs you have")} className="px-2 py-1 bg-white border border-rose-200 rounded shadow-xs active:scale-95 transition-transform text-rose-700 font-bold text-[11px] cursor-pointer">List PDFs</button>
                                        <button onClick={() => setInput("2024 SFT Q1")} className="px-2 py-1 bg-white border border-rose-200 rounded shadow-xs active:scale-95 transition-transform text-rose-700 font-bold text-[11px] cursor-pointer">Check Cache</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-rose-500/80 mt-1">කරුණාකර නැවත උත්සාහ කරන්න. (Please retry)</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating Jump to Latest Button */}
        {showScrollButton && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-4 right-4 sm:right-6 z-20 flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-full shadow-md border border-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4 text-slate-500" />
            <span>Jump to latest</span>
          </button>
        )}
      </div>

      {/* Recoverable Error Block */}
      {(() => {
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        const isRecoverableOrIncomplete = isRecoverableError || (lastAssistant && (lastAssistant.status === "incomplete" || lastAssistant.status === "error"));
        return isRecoverableOrIncomplete && !isStreaming ? (
          <div className="flex justify-center mb-1 shrink-0 px-4">
            <button 
              onClick={handleContinue}
              className="flex items-center gap-2 px-4 py-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-full font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>පිළිතුර මැදින් නතර වුණා. Continue කරන්න.</span>
            </button>
          </div>
        ) : null;
      })()}

      {/* Premium Gemini-style Bottom Composer */}
      <div className="shrink-0 bg-gradient-to-t from-[#f8fafd] via-[#f8fafd]/95 to-[#f8fafd]/0 px-4 sm:px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+18px)] z-10">
        <div className="mx-auto max-w-3xl space-y-2">
          
          {/* File Upload Preview & Error Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {uploadedFile && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full py-1 pl-3.5 pr-2.5 shadow-xs text-xs text-slate-700 animate-fadeIn shrink-0">
                {uploadedFile.isImage && uploadedFile.dataUrl ? (
                  <img 
                    src={uploadedFile.dataUrl} 
                    alt="Upload Preview" 
                    className="w-5 h-5 object-cover rounded-md border border-slate-200 shrink-0"
                  />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span className="font-bold truncate max-w-[150px] sm:max-w-[240px]">{uploadedFile.name}</span>
                {uploadedFile.isImage ? (
                  <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 shrink-0 ml-1">
                    Image Ready
                  </span>
                ) : uploading ? (
                  <span className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 shrink-0 ml-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Ingesting...
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 shrink-0 ml-1">
                    <CheckCircle className="w-2.5 h-2.5" /> Indexed
                  </span>
                )}
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 ml-1 cursor-pointer transition-all active:scale-90"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-full py-1 pl-3.5 pr-3 text-xs text-rose-700 animate-fadeIn shrink-0 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="font-bold truncate max-w-[280px]">වැරදීමක්: {uploadError}</span>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="p-0.5 hover:bg-rose-100 rounded-full text-rose-500 ml-1 cursor-pointer font-black text-[10px]"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Prompt Input Form */}
          <form 
            id="clora-form" 
            onSubmit={handleSubmit} 
            className="relative flex flex-col bg-slate-100/50 sm:bg-slate-100 rounded-3xl sm:rounded-[28px] border-none sm:border sm:border-slate-200 focus-within:bg-white focus-within:shadow-lg focus-within:ring-1 focus-within:ring-slate-200 transition-all duration-300"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,image/*"
              className="hidden"
            />
            
            <div className="flex px-4 pt-3 pb-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask Clora... ප්‍රශ්නයක් හෝ විභාග වර්ෂය විමසන්න"
                className="flex-1 bg-transparent border-none text-[15px] sm:text-[15.5px] font-medium outline-none resize-none text-slate-800 placeholder:text-slate-500 leading-normal min-h-[44px] max-h-[200px] overflow-y-auto"
                disabled={isStreaming}
                aria-label="Ask Clora prompt"
                rows={1}
              />
            </div>
            
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1">
                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || uploading}
                  className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors rounded-full hover:bg-slate-200 shrink-0 cursor-pointer active:scale-95"
                  title="Upload PDF or Image"
                  aria-label="Upload PDF or Image"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>

                {/* Voice Tutor Microphone */}
                <button
                  type="button"
                  onClick={toggleVoiceTutor}
                  disabled={isStreaming}
                  className={`w-10 h-10 flex items-center justify-center transition-all duration-200 rounded-full shrink-0 cursor-pointer ${
                    isListening 
                      ? "bg-rose-100 text-rose-600 animate-pulse" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                  }`}
                  title="Speak with Voice Tutor"
                  aria-label="Speak with Voice Tutor"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* TTS Voice Feedback Control Toggle */}
                {isTtsAvailable && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeaking();
                      } else {
                        setIsVoiceFeedbackEnabled(!isVoiceFeedbackEnabled);
                      }
                    }}
                    className={`w-10 h-10 flex items-center justify-center transition-all duration-200 rounded-full shrink-0 cursor-pointer ${
                      isSpeaking 
                        ? "bg-amber-100 text-amber-600 animate-pulse" 
                        : isVoiceFeedbackEnabled 
                          ? "text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100" 
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    }`}
                    title={isSpeaking ? "Stop Speaking" : isVoiceFeedbackEnabled ? "Voice Output Active" : "Enable Voice Output"}
                    aria-label="Voice Output Control"
                  >
                    {isSpeaking ? (
                      <Volume2 className="w-5 h-5" />
                    ) : isVoiceFeedbackEnabled ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </button>
                )}
                
              </div>
              <div className="flex items-center pr-1">
                {isStreaming ? (
                  <button
                      type="button"
                      onClick={cancel}
                      className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
                      aria-label="Stop generation"
                  >
                      <Square className="w-4 h-4 fill-white" />
                  </button>
                ) : (
                  <button
                      type="submit"
                      disabled={!input.trim() || isStreaming || uploading}
                      className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full transition-all cursor-pointer disabled:cursor-not-allowed active:scale-95 disabled:active:scale-100 shrink-0"
                      aria-label="Send message"
                  >
                      <Send className="w-4 h-4 text-current ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </form>
          
          <p className="text-center text-[10px] text-slate-400 mt-2 font-semibold tracking-wide">
            Clora X can make mistakes. Verify important formulas & data.
          </p>
        </div>
      </div>
    </div>
  );
}
