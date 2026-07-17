# Tec A/L Production Repair Report

## Implemented

- Reworked the mobile and desktop navigation labels, safe-area bottom bar, compact top navigation, icon-only New Chat action, and mobile overflow protection.
- Repaired the Assistant chat layout, English application chrome, message wrapping, attachment restrictions, composer spacing, and latest-answer control.
- Rebuilt the lesson-resource modal as a mobile bottom sheet backed by authenticated server capabilities and the global `lesson_resources` collection.
- Added server-enforced content-manager authorization for shared lesson files, past papers, OCR/reindex actions, videos, publication, deletion, and cache review.
- Added a global lesson-resource API and migration script so published administrator content is visible to students while personal Assistant uploads remain private.
- Rebuilt the secure video player without the white header, added direct signed playback retry handling, normalized repeated extensions, validated uploaded containers, and added a GCS CORS configuration script.
- Repaired PDF.js packaging by copying `pdf.worker.mjs` into the Vercel runtime, explicitly configuring the worker, and separating parser failures from genuine scanned-PDF OCR states.
- Changed scanned-PDF processing to asynchronous OCR with `202 OCR_QUEUED`, status polling, cached results, and automatic Direct PDF QA retry.
- Reworked chart measurement to mount charts only after valid visible dimensions are available.
- Changed Firebase Google authentication to popup on desktop and redirect on mobile/PWA, with a single in-flight auth attempt and a single redirect-result bootstrap.
- Repaired toast deduplication, timers, queue limits, animations, and safe-area placement.
- Tightened Firestore and Storage rules for private attachments, shared content, videos, OCR text, and cached-question review.

## Verification completed locally

The following commands completed successfully:

```text
npm ci --include=dev
npm run typecheck
npm test
npm run build:vercel
npm run verify:repair
```

Verified build output:

```text
vercel-runtime/server.mjs
vercel-runtime/pdf.worker.mjs
vercel-runtime/google-gax-protos/
```

The build completed with only Vite bundle-size warnings. The isolated Vercel runtime smoke test passed.

## External deployment operations still require project credentials

The source archive does not include a linked `.vercel` project or deployment token, and this environment cannot modify the connected Vercel environment variables or Google Cloud IAM. Before production release, apply these operations in the real project account:

1. Set Vercel Production, Preview, and Development variables:

```text
OCR_ENABLED=true
ENABLE_CLOUD_VISION_OCR=true
OCR_INPUT_BUCKET=al-ai-chat-ocr-input
OCR_OUTPUT_BUCKET=al-ai-chat-ocr-output
VISION_OCR_INPUT_BUCKET=al-ai-chat-ocr-input
VISION_OCR_OUTPUT_BUCKET=al-ai-chat-ocr-output
```

2. Create the OCR buckets in `al-ai-chat`, enable Cloud Vision, and grant the runtime service account read/write access to both buckets and permission to invoke Vision document OCR.
3. Deploy `firestore.rules` and `storage.rules`.
4. Run `npm run migrate:lesson-resources` once with production Firebase Admin credentials.
5. Run `npm run configure:video-cors` with `VIDEO_ALLOWED_ORIGINS` containing the production and preview origins.
6. Deploy a preview, run the user-role acceptance checks with separate administrator and student accounts, then promote to production.

These external operations are intentionally not marked as completed because no production cloud credentials were available in the uploaded project.
