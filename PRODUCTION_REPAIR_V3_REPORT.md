# Tec A/L Production Repair V3

Date: 2026-07-18  
Source baseline: `altec-production-repair-v2.zip`

## Firebase Storage authorization repair

Students no longer open published administrator PDFs through the Firebase browser SDK. A published paper may remain stored under an administrator-owned path such as `users/<admin uid>/past_papers/...`; the browser therefore does not need object-owner permission.

Shared and official PDF actions now use the authenticated application endpoint:

```text
GET /api/rag/sources/:sourceId/download?format=json
```

The server resolves the source across `past_papers`, `lesson_resources`, `rag_sources`, and the signed-in user's syllabus resources. It checks application-level visibility before accessing Cloud Storage. Published past papers, official resources, public resources, class resources, institution resources, and authorized owner resources can be opened. Another user's private attachments remain inaccessible.

When service-account URL signing is available, the endpoint returns a short-lived inline signed URL. If signing is unavailable, it returns an authenticated stream route. The stream route supports byte-range responses and never proxies an unverified or unpublished source.

The client opens the secure route first and uses direct Firebase `getDownloadURL()` only for an owner-only personal attachment that has no server source identity. Firebase `storage/unauthorized` is converted to a concise user-facing error instead of being printed as the expected shared-resource path.

This removes the student's need for administrator Storage-object permission. It does not remove login, publication, or application access checks.

## Direct PDF answer presentation

Direct PDF answers now render as a modern evidence-first response rather than one large plain text block.

The response includes a compact verified-source card showing the source title, year, question number, page number when available, and whether the answer came from an official marking scheme or verified PDF evidence.

MCQ options are normalized so output is exactly `(1) ...`, `(2) ...` and no longer becomes `1. (1) ...`. The answer is emphasized in a blockquote, explanations use clean section hierarchy, and incorrect-option reasoning is displayed as a readable list.

Common malformed Sinhala conjuncts continue to be normalized, including `ප්රශ්නය` to `ප්‍රශ්නය`, `ප්රතික්රියාව` to `ප්‍රතික්‍රියාව`, and `ප්රගතිය` to `ප්‍රගතිය`.

## Visual explanations

The Assistant can now attach factual structured visual blocks to answers:

- verified PDF evidence cards
- balanced reaction diagrams
- formula cards
- comparison bars
- step/process flows
- existing coordinate graphs and tables

For the NaOH and H₂SO₄ example, the answer can show the balanced reaction and a deterministic 1× versus 2× heat comparison based on the number of water moles formed. These values are derived from the verified equation rather than invented by the language model.

General AI answers also pass through a deterministic visual-aid builder. It adds a reaction, formula, or process visual only when the answer contains enough factual information or the student asks for a visual explanation. It does not fabricate chart points or decorative images. Existing explicit image generation remains available through the application's image-generation workflow.

## AI response quality

The response pipeline now favors a direct answer, concise greeting behavior, short readable sections, verified evidence before conclusions, minimal filler, and no internal prompt/tool text. The uploaded reference was used only for safe high-level writing principles; vendor identity, hidden instructions, memory behavior, and unrelated operational content were not copied into the application.

## Security retained

The repair does not make the Storage bucket public and does not grant students write access. Shared resource upload, publish, delete, OCR, reprocess, and video-management actions remain limited to administrator/content-manager roles. Personal Assistant uploads remain private.

The server runtime service account still needs Cloud Storage object-read permission for the relevant bucket. Signed-URL mode additionally needs permission to sign blobs. When signing is unavailable but object-read permission exists, authenticated streaming is used.

## Verification

The following commands passed after the V3 changes:

```text
npm run typecheck
npm test
npm run build:vercel
npm run verify:repair
```

The build verified:

```text
vercel-runtime/server.mjs
vercel-runtime/pdf.worker.mjs
vercel-runtime/google-gax-protos/
```

New regression coverage includes secure protected-PDF routing, published past-paper visibility, MCQ numbering cleanup, source evidence blocks, reaction/comparison visuals, deterministic general visual aids, and repair-file assertions.

## Production deployment required

This project archive is repaired and built locally, but it is not automatically promoted to `tecal.vercel.app`. Deploy the V3 archive or commit it to the connected production branch, then verify the new frontend asset hashes are served instead of `index-CX0JthHX.js`.

After deployment, test with a student account that does not own the administrator's Storage path:

```text
/api/rag/sources/<sourceId>/download?format=json
```

A published paper should return `200` with `mode: signed_url` or `mode: stream`. A private source belonging to another user should return `403`.
