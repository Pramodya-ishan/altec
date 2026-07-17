import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, X, Loader2, Sparkles, AlertCircle, Play } from 'lucide-react';
import { auth } from '../../../lib/firebase';
import { cn } from '../../../lib/utils';
import { GeminiLiveClient } from '../../../lib/geminiLiveClient';
import { PcmMicrophone } from '../../../lib/audio/PcmMicrophone';
import { PcmAudioPlayer } from '../../../lib/audio/PcmAudioPlayer';

interface RealtimeLiveCallPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubject?: string;
  activeSourceId?: string;
  recentAttachmentIds?: string[];
}

function normalizeLiveError(err: any) {
  const msg = String(err?.message || err || "");
  if (
    err?.name === "NotAllowedError" ||
    err?.name === "PermissionDeniedError" ||
    msg.includes("MIC_PERMISSION_DENIED") ||
    msg.toLowerCase().includes("permission denied")
  ) {
    return {
      code: "MIC_PERMISSION_DENIED",
      message: "Microphone permission blocked. Browser site settings වලින් Microphone → Allow කරන්න."
    };
  }
  if (msg.includes("PERMISSION_DENIED") || msg.includes("403")) {
    return {
      code: "GEMINI_PERMISSION_DENIED",
      message: "Gemini Live permission denied. IAM/API/model config check කරන්න."
    };
  }
  return { code: "LIVE_ERROR", message: msg || "Live voice failed." };
}

