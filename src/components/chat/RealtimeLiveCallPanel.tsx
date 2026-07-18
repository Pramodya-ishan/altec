import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { RealtimeVoiceClient } from '../../lib/realtimeVoiceClient';
import { cn } from '../../lib/utils';
import { apiFetch } from "../../lib/api";

interface RealtimeLiveCallPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubject?: string;
  activeSourceId?: string;
  recentAttachmentIds?: string[];
}

export function RealtimeLiveCallPanel({
  isOpen,
  onClose,
  currentSubject,
  activeSourceId,
  recentAttachmentIds
}: RealtimeLiveCallPanelProps) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  
  const clientRef = useRef<RealtimeVoiceClient | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const startCall = async () => {
      setStatus("connecting");
      setErrorMsg("");
      setTranscript([]);
      setCurrentSources([]);

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await apiFetch("/api/realtime/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ activeSubject: currentSubject, activeSourceId })
        });
        const data = await res.json();
        
        if (!data.ok) {
           throw new Error(data.message || data.error || "Failed to create session");
        }

        const client = new RealtimeVoiceClient();
        clientRef.current = client;

        client.on("connected", () => {
          setStatus("connected");
        });
        
        client.on("disconnected", () => {
          setStatus("disconnected");
        });

        client.on("error", (err: any) => {
          setStatus("error");
          setErrorMsg(err.message || "Connection error");
        });

        client.on("transcript_delta", (data: any) => {
           setCurrentAssistantText(prev => prev + data.text);
        });

        client.on("transcript_final", (data: any) => {
           setTranscript(prev => [...prev, { role: "user", text: data.text }]);
        });

        client.on("response_done", (msg: any) => {
           setCurrentAssistantText(prev => { if (prev.trim()) { setTranscript(t => [...t, { role: "assistant", text: prev }]); } return ""; });
        });

        client.on("tool_call", async (data: any) => {
           try {
              const toolRes = await apiFetch("/api/realtime/tool-result", {
                 method: "POST",
                 headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                 },
                 body: JSON.stringify({
                    toolName: data.name,
                    arguments: JSON.parse(data.arguments || "{}"),
                    chatId: "live",
                    activeSubject: currentSubject,
                    activeSourceId,
                    recentAttachmentIds
                 })
              });
              const toolData = await toolRes.json();
              
              if (toolData.ok && toolData.output.sources && toolData.output.sources.length > 0) {
                 setCurrentSources(toolData.output.sources);
              }
              
              client.sendToolResult(data.callId, toolData.output);
           } catch(e: any) {
              client.sendToolResult(data.callId, { ok: false, error: e.message });
           }
        });

        await client.connect({
          clientSecret: data.clientSecret,
          chatId: "live",
          activeSubject: currentSubject,
          activeSourceId
        });
        
      } catch (err: any) {
        console.error("Live voice error:", err);
        setStatus("error");
        setErrorMsg(err.message);
      }
    };

    startCall();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [isOpen]);

  const toggleMute = () => {
    if (!clientRef.current) return;
    if (isMuted) {
      clientRef.current.unmute();
      setIsMuted(false);
    } else {
      clientRef.current.mute();
      setIsMuted(true);
    }
  };

  const endCall = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center font-sans text-white">
      <div className="absolute top-6 right-6">
        <button type="button" onClick={endCall} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      {status === "connecting" && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-white/50" />
          <p className="text-xl font-medium tracking-tight text-white/70">Connecting to Realtime Session...</p>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-xl font-medium text-white">{errorMsg}</p>
          <button type="button" onClick={endCall} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full">Close</button>
        </motion.div>
      )}

      {status === "connected" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-between w-full h-full max-w-2xl py-12 px-6">
          {/* Top Status */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium tracking-wide">AI Connected</span>
            {activeSourceId && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-md">PDF Linked</span>}
          </div>

          {/* Center Orb (Visualizer Placeholder) */}
          <div className="flex-1 flex items-center justify-center relative w-full">
            <div className={cn("w-48 h-48 rounded-full blur-3xl transition-all duration-1000", isMuted ? "bg-red-500/20" : "bg-white/20 scale-110")}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("w-32 h-32 rounded-full border border-white/20 flex items-center justify-center bg-black/50 backdrop-blur-xl transition-colors", isMuted && "border-red-500/30")}>
                {isMuted ? <MicOff className="w-12 h-12 text-white/50" /> : <Mic className="w-12 h-12 text-white/80" />}
              </div>
            </div>
            
            {/* Live Transcript / Response */}
            <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden flex flex-col justify-end text-center pointer-events-none fade-out-top">
               {transcript.slice(-2).map((t, i) => (
                  <p key={i} className={cn("text-lg opacity-50 transition-all", t.role === 'assistant' ? 'text-blue-200' : 'text-white')}>{t.text}</p>
               ))}
               {currentAssistantText && (
                  <p className="text-xl font-medium text-white tracking-wide mt-2">{currentAssistantText}</p>
               )}
            </div>
          </div>

          {/* Sources Panel */}
          <AnimatePresence>
             {currentSources.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full mb-8 bg-white/5 border border-white/10 rounded-2xl p-4">
                   <p className="text-xs text-white/50 uppercase tracking-widest mb-2 font-semibold">Evidence Used</p>
                   <div className="flex flex-col gap-2">
                      {currentSources.map((s, i) => (
                         <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                            {s.title} {s.pageNumber ? `(Page ${s.pageNumber})` : ''}
                         </div>
                      ))}
                   </div>
                </motion.div>
             )}
          </AnimatePresence>

          {/* Bottom Controls */}
          <div className="flex items-center gap-6 mt-auto">
            <button type="button"
              onClick={toggleMute}
              className={cn("p-6 rounded-full transition-all duration-300", isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20")}
            >
              {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
            <button type="button"
              onClick={endCall}
              className="px-8 py-5 rounded-full bg-red-600 hover:bg-red-500 transition-colors text-white font-medium text-lg tracking-wide"
            >
              End Call
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
