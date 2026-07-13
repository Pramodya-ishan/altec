import crypto from "node:crypto";
import { getAppCheck } from "firebase-admin/app-check";
import type { Request } from "express";
import { env } from "../utils/env";
import {
  getAdminApp,
  getAdminBucketByName,
  getAdminDb,
  getGoogleAccessToken,
} from "../firebase/admin";

export type VideoStatus =
  | "draft"
  | "uploading"
  | "uploaded"
  | "queued"
  | "transcoding"
  | "transcribing"
  | "indexing"
  | "ready"
  | "failed"
  | "unpublished"
  | "archived";

export type VideoDocument = {
  id: string;
  sourceId: string;
  title: string;
  description?: string;
  subject?: string;
  lesson?: string;
  concept?: string;
  status: VideoStatus;
  visibility: "private" | "class" | "institution" | "public";
  allowedRoles: string[];
  allowedUserIds: string[];
  inputBucket: string;
  inputObjectPath: string;
  hlsPrefix: string;
  masterManifestPath: string;
  sourceSizeBytes: number;
  sourceWidth?: number;
  sourceHeight?: number;
  durationMs?: number;
  mimeType: string;
  transcoderJobName?: string;
  transcoderErrorCode?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  allowPlayback: boolean;
  watermarkEnabled: boolean;
  maxConcurrentSessions: number;
  qualityProfiles: string[];
  version: number;
};

const QUALITY_LADDER = [
  { key: "144p", width: 256, height: 144, bitrate: 180_000 },
  { key: "240p", width: 426, height: 240, bitrate: 300_000 },
  { key: "360p", width: 640, height: 360, bitrate: 700_000 },
  { key: "480p", width: 854, height: 480, bitrate: 1_200_000 },
  { key: "720p", width: 1280, height: 720, bitrate: 2_500_000 },
  { key: "1080p", width: 1920, height: 1080, bitrate: 5_000_000 },
  { key: "1440p", width: 2560, height: 1440, bitrate: 9_000_000 },
  { key: "2160p", width: 3840, height: 2160, bitrate: 16_000_000 },
] as const;

export function safeVideoFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").slice(0, 120);
}

export async function verifyVideoAppCheck(req: Request) {
  if (!env.VIDEO_REQUIRE_APP_CHECK) return;
  const token = req.header("X-Firebase-AppCheck");
  if (!token) throw new Error("APP_CHECK_REQUIRED");
  const app = getAdminApp();
  if (!app) throw new Error("APP_CHECK_UNAVAILABLE");
  await getAppCheck(app).verifyToken(token);
}

export async function validateUploadedVideo(video: VideoDocument) {
  const bucket = getAdminBucketByName(video.inputBucket);
  const file = bucket.file(video.inputObjectPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("VIDEO_SOURCE_MISSING");

  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size || 0);
  const maxBytes = env.VIDEO_UPLOAD_MAX_MB * 1024 * 1024;
  if (size <= 0 || size > maxBytes) throw new Error("VIDEO_SIZE_INVALID");

  const [head] = await file.download({ start: 0, end: 15 });
  const isIsoMedia = head.length >= 12 && head.subarray(4, 8).toString("ascii") === "ftyp";
  const isWebm = head.length >= 4 && head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!isIsoMedia && !isWebm) throw new Error("VIDEO_CONTAINER_UNSUPPORTED");

  return {
    sizeBytes: size,
    generation: metadata.generation,
    contentType: metadata.contentType || video.mimeType,
  };
}

