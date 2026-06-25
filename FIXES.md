# Reliability and Z-Score Fixes

## Z-Score and lesson-weight logic

- Replaced the old hard-coded rank points with `src/data/zscore_data.json` from the supplied 200-student dataset.
- Added monotonic rank normalization so a lower Z-Score can never produce a better estimated rank because of a noisy record.
- Ported the Blueprint subject-score curves, ET theory/practical conversion, syllabus definitions, and lesson-wise mark weighting.
- Lesson-wise weights are normalized to approximately 100% per subject.
- ET predicted final mark now uses `75% theory + 25% practical` instead of adding 25 directly.

## Progress graph

- Removed generated/fake six-day Z-Score history.
- Stores only real calculated observations.
- Uses ISO dates (`YYYY-MM-DD`) and migrates old `Jun 25 (Today)` / hard-coded `2001-*` labels.
- Deduplicates multiple entries for the same date.
- Prevents the predictor from saving default/empty data before authentication hydration finishes.

## Database and sync safety

- Local-first writes: every change is saved to browser storage before network calls.
- Browser progress is stored as a versioned envelope with `updatedAt`, `revision`, and explicit `reset` metadata.
- Added a persistent offline outbox and automatic retry when the browser reconnects.
- Hydration compares Local Storage, Firestore, and Express snapshots and chooses the newest valid version.
- Remote read failures no longer replace current data with an empty default object.
- Existing non-empty server data rejects accidental empty overwrites unless `reset: true` is explicitly supplied.
- Stale writes are rejected with HTTP 409.
- Emails are normalized to lowercase across all storage paths.
- Server writes are atomic and keep a `.bak` copy; a corrupted primary database file is restored from that backup.
- Added serverless encrypted snapshot restoration support.

## Validation completed

- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- Score/rank anchor and lesson-weight tests — passed.
- API read/write, stale-write rejection, accidental-empty rejection, and explicit-reset tests — passed.
- Corrupted database recovery test — passed.
