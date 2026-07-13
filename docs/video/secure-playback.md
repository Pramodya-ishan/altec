# Secure playback

Playback requires a valid Firebase ID token. If `VIDEO_REQUIRE_APP_CHECK=true`, it also requires a valid Firebase App Check token.

`POST /api/videos/:videoId/playback-session` checks publication state and user access, enforces the per-video concurrent-session limit, records a short server-owned session, and emits a Cloud CDN signed cookie scoped to the immutable HLS version path. The response is `no-store` and contains only the manifest URL, session ID, expiry, and watermark label.

The player sends heartbeats and explicitly ends the session on close/page hide. A moving user/video watermark discourages casual screen sharing. This is access control and leak traceability, not DRM and not a claim that browser-visible media is download-proof.
