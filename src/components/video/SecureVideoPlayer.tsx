import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
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

const pageDeviceId = crypto.randomUUID();
const playbackResumeByVideo = new Map<string, number>();

function getDeviceId() {
  return pageDeviceId;
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
  const autoRetryCountRef = useRef(0);
  const [status, setStatus] = useState("Preparing video…");
  const [error, setError] = useState<string | null>(null);
  const [watermark, setWatermark] = useState("");
  const [qualityOptions, setQualityOptions] = useState<number[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<"direct" | "hls">("direct");
  const [retryToken, setRetryToken] = useState(0);

  const retryPlayback = (automatic = false) => {
    if (!automatic) autoRetryCountRef.current = 0;
    setError(null);
    setStatus("Preparing video…");
    setQualityOptions([]);
    setSelectedQuality(0);
    setRetryToken((value) => value + 1);
  };

  useEffect(() => {
    let disposed = false;
    let heartbeat: number | undefined;
    let loadTimeout: number | undefined;
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

    const failOrRetry = (message: string) => {
      if (disposed) return;
      if (autoRetryCountRef.current < 1) {
        autoRetryCountRef.current += 1;
        window.setTimeout(() => retryPlayback(true), 450);
        return;
      }
      setStatus("");
      setError(message);
    };

    const handlePlayable = () => {
      if (loadTimeout) window.clearTimeout(loadTimeout);
      if (!disposed) {
        setStatus("Ready to play");
        setError(null);
      }
    };

    const handleMediaError = () => {
      const mediaError = video.error;
      const message = mediaError?.code === MediaError.MEDIA_ERR_NETWORK
        ? "The video connection timed out."
        : "The video could not be loaded.";
      failOrRetry(message);
    };

    const boot = async () => {
      try {
        endSession();
        plyrRef.current?.destroy();
        plyrRef.current = null;
        await shakaRef.current?.destroy?.();
        shakaRef.current = null;
        video.removeAttribute("src");
        video.load();

        const response = await apiFetch(`/api/videos/${videoId}/playback-session`, {
          method: "POST",
          headers: { "X-Device-ID": deviceId },
        });
        const session = await response.json().catch(() => null) as (SessionResponse & { message?: string; code?: string }) | null;
        if (!response.ok || !session?.ok) {
          throw new Error(session?.message || "You do not have permission to play this video.");
        }
        if (disposed) return;

        sessionIdRef.current = session.sessionId;
        setWatermark(session.watermark?.label || "");
        const mode = session.playbackMode === "hls" ? "hls" : "direct";
        setPlaybackMode(mode);

        if (mode === "direct") {
          if (!session.directUrl) throw new Error("The secure video source is unavailable.");
          video.src = session.directUrl;
          video.load();
        } else {
          if (!session.manifestUrl) throw new Error("The secure video source is unavailable.");
          shaka.polyfill.installAll();
          if (!shaka.Player.isBrowserSupported()) {
            throw new Error("This browser cannot play the secure stream.");
          }
          const engine = new shaka.Player();
          await engine.attach(video);
          shakaRef.current = engine;
          engine.getNetworkingEngine()?.registerRequestFilter((_type: unknown, request: any) => {
            request.allowCrossSiteCredentials = true;
          });
          engine.addEventListener("error", (event: any) => {
            failOrRetry(event?.detail?.message || "The secure video stream could not be loaded.");
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

        const resumeAt = playbackResumeByVideo.get(videoId) || 0;
        if (resumeAt > 5 && Number.isFinite(resumeAt)) video.currentTime = resumeAt;

        loadTimeout = window.setTimeout(() => {
          if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
            failOrRetry("The video connection timed out.");
          }
        }, 20_000);

        heartbeat = window.setInterval(() => {
          if (sessionIdRef.current) {
            void apiFetch(`/api/video-sessions/${sessionIdRef.current}/heartbeat`, {
              method: "POST",
              headers: { "X-Device-ID": deviceId },
            });
          }
        }, 45_000);
      } catch (caught: any) {
        failOrRetry(caught?.message || "The video could not be loaded.");
      }
    };

    const saveProgress = () => {
      if (Number.isFinite(video.currentTime)) {
        playbackResumeByVideo.set(videoId, video.currentTime);
      }
    };

    video.addEventListener("loadedmetadata", handlePlayable);
    video.addEventListener("canplay", handlePlayable);
    video.addEventListener("error", handleMediaError);
    video.addEventListener("pause", saveProgress);
    window.addEventListener("pagehide", endSession);
    void boot();

    return () => {
      disposed = true;
      if (heartbeat) window.clearInterval(heartbeat);
      if (loadTimeout) window.clearTimeout(loadTimeout);
      video.removeEventListener("loadedmetadata", handlePlayable);
      video.removeEventListener("canplay", handlePlayable);
      video.removeEventListener("error", handleMediaError);
      video.removeEventListener("pause", saveProgress);
      window.removeEventListener("pagehide", endSession);
      saveProgress();
      endSession();
      plyrRef.current?.destroy();
      void shakaRef.current?.destroy?.();
    };
  }, [videoId, retryToken]);

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`${title} video player`}>
      <div className="group relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl sm:rounded-[28px]">
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          playsInline
          preload="metadata"
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(event) => event.preventDefault()}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/65 to-transparent p-3 opacity-100 transition-opacity duration-300 sm:p-4 sm:group-hover:opacity-100">
          <p className="min-w-0 max-w-[65%] truncate text-xs font-semibold text-white/90 sm:text-sm">{title}</p>
          <div className="pointer-events-auto flex shrink-0 items-center gap-2">
            {playbackMode === "hls" && qualityOptions.length > 0 && (
              <label className="relative">
                <span className="sr-only">Video quality</span>
                <select
                  value={selectedQuality}
                  onChange={(event) => changeQuality(Number(event.target.value))}
                  className="h-10 appearance-none rounded-xl border border-white/20 bg-black/45 px-3 pr-8 text-xs font-semibold text-white outline-none backdrop-blur-md focus:border-white/50"
                >
                  <option value={0}>Auto quality</option>
                  {[...qualityOptions].reverse().map((height) => <option key={height} value={height}>{height}p</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-white/70">▾</span>
              </label>
            )}
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65" aria-label="Close video" title="Close video">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {watermark && <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-md bg-black/30 px-2 py-1 text-[9px] font-medium text-white/45">{watermark}</div>}

        {!error && status !== "Ready to play" && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/45">
            <div className="flex items-center gap-2 rounded-xl bg-black/45 px-4 py-3 text-sm font-semibold text-white backdrop-blur-md">
              <Loader2 className="h-4 w-4 animate-spin" /> {status}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/90 p-8 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-rose-200">{error}</p>
              <button type="button" onClick={() => retryPlayback(false)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-100">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
