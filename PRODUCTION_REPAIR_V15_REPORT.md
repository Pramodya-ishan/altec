# Clora X Production Repair V15

## Scope

V15 repairs the progress-data load/synchronization flow and the Z-score history timeline.

## Progress loading repairs

- Removed the user-facing failure messages `Progress data could not be loaded.` and `Progress is waiting to sync. It will retry when the connection returns.`.
- A temporary API, Firebase, token, or network failure no longer replaces the student's current progress with empty default data.
- Initial authenticated pages stay in a safe loading state until progress has been successfully hydrated, preventing edits against an empty temporary record.
- Progress reads use three short attempts, a 12-second request timeout, exponential background retry, and immediate retry when the browser returns online or regains focus.
- Expired Firebase ID tokens are refreshed once automatically for authenticated API calls.

## Synchronization repairs

- Saves are debounced and serialized so only one progress write is in flight.
- The latest pending state replaces older queued states, preventing stale retries from overwriting newer edits.
- Failed saves retry automatically with exponential backoff up to 30 seconds.
- Save requests have a 15-second timeout so a stalled Vercel/Firebase request cannot leave synchronization permanently stuck.
- Logout clears pending writes and retry timers.
- No application request-count rate limit was added.

## Firestore storage repair

The old implementation wrote the complete application state into both `users/{uid}/progress/data` and the root user document. Large lesson-resource metadata could exceed Firestore's document-size limit and make every later progress save fail.

V15 introduces sectioned progress storage:

- `users/{uid}/progress_sections/sft`
- `users/{uid}/progress_sections/et`
- `users/{uid}/progress_sections/ict`
- `users/{uid}/progress_sections/meta`

The old `progress/data` document now contains only a lightweight compatibility marker. Existing UID- and email-keyed legacy progress is read, merged, normalized, and migrated automatically.

Embedded Base64, OCR text, raw transcripts, blobs, and other large transient resource fields are removed from progress payloads. Stable resource identifiers, URLs, storage paths, titles, status, and display metadata remain.

## Z-score history repairs

- Saving paper marks no longer deletes Exam Score Predictor history.
- Predictor history no longer deletes saved-paper history.
- Reopening the Z-score page no longer rewrites the same daily history point repeatedly.
- Predictor history is created only after authenticated progress has loaded successfully and real progress evidence exists.
- History is normalized, de-duplicated by fingerprint, date-sorted, and capped at 1,000 entries.
- On chart days containing both a predictor estimate and an actual saved-paper estimate, the saved-paper estimate has display priority.
- AI user context now reads the same sectioned progress store and its cache is invalidated immediately after a progress or target-Z update.

## Server error semantics

- Firestore progress failures return `503 PROGRESS_LOAD_FAILED` or `503 PROGRESS_SAVE_FAILED`, not a misleading `401` authentication error.
- Oversized payload failures return `413 PROGRESS_PAYLOAD_TOO_LARGE`.
- Administrative support view/edit uses the same sectioned progress store.

## Validation performed

Passed locally:

- TypeScript syntax transpilation for every modified TS/TSX entry.
- Pure progress split/combine/normalization tests.
- Resource-payload compaction regression test.
- Mixed Z-score history preservation test.
- Duplicate daily predictor-write prevention test.
- Production repair static verification.
- Public npm registry lockfile verification.
- Obsolete legacy-path cleanup verification.

A complete local `npm ci` did not finish in this sandbox because registry access stalled. Vercel must run the normal clean install and production build from this project before promotion.
