import crypto from "node:crypto";
import express from "express";
import { env } from "../utils/env";
import {
  getAdminBucketByName,
  getAdminDb,
  requireAdmin,
  requireUser,
} from "../firebase/admin";
import {
  canUserPlayVideo,
  createSignedPlaybackCookie,
  hashPlaybackToken,
  playbackTokenMatches,
  refreshTranscodeStatus,
  resolveVideoByteRange,
  safeVideoFileName,
  startTranscode,
  validateUploadedVideo,
  verifyVideoAppCheck,
  type VideoDocument,
} from "./videoService";
import { removeUndefinedDeep } from "../ai-core/memory/chatSanitizer";

export const videoRoutes = express.Router();

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "application/octet-stream"]);

function publicVideo(video: VideoDocument) {
  const { inputBucket, inputObjectPath, transcoderJobName, ...safe } = video;
  return safe;
}

async function loadVideo(videoId: string) {
  const snapshot = await getAdminDb().collection("videos").doc(videoId).get();
  if (!snapshot.exists) throw new Error("VIDEO_NOT_FOUND");
  return { id: snapshot.id, ...snapshot.data() } as VideoDocument;
}

function requireVideoEnabled() {
  if (!env.ENABLE_VIDEO) throw new Error("VIDEO_FEATURE_DISABLED");
}

videoRoutes.use((_req, res, next) => {
  if (!env.ENABLE_VIDEO) return res.status(404).json({ ok: false, code: "VIDEO_FEATURE_DISABLED" });
  next();
});

videoRoutes.post("/admin/videos", async (req, res) => {
  try {
    requireVideoEnabled();
    await verifyVideoAppCheck(req);
    const admin = await requireAdmin(req);
    const {
      title,
      description,
      subject,
      lesson,
      concept,
      visibility = "private",
      originalFileName,
      mimeType,
      sizeBytes,
      width,
      height,
      durationMs,
      qualityProfiles,
    } = req.body || {};
    if (!title || !originalFileName || !mimeType || !Number.isFinite(Number(sizeBytes))) {
      return res.status(400).json({ ok: false, code: "VIDEO_METADATA_INVALID", message: "Missing video metadata." });
    }
    if (!VIDEO_MIME_TYPES.has(mimeType)) {
      return res.status(415).json({ ok: false, code: "VIDEO_MIME_UNSUPPORTED", message: "Use MP4, MOV, or WebM video." });
    }
    if (Number(sizeBytes) > env.VIDEO_UPLOAD_MAX_MB * 1024 * 1024) {
      return res.status(413).json({ ok: false, code: "VIDEO_TOO_LARGE", message: `Maximum video size is ${env.VIDEO_UPLOAD_MAX_MB} MB.` });
    }

    const db = getAdminDb();
    const videoRef = db.collection("videos").doc();
    const sourceRef = db.collection("sources").doc();
    const version = 1;
    const inputObjectPath = `videos/${videoRef.id}/versions/${version}/source/${safeVideoFileName(originalFileName)}`;
    const hlsPrefix = `videos/${videoRef.id}/versions/${version}/hls/`;
    const now = new Date().toISOString();
    const selectedQualities = Array.isArray(qualityProfiles) && qualityProfiles.length
      ? qualityProfiles.map(String)
      : ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p"];

    const video: VideoDocument = {
      id: videoRef.id,
      sourceId: sourceRef.id,
      title: String(title).trim().slice(0, 180),
      description: description ? String(description).trim().slice(0, 2000) : undefined,
      subject: subject ? String(subject).toUpperCase().slice(0, 20) : undefined,
      lesson: lesson ? String(lesson).slice(0, 180) : undefined,
      concept: concept ? String(concept).slice(0, 180) : undefined,
      status: "draft",
      visibility: ["private", "class", "institution", "public"].includes(visibility) ? visibility : "private",
      allowedRoles: [],
      allowedUserIds: [],
      inputBucket: env.VIDEO_INPUT_BUCKET,
      inputObjectPath,
      hlsPrefix,
      masterManifestPath: `${hlsPrefix}master.m3u8`,
      sourceSizeBytes: Number(sizeBytes),
      sourceWidth: Number(width) || undefined,
      sourceHeight: Number(height) || undefined,
      durationMs: Number(durationMs) || undefined,
      mimeType,
      createdBy: admin.uid,
      createdAt: now,
      updatedAt: now,
      isPublished: false,
      allowPlayback: false,
      watermarkEnabled: true,
      maxConcurrentSessions: 1,
      qualityProfiles: selectedQualities,
      version,
    };

    await db.runTransaction(async (tx: any) => {
      tx.create(videoRef, removeUndefinedDeep(video));
      tx.create(sourceRef, removeUndefinedDeep({
        sourceId: sourceRef.id,
        ownerUid: admin.uid,
        notebookIds: [],
        visibility: video.visibility,
        displayTitle: video.title,
        originalFileName,
        normalizedName: safeVideoFileName(originalFileName).toLowerCase(),
        normalizedStem: safeVideoFileName(originalFileName).replace(/\.[^.]+$/, "").toLowerCase(),
        aliases: [video.title],
        sha256: "0".repeat(64),
        sourceVersion: version,
        processingVersion: 1,
        mimeType,
        mediaKind: "video",
        resourceRole: "video",
        sizeBytes: Number(sizeBytes),
        durationMs: video.durationMs,
        subject: video.subject,
        storagePath: inputObjectPath,
        hlsPrefix,
        masterManifestPath: video.masterManifestPath,
        processingStatus: "uploaded",
        chunkCount: 0,
        createdAt: now,
        updatedAt: now,
      }));
    });
    res.status(201).json({ ok: true, videoId: video.id, sourceId: video.sourceId, version });
  } catch (error: any) {
    const status = String(error?.message).includes("Forbidden") ? 403 : 500;
    res.status(status).json({ ok: false, code: "VIDEO_CREATE_FAILED", message: error.message });
  }
});