function selectQualityProfiles(video: VideoDocument) {
  const height = video.sourceHeight || 720;
  const requested = new Set(video.qualityProfiles?.length
    ? video.qualityProfiles
    : ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p"]);
  return QUALITY_LADDER.filter((quality) => {
    if (!requested.has(quality.key)) return false;
    if (quality.height > height) return false;
    if (quality.key === "2160p" && !env.ENABLE_4K) return false;
    return true;
  });
}

export async function startTranscode(video: VideoDocument) {
  if (!env.ENABLE_VIDEO_TRANSCODING) {
    return { enabled: false, jobName: null };
  }

  const qualities = selectQualityProfiles(video);
  if (qualities.length === 0) throw new Error("VIDEO_NO_VALID_RENDITIONS");

  const audioKey = "audio-main";
  const elementaryStreams: any[] = qualities.map((quality) => ({
    key: `video-${quality.key}`,
    videoStream: {
      h264: {
        widthPixels: quality.width,
        heightPixels: quality.height,
        bitrateBps: quality.bitrate,
        frameRate: 30,
        pixelFormat: "yuv420p",
        rateControlMode: "vbr",
      },
    },
  }));
  elementaryStreams.push({
    key: audioKey,
    audioStream: { codec: "aac", bitrateBps: 128_000, channelCount: 2, channelLayout: ["fl", "fr"] },
  });

  const muxStreams = qualities.map((quality) => ({
    key: `hls-${quality.key}`,
    container: "ts",
    elementaryStreams: [`video-${quality.key}`, audioKey],
    segmentSettings: { segmentDuration: "6s" },
  }));

  const project = env.GOOGLE_CLOUD_PROJECT;
  const location = env.VIDEO_TRANSCODER_LOCATION;
  const endpoint = `https://transcoder.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/jobs`;
  const token = await getGoogleAccessToken();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputUri: `gs://${video.inputBucket}/${video.inputObjectPath}`,
      outputUri: `gs://${env.VIDEO_OUTPUT_BUCKET}/${video.hlsPrefix}`,
      config: {
        elementaryStreams,
        muxStreams,
        manifests: [{
          fileName: "master.m3u8",
          type: "HLS",
          muxStreams: muxStreams.map((stream) => stream.key),
        }],
      },
      labels: { video_id: video.id, source_id: video.sourceId, version: String(video.version) },
    }),
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || !payload?.name) {
    throw new Error(payload?.error?.message || `TRANSCODER_CREATE_FAILED_${response.status}`);
  }
  return { enabled: true, jobName: payload.name as string };
}

export async function refreshTranscodeStatus(video: VideoDocument): Promise<VideoDocument> {
  if (!video.transcoderJobName || !["queued", "transcoding"].includes(video.status)) return video;
  const token = await getGoogleAccessToken();
  const response = await fetch(`https://transcoder.googleapis.com/v1/${video.transcoderJobName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return video;
  const job = await response.json() as any;
  const state = String(job.state || "").toUpperCase();
  let status: VideoStatus = video.status;
  if (state === "RUNNING") status = "transcoding";
  if (state === "SUCCEEDED") status = "ready";
  if (state === "FAILED") status = "failed";
  if (status === video.status) return video;

  const updates = {
    status,
    allowPlayback: status === "ready" ? video.allowPlayback : false,
    transcoderErrorCode: job.error?.code ? String(job.error.code) : undefined,
    updatedAt: new Date().toISOString(),
  };
  await getAdminDb().collection("videos").doc(video.id).set(updates, { merge: true });
  await getAdminDb().collection("sources").doc(video.sourceId).set({
    processingStatus: status === "ready" ? "ready" : status,
    lastErrorCode: updates.transcoderErrorCode || null,
    updatedAt: updates.updatedAt,
  }, { merge: true });
  return { ...video, ...updates };
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeSigningKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + padding, "base64");
}

export function createSignedPlaybackCookie(video: VideoDocument) {
  if (!env.VIDEO_CDN_BASE_URL || !env.VIDEO_CDN_KEY_NAME || !env.VIDEO_CDN_SIGNING_KEY) {
    throw new Error("VIDEO_CDN_NOT_CONFIGURED");
  }
  const prefix = `${env.VIDEO_CDN_BASE_URL}/videos/${video.id}/versions/${video.version}/hls/`;
  const expires = Math.floor(Date.now() / 1000) + env.VIDEO_COOKIE_TTL_SECONDS;
  const policy = `URLPrefix=${base64Url(prefix)}:Expires=${expires}:KeyName=${env.VIDEO_CDN_KEY_NAME}`;
  const signature = crypto.createHmac("sha1", decodeSigningKey(env.VIDEO_CDN_SIGNING_KEY)).update(policy).digest();
  return {
    cookieValue: `${policy}:Signature=${base64Url(signature)}`,
    manifestUrl: `${prefix}master.m3u8`,
    path: `/videos/${video.id}/versions/${video.version}/hls/`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function canUserPlayVideo(video: VideoDocument, user: { uid: string; admin?: boolean; roles?: string[] }) {
  if (user.admin) return true;
  if (!video.isPublished || !video.allowPlayback || video.status !== "ready") return false;
  if (video.allowedUserIds?.includes(user.uid)) return true;
  if (video.allowedRoles?.some((role) => user.roles?.includes(role))) return true;
  if (video.visibility === "public") return true;
  return ["class", "institution"].includes(video.visibility)
    && !video.allowedUserIds?.length
    && !video.allowedRoles?.length;
}
