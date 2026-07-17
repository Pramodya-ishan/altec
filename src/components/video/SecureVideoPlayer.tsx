import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import Plyr from "plyr";
import shaka from "shaka-player";
import "plyr/dist/plyr.css";
import { apiFetch } from "../../lib/api";

type SessionResponse = {
  ok: true;
  sessionId: string;
  playbackMode?: "direct" | "hls";
  directUrl?: string;
  manifestUrl?: string;
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

interface SecureVideoPlayerProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

export function SecureVideoPlayer({ videoId, title, onClose }: SecureVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shakaRef = useRef<any>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState("වීඩියෝව සූදානම් කරමින්…");
  const [error, setError] = useState<string | null>(null);
  const [watermark, setWatermark] = useState("");
  const [qualityOptions, setQualityOptions] = useState<number[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<"direct" | "hls">("direct");

  useEffect(() => {
    let disposed = false;
    let heartbeat: number | undefined;
    const deviceId = getDeviceId();
    const video = videoRef.current;
    if (!video) return;

    const endSession = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      void apiFetch(`/api/video-sessions/${sessionId}/end`, {
        method: "POST",
        keepalive: true,
        headers: { "X-Device-ID": deviceId },
      });
      sessionIdRef.current = null;
    };

    const boot = async () => {
      try {
        const response = await apiFetch(`/api/videos/${videoId}/playback-session`, {
          method: "POST",
          headers: { "X-Device-ID": deviceId },
        });
        const session = await response.json() as SessionResponse & { message?: string };
        if (!response.ok || !session.ok) throw new Error(session.message || "වීඩියෝව නැරඹීමට අවසර ලැබුණේ නැහැ");
        if (disposed) return;

        sessionIdRef.current = session.sessionId;
        setWatermark(session.watermark?.label || "");
        const mode = session.playbackMode === "hls" ? "hls" : "direct";
        setPlaybackMode(mode);

        if (mode === "direct" && session.directUrl) {
          video.src = session.directUrl;
          video.load();
        } else {
          if (!session.manifestUrl) throw new Error("ආරක්ෂිත වීඩියෝ මූලාශ්‍රය ලබාගත නොහැක.");
          shaka.polyfill.installAll();
          if (!shaka.Player.isBrowserSupported()) throw new Error("මෙම browser එකෙන් ආරක්ෂිත stream එක play කළ නොහැක.");
          const engine = new shaka.Player();
          await engine.attach(video);
          shakaRef.current = engine;
          engine.getNetworkingEngine()?.registerRequestFilter((_type: unknown, request: any) => {
            // The CDN authorization token is an HttpOnly SameSite=None cookie.
            // Shaka must explicitly include credentials on manifest and segment requests.
            request.allowCrossSiteCredentials = true;
          });
          engine.addEventListener("error", (event: any) => {
            if (!disposed) setError(event?.detail?.message || "ආරක්ෂිත වීඩියෝ stream එක load කිරීමට නොහැකි වුණා");
          });
          engine.configure({
            abr: { enabled: true, defaultBandwidthEstimate: 1_500_000 },
            streaming: { bufferingGoal: 24, rebufferingGoal: 2 },
          });
          await engine.load(session.manifestUrl);
          const heights = Array.from(new Set<number>(
            engine.getVariantTracks().map((track: any) => Number(track.height || 0)).filter(Boolean),
          )).sort((left, right) => left - right);
          setQualityOptions(heights);
        }

        if (disposed) return;
        plyrRef.current = new Plyr(video, {
          controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "settings", "fullscreen"],
          settings: ["speed"],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        });

        const resumeAt = Number(localStorage.getItem(`clora_video_resume_${videoId}`) || 0);
        if (resumeAt > 5 && Number.isFinite(resumeAt)) video.currentTime = resumeAt;
        setStatus("නැරඹීමට සූදානම්");

        heartbeat = window.setInterval(() => {
          if (sessionIdRef.current) {
            void apiFetch(`/api/video-sessions/${sessionIdRef.current}/heartbeat`, {
              method: "POST",
              headers: { "X-Device-ID": deviceId },
            });
          }
        }, 45_000);
      } catch (caught: any) {
        if (!disposed) setError(caught?.message || "වීඩියෝව play කිරීමට නොහැකි විය");
      }
    };

    const saveProgress = () => {
      if (Number.isFinite(video.currentTime)) {
        localStorage.setItem(`clora_video_resume_${videoId}`, String(video.currentTime));
      }
    };
    video.addEventListener("pause", saveProgress);
    window.addEventListener("pagehide", endSession);
    void boot();

    return () => {
      disposed = true;
      if (heartbeat) window.clearInterval(heartbeat);
      video.removeEventListener("pause", saveProgress);
      window.removeEventListener("pagehide", endSession);
      saveProgress();
      endSession();
      plyrRef.current?.destroy();
      void shakaRef.current?.destroy();
    };
  }, [videoId]);

  const changeQuality = (height: number) => {
    setSelectedQuality(height);
    const engine = shakaRef.current;
    if (!engine) return;
    if (height === 0) {
      engine.configure({ abr: { enabled: true } });
      return;
    }
    engine.configure({ abr: { enabled: false } });
    const track = engine.getVariantTracks().find((candidate: any) => Number(candidate.height) === height);
    if (track) engine.selectVariantTrack(track, true, 2);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`${title} වීඩියෝ වාදකය`}>
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 sm:text-base">{title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              {error ? null : status === "නැරඹීමට සූදානම්" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {error || status}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="relative">
                <span className="sr-only">වීඩියෝ ගුණාත්මකභාවය</span>
                <select value={selectedQuality} disabled={playbackMode !== "hls" || qualityOptions.length === 0} onChange={(event) => changeQuality(Number(event.target.value))} className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-slate-400 disabled:cursor-default disabled:text-slate-500">
                  <option value={0}>{playbackMode === "hls" && qualityOptions.length > 0 ? "ස්වයංක්‍රීය quality" : "මුල් quality"}</option>
                  {[...qualityOptions].reverse().map((height) => <option key={height} value={height}>{height}p</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">▾</span>
              </label>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="වීඩියෝව වසන්න"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="h-full w-full"
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={(event) => event.preventDefault()}
          />
          {watermark && <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/30 px-2 py-1 text-[9px] font-medium text-white/45">{watermark}</div>}
          {error && <div className="absolute inset-0 grid place-items-center bg-slate-950 p-8 text-center text-sm font-semibold text-rose-300">{error}</div>}
        </div>
      </div>
    </div>
  );
}