videoRoutes.post("/admin/videos/:videoId/create-upload", async (req, res) => {
  try {
    requireVideoEnabled();
    await verifyVideoAppCheck(req);
    const admin = await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    if (video.createdBy !== admin.uid && !admin.admin) throw new Error("VIDEO_FORBIDDEN");
    if (!["draft", "uploading", "failed"].includes(video.status)) throw new Error("VIDEO_UPLOAD_STATE_INVALID");
    if (String(req.body?.mimeType || video.mimeType) !== video.mimeType || Number(req.body?.sizeBytes) !== video.sourceSizeBytes) {
      throw new Error("VIDEO_UPLOAD_METADATA_MISMATCH");
    }

    const bucket = getAdminBucketByName(video.inputBucket);
    const file = bucket.file(video.inputObjectPath);
    const origin = req.header("origin") || undefined;
    const [uploadUrl] = await file.createResumableUpload({
      origin,
      metadata: {
        contentType: video.mimeType,
        metadata: {
          ownerUid: admin.uid,
          videoId: video.id,
          sourceId: video.sourceId,
          sourceVersion: String(video.version),
        },
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    });

    await getAdminDb().collection("videos").doc(video.id).set({ status: "uploading", updatedAt: new Date().toISOString() }, { merge: true });
    res.json({
      ok: true,
      uploadUrl,
      storagePath: video.inputObjectPath,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEO_UPLOAD_SESSION_FAILED", message: error.message });
  }
});

videoRoutes.post("/admin/videos/:videoId/upload-complete", async (req, res) => {
  try {
    requireVideoEnabled();
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    if (["queued", "transcoding", "ready"].includes(video.status)) {
      return res.json({
        ok: true,
        videoId: video.id,
        sourceId: video.sourceId,
        status: video.status,
        transcodeQueued: video.status !== "ready",
        idempotent: true,
      });
    }
    if (!["uploading", "uploaded", "failed"].includes(video.status)) throw new Error("VIDEO_FINALIZE_STATE_INVALID");
    const validated = await validateUploadedVideo(video);
    if (validated.sizeBytes !== video.sourceSizeBytes) throw new Error("VIDEO_SIZE_MISMATCH");

    const now = new Date().toISOString();
    await getAdminDb().collection("videos").doc(video.id).set({
      status: "uploaded",
      uploadGeneration: validated.generation,
      sourceSizeBytes: validated.sizeBytes,
      updatedAt: now,
    }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({
      processingStatus: "uploaded",
      sizeBytes: validated.sizeBytes,
      updatedAt: now,
    }, { merge: true });

    let transcode: { enabled: boolean; jobName: string | null } = { enabled: false, jobName: null };
    try {
      transcode = await startTranscode({ ...video, status: "uploaded", sourceSizeBytes: validated.sizeBytes });
      if (transcode.enabled && transcode.jobName) {
        await getAdminDb().collection("videos").doc(video.id).set({
          status: "queued",
          transcoderJobName: transcode.jobName,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        await getAdminDb().collection("sources").doc(video.sourceId).set({ processingStatus: "queued" }, { merge: true });
      }
    } catch (error: any) {
      // The original upload is already a validated, playable video. A missing
      // Transcoder permission/configuration must not discard it or leave an
      // empty lesson card; fall back to signed direct playback.
      console.warn("Video transcoder unavailable; using original quality playback.", error?.message || error);
      transcode = { enabled: false, jobName: null };
    }

    const fallbackReady = !transcode.enabled;
    if (fallbackReady) {
      await getAdminDb().collection("videos").doc(video.id).set({
        status: "ready",
        isPublished: true,
        allowPlayback: true,
        playbackMode: "direct",
        publishedAt: now,
        updatedAt: now,
      }, { merge: true });
      await getAdminDb().collection("sources").doc(video.sourceId).set({
        processingStatus: "ready",
        updatedAt: now,
      }, { merge: true });
    } else {
      await getAdminDb().collection("videos").doc(video.id).set({
        isPublished: true,
        allowPlayback: true,
        playbackMode: "hls",
        updatedAt: now,
      }, { merge: true });
    }

    res.json({
      ok: true,
      videoId: video.id,
      sourceId: video.sourceId,
      status: transcode.enabled ? "queued" : "ready",
      transcodeQueued: transcode.enabled,
      playbackMode: transcode.enabled ? "hls" : "direct",
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEO_FINALIZE_FAILED", message: error.message });
  }
});

videoRoutes.post("/admin/videos/:videoId/transcode", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    if (!["uploaded", "failed"].includes(video.status)) throw new Error("VIDEO_TRANSCODE_STATE_INVALID");
    const result = await startTranscode(video);
    if (!result.enabled || !result.jobName) throw new Error("VIDEO_TRANSCODING_DISABLED");
    await getAdminDb().collection("videos").doc(video.id).set({ status: "queued", transcoderJobName: result.jobName, updatedAt: new Date().toISOString() }, { merge: true });
    res.json({ ok: true, status: "queued" });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEO_TRANSCODE_FAILED", message: error.message });
  }
});

videoRoutes.post("/admin/videos/:videoId/reprocess", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const current = await loadVideo(req.params.videoId);
    if (!["ready", "failed", "uploaded", "unpublished"].includes(current.status)) throw new Error("VIDEO_REPROCESS_STATE_INVALID");
    const nextVersion = current.version + 1;
    const video = {
      ...current,
      version: nextVersion,
      hlsPrefix: `videos/${current.id}/versions/${nextVersion}/hls/`,
      masterManifestPath: `videos/${current.id}/versions/${nextVersion}/hls/master.m3u8`,
    };
    const result = await startTranscode(video);
    if (!result.enabled || !result.jobName) throw new Error("VIDEO_TRANSCODING_DISABLED");
    await getAdminDb().collection("videos").doc(video.id).set({
      version: nextVersion,
      hlsPrefix: video.hlsPrefix,
      masterManifestPath: video.masterManifestPath,
      status: "queued",
      isPublished: false,
      allowPlayback: false,
      transcoderJobName: result.jobName,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({
      sourceVersion: nextVersion,
      processingVersion: Number((current as any).processingVersion || 1) + 1,
      processingStatus: "queued",
      hlsPrefix: video.hlsPrefix,
      masterManifestPath: video.masterManifestPath,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    res.json({ ok: true, status: "queued", version: nextVersion });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEO_REPROCESS_FAILED", message: error.message });
  }
});

videoRoutes.patch("/admin/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const allowed = ["title", "description", "subject", "lesson", "concept", "visibility", "allowedRoles", "allowedUserIds", "watermarkEnabled", "maxConcurrentSessions", "qualityProfiles"];
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    await getAdminDb().collection("videos").doc(req.params.videoId).set(updates, { merge: true });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEO_UPDATE_FAILED", message: error.message });
  }
});

for (const action of ["publish", "unpublish"] as const) {
  videoRoutes.post(`/admin/videos/:videoId/${action}`, async (req, res) => {
    try {
      await verifyVideoAppCheck(req);
      await requireAdmin(req);
      const video = await loadVideo(req.params.videoId);
      if (action === "publish" && video.status !== "ready") throw new Error("VIDEO_NOT_READY");
      await getAdminDb().collection("videos").doc(video.id).set({
        isPublished: action === "publish",
        allowPlayback: action === "publish",
        status: action === "unpublish" ? "unpublished" : "ready",
        publishedAt: action === "publish" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      res.json({ ok: true, published: action === "publish" });
    } catch (error: any) {
      res.status(400).json({ ok: false, code: `VIDEO_${action.toUpperCase()}_FAILED`, message: error.message });
    }
  });
}

videoRoutes.delete("/admin/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await loadVideo(req.params.videoId);
    await getAdminDb().collection("videos").doc(video.id).set({ status: "archived", isPublished: false, allowPlayback: false, updatedAt: new Date().toISOString() }, { merge: true });
    await getAdminDb().collection("sources").doc(video.sourceId).set({ processingStatus: "deleted", deletedAt: new Date().toISOString() }, { merge: true });
    res.json({ ok: true, archived: true });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEO_DELETE_FAILED", message: error.message });
  }
});

videoRoutes.get("/admin/videos", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const snapshot = await getAdminDb().collection("videos").orderBy("createdAt", "desc").limit(100).get();
    const videos = await Promise.all(snapshot.docs.map((doc: any) =>
      refreshTranscodeStatus({ id: doc.id, ...doc.data() } as VideoDocument),
    ));
    res.json({ ok: true, videos: videos.map(publicVideo) });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "VIDEOS_LIST_FAILED", message: error.message });
  }
});

videoRoutes.get("/admin/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    await requireAdmin(req);
    const video = await refreshTranscodeStatus(await loadVideo(req.params.videoId));
    res.json({ ok: true, video: publicVideo(video) });
  } catch (error: any) {
    res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: error.message });
  }
});

