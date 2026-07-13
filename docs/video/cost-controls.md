# Video cost controls

- Original bytes upload once directly to object storage.
- Renditions above the source resolution are never created.
- 4K is disabled by default.
- Output paths are immutable and CDN-cacheable by version.
- Upload size is bounded by `VIDEO_UPLOAD_MAX_MB` on both client and server.
- Transcoding is explicit and can be disabled without disabling resource UI.
- Reprocess creates a new version and should be limited to operators.

Monitor input/output storage, Transcoder minutes by resolution, CDN egress/cache hit ratio, failed jobs, abandoned resumable objects, and repeated reprocessing. Apply bucket lifecycle cleanup only after confirming retention requirements.