export function RealtimeLiveCallPanel({
  isOpen,
  onClose,
  currentSubject,
  activeSourceId,
  recentAttachmentIds
}: RealtimeLiveCallPanelProps) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "unavailable" | "error">("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const microphoneRef = useRef<PcmMicrophone | null>(null);
  const audioPlayerRef = useRef<PcmAudioPlayer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanupSession = () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      if (microphoneRef.current) {
        microphoneRef.current.stop();
        microphoneRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
        audioPlayerRef.current = null;
      }
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupSession();
      setStatus("disconnected");
      setErrorMsg("");
      setTranscript([]);
      setCurrentAssistantText("");
    }
    return () => {
      cleanupSession();
    };
  }, [isOpen]);

  const handleStartCall = async () => {
    cleanupSession();
    setStatus("connecting");
    setErrorMsg("");
    setTranscript([]);
    setCurrentAssistantText("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Check Server Realtime Status
      let statusResponse;
      try {
        statusResponse = await fetch("/api/realtime/status", {
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        throw new Error("SERVER_UNREACHABLE: server එක සම්බන්ධ කරගත නොහැක.");
      }

      const statusData = await statusResponse.json().catch(() => ({}));

      if (!statusResponse.ok || !statusData.enabled) {
        setStatus("unavailable");
        setErrorMsg(
          statusData.reason === "gemini_api_key_missing"
            ? "Gemini API key එක server එකට configure කරලා නැහැ. .env.example පරික්ෂා කරන්න."
            : "Gemini Live voice දැනට අක්‍රිය කරලා තියෙන්නේ."
        );
        return;
      }

      // 2. Request Mic access (Check and ask permission BEFORE token fetch)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr: any) {
        const normalized = normalizeLiveError(micErr);
        setStatus("error");
        setErrorMsg(normalized.message);
        return;
      }

      // 3. Authenticate and fetch token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("AUTH_REQUIRED: කරුණාකර පළමුව login වන්න.");
      }

      const firebaseToken = await user.getIdToken();

      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
      });

      const tokenData = await tokenResponse.json().catch(() => ({}));

      if (!tokenResponse.ok || tokenData.code === "GEMINI_LIVE_BRIDGE_NOT_IMPLEMENTED") {
        throw new Error(tokenData.message || "Gemini Live backend bridge not implemented.");
      }
      
      if (!tokenData.clientSecret && !tokenData.token) {
        throw new Error(tokenData.message || "Failed to get realtime session.");
      }

      // 4. Initialize Hardware and Client
      const audioPlayer = new PcmAudioPlayer(24000);
      audioPlayer.init();
      audioPlayerRef.current = audioPlayer;

      const microphone = new PcmMicrophone();
      microphoneRef.current = microphone;

      const client = new GeminiLiveClient();
      clientRef.current = client;

      await client.connect({
        token: tokenData.token,
        model: tokenData.model,
        systemInstruction: `
You are the Sinhala-first Tec A/L live voice tutor for Sri Lankan G.C.E. A/L Technology students.

Rules:
- Speak naturally and helpfully in Sinhala (mixed with English tech terms).
- Keep voice replies short and interruptible.
- Answer the learner's actual question directly.
- Do not force a fixed eight-section response structure.
- Do not fabricate marks, progress, rank, Z-score or PDF evidence.
- Use short step-by-step explanations only when needed.
- Do not repeatedly call the learner "මල්ලි".
        `.trim(),
        callbacks: {
          onOpen() {
            setStatus("connected");
            try {
              microphone.start((base64Pcm) => {
                clientRef.current?.sendAudioChunk(base64Pcm, 16000);
              });
            } catch (micStartErr: any) {
              const normalized = normalizeLiveError(micStartErr);
              setStatus("error");
              setErrorMsg(normalized.message);
              cleanupSession();
            }
          },
          onInputTranscript(text) {
            setTranscript((previous) => [
              ...previous,
              { role: "user", text },
            ]);
          },
          onOutputTranscript(text) {
            setCurrentAssistantText((previous) => previous + text);
          },
          onAudioChunk(base64Audio) {
            try {
              audioPlayerRef.current?.enqueue(base64Audio);
            } catch (audioErr) {
              console.warn("Audio enqueue issue:", audioErr);
            }
          },
          onInterrupted() {
            try {
              audioPlayerRef.current?.stop();
              audioPlayerRef.current?.init(); // Re-init audio context safely
              setCurrentAssistantText("");
            } catch (e) {
              console.warn("Interrupted re-init issue:", e);
            }
          },
          onTurnComplete() {
            setCurrentAssistantText((currentText) => {
              const completed = currentText.trim();
              if (completed) {
                setTranscript((previous) => [
                  ...previous,
                  { role: "assistant", text: completed },
                ]);
              }
              return "";
            });
          },
          onError(error) {
            const normalized = normalizeLiveError(error);
            setStatus("error");
            setErrorMsg(normalized.message);
            cleanupSession();
          },
          onClose() {
            setStatus("disconnected");
            cleanupSession();
          },
        },
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const normalized = normalizeLiveError(err);
      setStatus("error");
      setErrorMsg(normalized.message);
      cleanupSession();
    }
  };

  const toggleMute = () => {
    if (!microphoneRef.current) return;
    if (isMuted) {
      microphoneRef.current.unmute();
      setIsMuted(false);
    } else {
      microphoneRef.current.mute();
      setIsMuted(true);
    }
  };

  const endCall = () => {
    cleanupSession();
    setStatus("disconnected");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50/95 backdrop-blur-md flex flex-col items-center justify-center font-sans text-slate-800">
      <div className="absolute top-6 right-6">
        <button onClick={endCall} className="p-3 bg-slate-200/60 hover:bg-slate-200 rounded-full transition-colors active:scale-95 cursor-pointer">
          <X className="w-6 h-6 text-slate-600" />
        </button>
      </div>

      <div className="w-full max-w-xl px-6 flex flex-col items-center">
        {/* Disconnected State (Pristine White Launcher Card) */}
        {status === "disconnected" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-center w-full flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">සජීවී කටහඬ සාකච්ඡාව</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Tec A/L සමඟ කටහඬින් සාකච්ඡා කරන්න. පාඩම් කරුණු, ගණනය කිරීම් සහ ගැටළු සෘජුවම විමසන්න.
              </p>
            </div>
            <button
              onClick={handleStartCall}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-base"
            >
              <Play className="w-5 h-5 fill-current" />
              සාකච්ඡාව අරඹන්න
            </button>
          </motion.div>
        )}

        {/* Connecting State */}
        {status === "connecting" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-10 shadow-xl border border-slate-200/80 text-center w-full flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
            <p className="text-lg font-semibold tracking-tight text-slate-700">සජීවී කටහඬ සේවාවට සම්බන්ධ වෙමින්…</p>
            <p className="text-xs text-slate-400">මයික්‍රෆෝනය සහ සේවාදායක සම්බන්ධතාවය තහවුරු කරමින් පවතී</p>
          </motion.div>
        )}

        {/* Unavailable State */}
        {status === "unavailable" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-center w-full flex flex-col items-center gap-6">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 border border-amber-100">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">සම්බන්ධ විය නොහැක</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={handleStartCall} className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition-all cursor-pointer text-sm border border-indigo-100">
                නැවත උත්සාහ කරන්න
              </button>
              <button onClick={endCall} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all cursor-pointer text-sm">
                වසන්න
              </button>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {status === "error" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-center w-full flex flex-col items-center gap-6">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-red-500 border border-red-100">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">දෝෂයක් ඇති වුණා</h3>
              <p className="text-sm text-red-600 mt-2 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={handleStartCall} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all cursor-pointer text-sm shadow-md">
                නැවත උත්සාහ කරන්න
              </button>
              <button onClick={endCall} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all cursor-pointer text-sm">
                වසන්න
              </button>
            </div>
          </motion.div>
        )}

        {/* Connected State (White/Light Theme Orb & Chat Overlay) */}
        {status === "connected" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-between w-full min-h-[500px] bg-white rounded-3xl p-8 shadow-2xl border border-slate-200/80">
            {/* Top Status */}
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold tracking-wide">සජීවී සේවාව සම්බන්ධයි</span>
              {activeSourceId && <span className="ml-2 px-2 py-0.5 bg-indigo-500/10 text-indigo-700 text-[10px] font-extrabold rounded-md border border-indigo-100">මූලාශ්‍රය සම්බන්ධයි</span>}
            </div>

            {/* Center Orb (Visualizer Placeholder) */}
            <div className="flex-1 flex flex-col items-center justify-center relative w-full my-8 min-h-[220px]">
              <div className={cn("w-40 h-40 rounded-full blur-2xl transition-all duration-1000", isMuted ? "bg-red-500/10" : "bg-indigo-500/15 scale-110")}></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={cn("w-28 h-28 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50/50 backdrop-blur-xl transition-all duration-300 shadow-inner", isMuted && "border-red-200 bg-red-50/30")}>
                  {isMuted ? <MicOff className="w-10 h-10 text-red-500" /> : <Mic className="w-10 h-10 text-indigo-600 animate-pulse" />}
                </div>
              </div>
              
              {/* Live Transcript / Response */}
              <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden flex flex-col justify-end text-center pointer-events-none">
                 {transcript.slice(-1).map((t, i) => (
                    <p key={i} className="text-sm text-slate-400 font-medium transition-all">{t.text}</p>
                 ))}
                 {currentAssistantText && (
                    <p className="text-base font-bold text-slate-800 tracking-wide mt-2">{currentAssistantText}</p>
                 )}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center gap-4 mt-auto w-full">
              <button
                onClick={toggleMute}
                className={cn("p-4 rounded-2xl transition-all duration-300 border cursor-pointer active:scale-95 flex-1 flex items-center justify-center gap-2", 
                  isMuted 
                    ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100/50" 
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                {isMuted ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    <span className="text-sm font-bold">Unmute Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span className="text-sm font-bold">Mute Mic</span>
                  </>
                )}
              </button>
              <button
                onClick={endCall}
                className="py-4 rounded-2xl bg-red-600 hover:bg-red-700 transition-colors text-white font-bold text-sm tracking-wider cursor-pointer active:scale-95 shadow-md flex-1 text-center"
              >
                End Call
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
