import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Loader2, X, Play } from 'lucide-react';
import { auth, storage } from '../../lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { apiUrl } from '../../lib/apiBase';
import { useAIWorkflowStream } from '../../hooks/useAIWorkflowStream';

interface LiveVoiceChatModalProps {

  isOpen: boolean;
  onClose: () => void;
  currentSubject?: string;
  activeSourceId?: string;
  recentAttachmentIds?: string[];
}

export function LiveVoiceChatModal({ isOpen, onClose, currentSubject, activeSourceId, recentAttachmentIds }: LiveVoiceChatModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'permission_denied' | 'ready'>('ready');
  const [transcript, setTranscript] = useState<{role: 'user' | 'assistant', text: string, sources?: any[]}[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopListening();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setTranscript([]);
      setStatus('ready');
    }
  }, [isOpen]);

  const startCall = () => {
    setStatus('idle');
    startListening();
  }

  const startListening = () => {
    if (status === 'permission_denied') return;

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'si-LK'; // Default to Sinhala for the target audience
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setStatus('listening');
    };

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      if (text.trim()) {
        handleUserUtterance(text);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setStatus('permission_denied');
        return;
      }
      if (event.error !== 'aborted' && (status as string) !== 'permission_denied') {
         setStatus('idle');
         setTimeout(() => {
           if (isOpen && !isMuted && (status as string) !== 'permission_denied') startListening();
         }, 1000);
      }
    };

    recognition.onend = () => {
      if (status === 'listening') {
         startListening();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    if ((status as string) !== 'permission_denied') setStatus('idle');
  };

  const handleUserUtterance = async (text: string) => {
    stopListening();
    setTranscript(prev => [...prev, { role: 'user', text }]);
    setStatus('processing');
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(apiUrl("/api/voice/live-turn"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          transcript: text,
          activeSubject: currentSubject,
          activeSourceId,
          recentAttachmentIds,
          usePdfContext: true
        })
      });

      if (!res.ok) throw new Error("Failed to get live turn");
      
      const data = await res.json();
      setTranscript(prev => [...prev, { role: 'assistant', text: data.answerText, sources: data.sources }]);
      setStatus('speaking');

      if (data.ttsAudioUrl || data.ttsStoragePath) {
        let audioUrl = data.ttsAudioUrl;
        if (!audioUrl && data.ttsStoragePath) {
           try {
             audioUrl = await getDownloadURL(ref(storage, data.ttsStoragePath));
           } catch (e) {
             console.error("Failed to get download URL", e);
             setStatus('idle');
             if (!isMuted && isOpen) startListening();
             return;
           }
        }
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play();
          audio.onended = () => {
             if ((status as string) !== 'permission_denied') setStatus('idle');
             if (!isMuted && isOpen) startListening();
          };
        }
      } else {
        if ((status as string) !== 'permission_denied') setStatus('idle');
        if (!isMuted && isOpen) startListening();
      }
    } catch (e) {
      setTranscript(prev => [...prev, { role: 'assistant', text: "Error connecting to AI." }]);
      if ((status as string) !== 'permission_denied') setStatus('idle');
      if (!isMuted && isOpen) startListening();
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      stopListening();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col h-[600px] max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-white">Live Voice Chat</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Transcript Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 no-scrollbar">
          {status === 'ready' && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
               <Phone className="w-10 h-10 text-indigo-500 opacity-80" />
               <p className="text-sm text-center max-w-xs">Start a live voice call with Clora X. You can ask questions about your PDFs or talk normally.</p>
               <button onClick={startCall} className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-md">
                 <Play className="w-4 h-4 fill-white" /> Start Call
               </button>
            </div>
          )}
          {status === 'permission_denied' && (
            <div className="flex-1 flex flex-col items-center justify-center text-rose-500 gap-3">
               <MicOff className="w-8 h-8 opacity-50" />
               <p className="text-sm text-center max-w-xs">Microphone access denied. Please allow microphone permissions in your browser settings to use live voice chat.</p>
            </div>
          )}
          
          {status !== 'ready' && (status as string) !== 'permission_denied' && transcript.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Mic className="w-8 h-8 opacity-50" />
              <p className="text-sm">Start speaking with Clora...</p>
            </div>
          ) : (
            transcript.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} flex-col gap-1`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${t.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none self-end' : 'bg-slate-800 text-slate-200 rounded-bl-none self-start'}`}>
                  {t.text}
                </div>
                {t.sources && t.sources.length > 0 && (
                  <div className="max-w-[80%] text-[10px] text-slate-400 self-start ml-2">
                    Used: {t.sources.map(s => `${s.title}${s.pageNumber ? ` (p.${s.pageNumber})` : ''}`).join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
          {status === 'processing' && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-slate-800/50 flex flex-col items-center gap-6">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            {status === 'ready' ? 'Ready to Call' : status === 'listening' ? 'Listening...' : status === 'speaking' ? 'Clora is speaking...' : status === 'processing' ? 'Processing...' : status === 'permission_denied' ? 'Permission Denied' : 'Ready'}
          </div>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={toggleMute}
              disabled={status === 'ready' || status === 'permission_denied'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isMuted ? 'bg-slate-700 text-slate-400' : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
              onClick={onClose}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