videoRoutes.get("/videos", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const snapshot = await getAdminDb().collection("videos").where("isPublished", "==", true).limit(100).get();
    const refreshed = await Promise.all(snapshot.docs.map((doc: any) =>
      refreshTranscodeStatus({ id: doc.id, ...doc.data() } as VideoDocument),
    ));
    const videos = refreshed
      .filter((video: VideoDocument) => canUserPlayVideo(video, user))
      .map(publicVideo);
    res.json({ ok: true, videos });
  } catch (error: any) {
    res.status(401).json({ ok: false, code: "VIDEOS_ACCESS_FAILED", message: error.message });
  }
});

videoRoutes.get("/videos/:videoId", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const video = await refreshTranscodeStatus(await loadVideo(req.params.videoId));
    if (!canUserPlayVideo(video, user)) return res.status(403).json({ ok: false, code: "VIDEO_FORBIDDEN" });
    res.json({ ok: true, video: publicVideo(video) });
  } catch (error: any) {
    res.status(404).json({ ok: false, code: "VIDEO_NOT_FOUND", message: error.message });
  }
});

videoRoutes.get("/videos/:videoId/stream", async (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || "").trim();
    const token = String(req.query.token || "").trim();
    if (!sessionId || !token) return res.status(403).end();

    const sessionSnapshot = await getAdminDb().collection("videoPlaybackSessions").doc(sessionId).get();
    const session = sessionSnapshot.data();
    const requestUserAgentHash = crypto
      .createHash("sha256")
      .update(String(req.header("user-agent") || "unknown"))
      .digest("hex");
    if (
      !sessionSnapshot.exists
      || session?.status !== "active"
      || session?.videoId !== req.params.videoId
      || Number(session?.expiresAtMs || 0) <= Date.now()
      || session?.userAgentHash !== requestUserAgentHash
      || !playbackTokenMatches(token, String(session?.streamTokenHash || ""))
    ) {
      return res.status(403).end();
    }

    const video = await loadVideo(req.params.videoId);
    if (!video.allowPlayback || video.status !== "ready") return res.status(403).end();

    const file = getAdminBucketByName(video.inputBucket).file(video.inputObjectPath);
    const [metadata] = await file.getMetadata();
    const totalBytes = Number(metadata.size || video.sourceSizeBytes || 0);
    let range;
    try {
      range = resolveVideoByteRange(req.header("range"), totalBytes);
    } catch (error: any) {
      res.setHeader("Content-Range", `bytes */${totalBytes || 0}`);
      return res.status(String(error?.message).includes("RANGE") ? 416 : 400).end();
    }

    res.status(206);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${totalBytes}`);
    res.setHeader("Content-Length", String(range.length));
    res.setHeader("Content-Type", metadata.contentType || video.mimeType || "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="${safeVideoFileName(video.title || "lesson-video")}.mp4"`);
    res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("X-Playback-Session", sessionId);
    res.flushHeaders();

    const mediaStream = file.createReadStream({ start: range.start, end: range.end });
    mediaStream.on("error", () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    req.on("aborted", () => mediaStream.destroy());
    res.on("close", () => {
      if (!res.writableEnded) mediaStream.destroy();
    });
    mediaStream.pipe(res);
  } catch {
    if (!res.headersSent) res.status(403);
    res.end();
  }
});

