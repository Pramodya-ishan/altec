# Rollback

1. Set `ENABLE_VIDEO=false` for immediate subsystem containment, or set only `ENABLE_VIDEO_TRANSCODING=false` to stop new jobs while keeping existing resources visible.
2. Roll the Vercel production alias back to the previous known-good deployment.
3. Unpublish affected videos and revoke active `videoPlaybackSessions`.
4. Rotate the CDN signing key if cookie material may have leaked.
5. Preserve source and HLS objects until the incident review completes; do not delete evidence during rollback.

Firestore documents are version-aware, so an application rollback does not require overwriting the prior HLS version. Re-enable in Preview first and run the complete playback smoke test before promoting again.
