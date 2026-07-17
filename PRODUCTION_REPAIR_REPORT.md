# Tec A/L Production Repair V2

Date: 2026-07-17
Source baseline: `altec-fixed-403db97.zip`

## Production failures addressed

### Vercel `API_NOT_FOUND` for Direct PDF QA

The production request `POST /api/pdf/direct-qa-file` was reaching the Express API catch-all after Vercel lost the nested path. The project now deploys one Express function at `api/index.ts`, rewrites `/api/:path*` to `/api?__path=:path*`, and restores the original nested path in middleware before routers run. The browser also performs one compatible fallback request when an older deployment returns `API_NOT_FOUND`.

The isolated Vercel-runtime smoke test now verifies that both of these paths reach the authenticated Direct PDF QA route rather than the API catch-all:

```text
/api/pdf/direct-qa-file
/api?__path=pdf%2Fdirect-qa-file
```

Without a login they correctly return `401 LOGIN_REQUIRED`, proving that the route exists and authentication middleware is running.

### Firebase COOP `window.closed` warnings

Google login is redirect-only on every device. The application no longer imports or invokes `signInWithPopup`, so Firebase does not create or poll a popup window. Redirect results are restored once during authentication initialization, duplicate login attempts are blocked, and a temporary server-session bootstrap failure does not discard a valid Firebase user.

The existing security headers remain:

```text
Cross-Origin-Opener-Policy: same-origin-allow-popups
Cross-Origin-Embedder-Policy: unsafe-none
```

The new build also unregisters old service workers and removes prior Workbox/Clora caches so an older popup-auth JavaScript bundle is not kept after release.

### Assistant greeting and internal-text leakage

A simple greeting such as `hi` now receives one short response instead of a long product introduction:

```text
Hi! අද බලන්න ඕනේ පාඩම හෝ ප්‍රශ්නය මොකක්ද?
```

Server, stream, voice, saved-message, and client-display sanitizers remove hidden control tags, machine-style directives, and the reported router-light directive. The assistant prompt now requires direct answers, source-grounding, minimal filler, no tool/system traces, and natural Sinhala or Singlish matching.

### PDF inventory and saved-resource logic

The Singlish request:

```text
oyt answers denna puluwn pdf mond kiyl check krnn
```

is routed deterministically to the real saved-PDF inventory. A generic query checks every accessible subject unless the student explicitly names SFT, ET, or ICT.

The inventory now merges:

- `past_papers`
- `rag_sources`
- the signed-in user's syllabus resources
- authoritative `lesson_resources`

A PDF is reported as answerable when it has either a usable text index or a valid stored source file that can be sent through secure Direct PDF QA. It no longer returns the lesson-resource-missing template merely because indexed chunks are absent.

Legacy administrator resources affected by the old `visibility: private` bug are safely recognized through shared scopes such as `paper_structure`, `past_paper`, `owner_syllabus`, `shared_lesson`, and `official`. Personal `chat_upload` and `personal` sources remain private. Explicitly unpublished or archived resources remain hidden.

Direct PDF QA also merges `lesson_resources` publication metadata with extracted `rag_sources` data before access checks, allowing students to use published administrator PDFs without exposing another user's private files.

### Sinhala Unicode display

Server output, streamed text, stored replies, notifications, and rendered Assistant messages normalize common malformed conjuncts. For example:

```text
ප්රගතිය -> ප්‍රගතිය
ප්රශ්නය -> ප්‍රශ්නය
අධ්යයනය -> අධ්‍යයනය
```

## Previously completed production repairs retained

The project also retains the mobile UI repair, English application chrome, responsive chart measurement, safe-area bottom navigation, lesson-resource capability enforcement, global shared-resource model, PDF.js worker packaging, asynchronous OCR states, secure video playback fallback, upload restrictions, notification deduplication, Firestore/Storage rule updates, migration tooling, and build-runtime checks from the first production repair.

## Local verification

The following commands passed after the V2 changes:

```text
npm run typecheck
npm test
npm run build:vercel
npm run verify:repair
```

Verified runtime artifacts:

```text
vercel-runtime/server.mjs
vercel-runtime/pdf.worker.mjs
vercel-runtime/google-gax-protos/
```

The production build completed with Vite bundle-size warnings only. The isolated API runtime booted without root `node_modules`, and all tested API paths returned typed JSON responses.

## Deployment still required

This ZIP contains the repaired source and built runtime, but it has not been promoted to `tecal.vercel.app`. The uploaded archive does not contain a linked `.vercel/project.json`, a deployment token, or Google Cloud credentials.

Deploy this project as a preview first, then promote it to production. Configure the OCR environment and cloud resources documented in `.env.example`, deploy `firestore.rules` and `storage.rules`, and run the lesson-resource migration once where required.

After production promotion, open the site in a new tab or hard-refresh once. The new asset hashes should replace the old `firebase-TbtXCjiz.js` and `index-B87-hrzB.js` bundles.
