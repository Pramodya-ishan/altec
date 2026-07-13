# Player security checklist

- Input, output, and archive buckets remain private with uniform bucket-level access.
- Protected video never uses a public Firebase download URL or direct MP4 source.
- CDN signing material is server-only and excluded from all `VITE_` variables.
- Playback requires Firebase authorization; App Check can be required after the production site key is installed.
- Signed cookies are short-lived and restricted to a single video version path.
- Playback responses use `Cache-Control: no-store`.
- Source paths, transcoder job names, credentials, and signing values are removed from public video responses.
- Student clients cannot write `sources`, `videos`, sessions, or audit collections directly.
- CSP limits media connections to the configured CDN.

Rotate the CDN signing key and revoke active playback sessions after any suspected leak. Browser playback cannot prevent capture by an authorized device; the moving watermark provides traceability rather than DRM.