videoRoutes.post("/videos/:videoId/playback-session", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const video = await refreshTranscodeStatus(await loadVideo(req.params.videoId));
    if (!canUserPlayVideo(video, user)) return res.status(403).json({ ok: false, code: "VIDEO_FORBIDDEN" });

    const db = getAdminDb();
    const active = await db.collection("videoPlaybackSessions")
      .where("userId", "==", user.uid)
      .where("status", "==", "active")
      .limit(25)
      .get();
    const now = Date.now();
    const deviceId = String(req.header("X-Device-ID") || "unknown").slice(0, 160);
    const expiredOrSameDevice = active.docs.filter((document: any) => {
      const session = document.data();
      return Number(session.expiresAtMs || 0) <= now
        || (session.videoId === video.id && session.deviceId === deviceId);
    });
    if (expiredOrSameDevice.length) {
      const cleanup = db.batch();
      expiredOrSameDevice.forEach((document: any) => cleanup.set(document.ref, { status: "revoked", endedAt: new Date(now).toISOString() }, { merge: true }));
      await cleanup.commit();
    }
    const liveSessions = active.docs.filter((document: any) => {
      const session = document.data();
      return session.videoId === video.id
        && session.deviceId !== deviceId
        && Number(session.expiresAtMs || 0) > now;
    });
    if (liveSessions.length >= video.maxConcurrentSessions) {
      return res.status(409).json({ ok: false, code: "PLAYBACK_SESSION_LIMIT", message: "This account already has an active playback session." });
    }

    const cdnConfigured = Boolean(env.VIDEO_CDN_BASE_URL && env.VIDEO_CDN_KEY_NAME && env.VIDEO_CDN_SIGNING_KEY);
    const directPlayback = !video.transcoderJobName || (video as any).playbackMode === "direct" || !cdnConfigured;
    const signed = directPlayback ? null : createSignedPlaybackCookie(video);
    const sessionRef = db.collection("videoPlaybackSessions").doc();
    const streamToken = directPlayback ? crypto.randomBytes(32).toString("base64url") : null;
    const expiresAtMs = now + env.VIDEO_SESSION_TTL_SECONDS * 1000;
    await sessionRef.set({
      sessionId: sessionRef.id,
      userId: user.uid,
      videoId: video.id,
      deviceId,
      userAgentHash: crypto.createHash("sha256").update(String(req.header("user-agent") || "unknown")).digest("hex"),
      createdAt: new Date(now).toISOString(),
      lastHeartbeatAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      status: "active",
      streamTokenHash: streamToken ? hashPlaybackToken(streamToken) : null,
    });

    if (signed) {
      res.cookie("Cloud-CDN-Cookie", signed.cookieValue, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        domain: env.VIDEO_COOKIE_DOMAIN || undefined,
        path: signed.path,
        maxAge: env.VIDEO_COOKIE_TTL_SECONDS * 1000,
      });
    }
    const streamUrl = streamToken
      ? `/api/videos/${encodeURIComponent(video.id)}/stream?sessionId=${encodeURIComponent(sessionRef.id)}&token=${encodeURIComponent(streamToken)}`
      : null;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      sessionId: sessionRef.id,
      playbackMode: streamUrl ? "direct" : "hls",
      streamUrl,
      manifestUrl: signed?.manifestUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
      watermark: { userId: user.uid, label: user.email || user.uid },
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "PLAYBACK_SESSION_FAILED", message: error.message });
  }
});

videoRoutes.post("/video-sessions/:sessionId/heartbeat", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const ref = getAdminDb().collection("videoPlaybackSessions").doc(req.params.sessionId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== user.uid || snapshot.data()?.status !== "active") {
      return res.status(403).json({ ok: false, code: "SESSION_REVOKED" });
    }
    const expiresAtMs = Date.now() + env.VIDEO_SESSION_TTL_SECONDS * 1000;
    await ref.set({ lastHeartbeatAt: new Date().toISOString(), expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs }, { merge: true });
    res.json({ ok: true, expiresAt: new Date(expiresAtMs).toISOString() });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "SESSION_HEARTBEAT_FAILED", message: error.message });
  }
});

videoRoutes.post("/video-sessions/:sessionId/end", async (req, res) => {
  try {
    await verifyVideoAppCheck(req);
    const user = await requireUser(req);
    const ref = getAdminDb().collection("videoPlaybackSessions").doc(req.params.sessionId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== user.uid) return res.status(403).json({ ok: false, code: "SESSION_FORBIDDEN" });
    await ref.set({ status: "revoked", endedAt: new Date().toISOString() }, { merge: true });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "SESSION_END_FAILED", message: error.message });
  }
});
