import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Captions, Gauge, ListVideo, MessageCircleQuestion, ShieldCheck, X } from "lucide-react";
import Plyr from "plyr";
import shaka from "shaka-player";
import "plyr/dist/plyr.css";
import { apiFetch } from "../../lib/api";

type Chapter = { id?: string; title: string; startSeconds: number; endSeconds?: number };
type TranscriptCue = { startSeconds: number; endSeconds?: number; text: string };

type PlayerMetadata = {
  chapters?: Chapter[];
  transcriptCues?: TranscriptCue[];
  silenceIntervals?: Array<{ startSeconds: number; endSeconds: number }>;
};

type SessionResponse = {
  ok: true;
  sessionId: string;
  manifestUrl: string;
  expiresAt: string;
  watermark: { userId: string; label: string };
};

function getDeviceId() {
  const key = "clora_x_video_device_id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function SecureVideoPlayer({ videoId, title, onClose }: { videoId: string; title: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shakaRef = useRef<any>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const metadataRef = useRef<PlayerMetadata>({});
  const skipSilenceRef = useRef(false);
  const [metadata, setMetadata] = useState<PlayerMetadata>({});
  const [status, setStatus] = useState("Authorizing secure playback…");
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [skipSilence, setSkipSilence] = useState(false);
  const [watermark, setWatermark] = useState({ label: "", x: 12, y: 12 });
  const [currentTime, setCurrentTime] = useState(0);

  const activeCue = useMemo(
    () => metadata.transcriptCues?.find((cue) => currentTime >= cue.startSeconds && currentTime < (cue.endSeconds ?? cue.startSeconds + 8)),
    [metadata.transcriptCues, currentTime],
  );

  useEffect(() => { metadataRef.current = metadata; }, [metadata]);
  useEffect(() => { skipSilenceRef.current = skipSilence; }, [skipSilence]);

  useEffect(() => {
    let disposed = false;
    let heartbeat: number | undefined;
    let watermarkTimer: number | undefined;
    const video = videoRef.current;
    if (!video) return;

    const endSession = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void apiFetch(`/api/video-sessions/${sessionId}/end`, { method: "POST", keepalive: true });
      sessionIdRef.current = null;
    };

    const boot = async () => {
      try {
        const deviceId = getDeviceId();
        const [metaResponse, sessionResponse] = await Promise.all([
          apiFetch(`/api/videos/${videoId}`),
          apiFetch(`/api/videos/${videoId}/playback-session`, {
            method: "POST",
            headers: { "X-Device-ID": deviceId },
          }),
        ]);
        const session = await sessionResponse.json() as SessionResponse & { message?: string };
        if (!sessionResponse.ok || !session.ok) throw new Error(session.message || "Playback authorization failed");
        const metaPayload = await metaResponse.json().catch(() => ({}));
        if (!disposed) setMetadata(metaPayload?.video || {});

        sessionIdRef.current = session.sessionId;
        setWatermark((current) => ({ ...current, label: session.watermark.label }));
        shaka.polyfill.installAll();
        if (!shaka.Player.isBrowserSupported()) throw new Error("This browser does not support secure HLS playback.");

        const engine = new shaka.Player();
        await engine.attach(video);
        shakaRef.current = engine;
        engine.configure({
          abr: { enabled: true, defaultBandwidthEstimate: 1_500_000 },
          streaming: { bufferingGoal: 24, rebufferingGoal: 2 },
        });
        engine.getNetworkingEngine()?.registerRequestFilter((_type: unknown, request: any) => {
          request.allowCrossSiteCredentials = true;
        });
        await engine.load(session.manifestUrl);
        if (disposed) return;

        const heights = Array.from(new Set(
          engine.getVariantTracks().map((track: any) => Number(track.height || 0)).filter(Boolean),
        )).sort((a: number, b: number) => a - b);
        const player = new Plyr(video, {
          controls: ["play-large", "restart", "rewind", "play", "fast-forward", "progress", "current-time", "duration", "mute", "volume", "captions", "settings", "pip", "airplay", "fullscreen"],
          settings: ["captions", "quality", "speed"],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
          quality: {
            default: 0,
            options: [0, ...heights],
            forced: true,
            onChange: (height: number) => {
              if (height === 0) {
                engine.configure({ abr: { enabled: true } });
                return;
              }
              engine.configure({ abr: { enabled: false } });
              const tracks = engine.getVariantTracks().filter((track: any) => track.height === height);
              if (tracks[0]) engine.selectVariantTrack(tracks[0], true, 2);
            },
          },
          i18n: { qualityLabel: { 0: "Auto" } },
        });
        plyrRef.current = player;

        const resumeKey = `clora_video_resume_${videoId}`;
        const saved = Number(localStorage.getItem(resumeKey) || 0);
        if (saved > 5 && Number.isFinite(saved)) video.currentTime = saved;
        setStatus("Secure stream ready");

        heartbeat = window.setInterval(() => {
          if (sessionIdRef.current) {
            void apiFetch(`/api/video-sessions/${sessionIdRef.current}/heartbeat`, {
              method: "POST",
              headers: { "X-Device-ID": deviceId },
            });
          }
        }, 45_000);
        watermarkTimer = window.setInterval(() => {
          setWatermark((current) => ({ ...current, x: 8 + Math.round(Math.random() * 68), y: 8 + Math.round(Math.random() * 68) }));
        }, 12_000);
      } catch (caught: any) {
        if (!disposed) setError(caught?.message || "Video playback failed");
      }
    };

    const onTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      if (Math.floor(time) % 5 === 0) localStorage.setItem(`clora_video_resume_${videoId}`, String(time));
      if (skipSilenceRef.current) {
        const interval = metadataRef.current.silenceIntervals?.find((item) => time >= item.startSeconds && time < item.endSeconds);
        if (interval && interval.endSeconds - time > 0.35) video.currentTime = interval.endSeconds;
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    window.addEventListener("pagehide", endSession);
    void boot();

    return () => {
      disposed = true;
      if (heartbeat) window.clearInterval(heartbeat);
      if (watermarkTimer) window.clearInterval(watermarkTimer);
      video.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener("pagehide", endSession);
      endSession();
      plyrRef.current?.destroy();
      void shakaRef.current?.destroy();
    };
  }, [videoId]);

  const explainCurrentSection = () => {
    window.dispatchEvent(new CustomEvent("clora:explain-video-section", {
      detail: { videoId, title, timeSeconds: videoRef.current?.currentTime || 0, transcript: activeCue?.text || "" },
    }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`${title} video player`}>
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black sm:text-base">{title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> {status}</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-slate-300 transition hover:bg-white/20 hover:text-white" aria-label="Close video"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 overflow-y-auto bg-black">
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <video ref={videoRef} className="h-full w-full" playsInline crossOrigin="use-credentials" />
              {watermark.label && (
                <div className="pointer-events-none absolute z-20 select-none rounded-md bg-black/30 px-2 py-1 text-[10px] font-bold text-white/55 transition-all duration-1000" style={{ left: `${watermark.x}%`, top: `${watermark.y}%` }}>
                  {watermark.label} · {videoId.slice(0, 8)}
                </div>
              )}
              {error && <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-8 text-center text-sm font-bold text-rose-300">{error}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3">
              <button onClick={() => setSkipSilence((value) => !value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${skipSilence ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}><Gauge className="mr-1.5 inline h-3.5 w-3.5" /> Skip silence</button>
              <button onClick={() => setShowTranscript((value) => !value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${showTranscript ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}><Captions className="mr-1.5 inline h-3.5 w-3.5" /> Transcript</button>
              <button onClick={() => setShowChapters((value) => !value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${showChapters ? "bg-indigo-500 text-white" : "bg-white/10 text-slate-300"}`}><ListVideo className="mr-1.5 inline h-3.5 w-3.5" /> Chapters</button>
              <button onClick={explainCurrentSection} className="ml-auto rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300"><MessageCircleQuestion className="mr-1.5 inline h-3.5 w-3.5" /> මේ කොටස පැහැදිලි කරන්න</button>
            </div>

            {showTranscript && activeCue && <div className="border-t border-white/10 bg-slate-900 px-5 py-4 text-sm leading-7 text-slate-200"><BookOpen className="mr-2 inline h-4 w-4 text-indigo-300" /> {activeCue.text}</div>}
          </main>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-white/10 bg-slate-900/80 p-4 lg:block">
            <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Lesson chapters</h3>
            {metadata.chapters?.length ? metadata.chapters.map((chapter, index) => (
              <button key={chapter.id || `${chapter.startSeconds}-${index}`} onClick={() => { if (videoRef.current) videoRef.current.currentTime = chapter.startSeconds; }} className="mb-2 flex w-full items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-indigo-400/40 hover:bg-indigo-400/10">
                <span className="rounded-md bg-indigo-400/15 px-2 py-1 text-[10px] font-black text-indigo-300">{formatTime(chapter.startSeconds)}</span>
                <span className="text-xs font-bold leading-5 text-slate-200">{chapter.title}</span>
              </button>
            )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">Chapters and transcript appear automatically after video processing finishes.</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
