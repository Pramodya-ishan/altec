# Deployment

## Required Vercel environments

Configure the same safe feature defaults in Development, Preview, and Production. Secrets must be different where policy requires it and must never be committed.

```env
ENABLE_VIDEO=true
ENABLE_VIDEO_TRANSCODING=true
VIDEO_REQUIRE_APP_CHECK=true
VIDEO_INPUT_BUCKET=INPUT_BUCKET
VIDEO_OUTPUT_BUCKET=OUTPUT_BUCKET
VIDEO_ARCHIVE_BUCKET=ARCHIVE_BUCKET
VIDEO_TRANSCODER_LOCATION=us-central1
VIDEO_CDN_BASE_URL=https://video.example.com
VIDEO_CDN_KEY_NAME=KEY_NAME
VIDEO_CDN_SIGNING_KEY=BASE64_SECRET
VIDEO_COOKIE_DOMAIN=.example.com
VIDEO_UPLOAD_MAX_MB=10240
VIDEO_COOKIE_TTL_SECONDS=300
VIDEO_SESSION_TTL_SECONDS=600
ENABLE_4K=false
```

The application also requires its existing Firebase browser configuration, Firestore database ID, server Firebase/Google credential, and allowed origins. Deploy Firestore and Storage rules through the Firebase project release process; a Vercel deployment does not apply those rule files.

Release gate: `npm run lint`, source registry tests, repository tests, security scan, `npm run build`, then a real short-video upload/transcode/publish/playback smoke test. Do not set transcoding/App Check to true until the corresponding Cloud/CDN/site-key resources exist.
