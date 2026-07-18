# Tec A/L Production Repair V8

Date: 2026-07-18

## Outcome

V8 rebuilds the Assistant and mobile experience around an all-subject, source-grounded learning flow. It removes the legacy prompt-card home state, prevents the current page's subject toggle from limiting Assistant retrieval, adds persistent learning signals, restores resilient lesson-resource discovery, and improves message, chart, countdown, and mobile navigation behavior.

## Assistant and image generation

- Natural English, Sinhala, and Singlish image requests are detected before normal text answering and routed to `/api/image/generate`.
- The Assistant no longer uses a text response claiming it cannot create images.
- Generated images appear as native message attachments with loading, retry, and failure states.
- The existing secure image pipeline saves generated output under the authenticated user's Firebase Storage namespace.
- Normal answers are buffered, then revealed with smooth typing and a neutral grey cursor.
- The loading state now displays an animated thinking skeleton and real stage labels rather than a fixed “Preparing answer” message.
- Users can reply to a specific message; the quoted context is sent with the next request.
- Follow-up suggestions are generated from the current conversation instead of fixed 2023/SFT examples.

## All-subject AI context

- Assistant requests deliberately omit a UI-selected active subject, allowing SFT, ET, and ICT retrieval in the same conversation.
- The server resolves the intended subject from the actual question, conversation, source identity, and available evidence.
- Paper Structure resources, syllabus PDFs, past papers, indexed lesson resources, user notes, and learning history are included when relevant.
- Missing exact lesson resources no longer terminate the answer path; the router falls back to the matching syllabus and Paper Structure evidence.

## Learning memory and personalization

- Stable non-sensitive preferences and study context are stored in `ai_memory`.
- Incorrect responses are stored separately in `mistake_notebook`.
- Weak concepts are stored separately in `weak_points`.
- Deterministic IDs prevent duplicate records.
- User-specific signals are loaded into future AI context.
- Only anonymized aggregate concept counts are stored in `learning_signal_aggregates`; raw chats and user IDs are not copied into global learning data.
- Sensitive personal attributes are excluded from automatic memory extraction.

## Mobile and navigation

- The desktop sidebar remains desktop-only.
- The mobile sidebar and hamburger are removed.
- Page changes use a subtle bottom-navigation active-capsule animation plus a content fade/slide transition.
- The mobile bottom bar hides while the Assistant composer is focused, preventing keyboard/composer overlap.
- The bottom navigation remains safe-area aware.
- The Assistant landing subtitle and legacy fixed suggestion cards are removed.

## Message presentation

- Assistant answers use a clean, unbordered, full-width ChatGPT-style layout.
- Long Sinhala and English content wraps safely and receives paragraph normalization.
- Additional Sinhala conjunct/Unicode normalization is applied before rendering.
- Tables and code blocks remain internally scrollable.
- Reply, copy, source, image, and follow-up actions use compact controls.

## Paper Structure lesson resources

- Lesson resource queries send both stable `lessonId` and `lessonTitle`.
- The server performs Unicode-, punctuation-, alias-, and spacing-tolerant lesson matching.
- Published records are merged from `lesson_resources` and the video catalog without exposing another user's private data.
- Resource lists refresh immediately and again after storage/index propagation.
- A shared `lesson-resources:changed` event refreshes open views after upload or update.
- A transient refresh error no longer clears already loaded files and videos.

## Charts and countdown

- Z-score and marks chart tooltips are compact, non-blocking, constrained to a small card, and allowed to escape the chart viewport.
- Tooltip layers use `pointer-events: none`, so they do not block graph interaction.
- The A/L countdown now displays days, hours, minutes, and seconds.
- The exam start can be configured with `VITE_AL_EXAM_START_DATE`.

## Removed legacy content

- Removed “Study with A/L subjects, past papers, lesson resources, and your notes.”
- Removed fixed “2023 SFT paper structure”, Z-score, review mistakes, and summarize notes cards.
- Removed the fixed “Preparing answer” status.
- Removed mobile sidebar/hamburger behavior.

## Verification

Passed:

- `npm ci --include=dev --registry=https://registry.npmjs.org/`
- `npm run check:npm-registry`
- `npm run typecheck`
- `npm test`
- production Vite build and Vercel runtime bundle
- `npm run bundle:vercel`
- `npm run verify:repair`
- isolated pure-ESM Vercel runtime boot
- PDF.js worker and native PDF preview asset verification

The final runtime contains:

- `vercel-runtime/server.mjs`
- `vercel-runtime/pdf.worker.mjs`
- `vercel-runtime/google-gax-protos/`
- native `@napi-rs/canvas` runtime assets

A redundant second Vite build attempt timed out in the sandbox after the already successful production build. It occurred after only the static verifier was edited. The existing application build was retained, and the self-contained Vercel runtime was rebuilt and smoke-tested again successfully.

## Production verification still required

The local environment does not contain deployable production Google credentials. After preview deployment, verify:

- a real Gemini/Nano Banana image request returns and stores an image;
- Firebase writes create the expected memory, weak-point, and mistake records;
- a separate student account sees published Paper Structure PDFs and videos;
- mobile keyboard opening hides the bottom navigation on iOS and Android;
- production environment has the configured image model, Firebase Admin credentials, and storage permissions.
