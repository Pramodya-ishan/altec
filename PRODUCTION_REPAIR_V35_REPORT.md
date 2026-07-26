# ALTEC Production Repair V35

Date: 2026-07-26

## Outcome

This repair consolidates the standalone Notes workspace into the Error Log, removes the Assistant's visible mode/tool templates, repairs historical lesson-video deletion, and makes bulk notifications bounded and usable end to end.

## Changes

- `/notes` now opens the Error Log. The old `/mistake-notebook` address redirects to `/notes`, and navigation labels now say Error log.
- The Error Log page includes its own Add errors action with subject, Paper Structure lesson, text, paste, drag/drop, and multi-image upload support.
- The obsolete standalone Notes workspace was removed. Lesson PDFs, images, and videos remain available from Paper Structure as Lesson resources.
- The Assistant's Tools button, tool palettes, Error Log modal shortcut, and visible General AI mode pill were removed. A source indicator is shown only while a PDF is actually locked.
- Current clients delete videos through `/api/admin/videos/{videoId}`.
- The lesson-resource DELETE API now recognizes historical synthetic IDs such as `video-Z5Iv7KQt0YrxOxPDg7Ge`, archives the real video/source records, and returns success instead of 404. This also repairs cached older browser bundles.
- The notification trigger accepts one or many UIDs/emails, deduplicates recipients, resolves emails through Firebase Auth, enforces a 100-recipient limit, validates content, and uses one idempotent notification ID for the batch.
- The admin console has a bulk-notification form with local validation and delivery/missing-recipient feedback.
- Students now have a notification inbox with an unread badge, mark-one and mark-all actions, focus/visibility refresh, and 60-second foreground polling.
- Mark-all writes are chunked to remain below Firestore batch limits, and notification API errors no longer expose backend exception text.
- Lesson-resource upload feedback no longer fires duplicate success messages, and remaining Notes wording in Paper Structure search/actions was changed to Lesson resources.

## Verification

| Gate | Result |
|---|---|
| Application and scripts TypeScript | Pass |
| Source and regression suites | Pass |
| Knowledge routing suites | Pass |
| Security and capability suites | Pass |
| Secure video suites | Pass |
| AI evaluations | 600/600 pass |
| Dependency audit | 0 vulnerabilities |
| Vite production bundle | Pass |
| CommonJS Express bundle | Pass |
| Self-contained Vercel runtime | Pass, 49 imports verified |
| Isolated Vercel ESM/API boot smoke | Pass |
| V10–V35 production-repair assertions | Pass |
| Browser mobile/auth smoke | Not executed: Chromium is unavailable in this environment |

No production deployment was performed in this repair workspace.
