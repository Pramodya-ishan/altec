# 300-feature integration status — 2026-07-16

All 300 requested capabilities are now represented by a typed, searchable
platform catalog in `shared/platform/featureCatalog.ts` and the admin-only
**Feature Center** route (`/feature-center`). The catalog deliberately separates
three delivery states:

- **Available** — an end-to-end path already exists in the project.
- **Foundation** — schema/service/API support exists, but every UI and production
  acceptance flow is not complete yet.
- **Planned** — the capability remains explicitly tracked and disabled rather
  than being presented as finished.

Current generated catalog totals:

- Available: **158**
- Foundation: **81**
- Planned: **61**
- Total: **300**

These counts are generated and regression-tested. They are not a claim that all
300 items are production-complete.

## New implementation in this release

### Feature governance and platform visibility

- Added the complete 300-item typed registry and JSON export.
- Added `npm run generate:features` to regenerate the registry from the original
  request document.
- Added authenticated platform APIs:
  - `GET /api/platform/capabilities`
  - `GET /api/platform/health`
  - `GET /api/platform/source-review-queue` (admin/ops)
- Added the searchable/filterable admin Feature Center page.

### PDF and OCR intelligence

- Added automatic resource-title cleanup.
- Added subject, year, medium, paper/marking-scheme type, question-type and
  teacher-name detection.
- Added SHA-256 duplicate fingerprints and duplicate source linking.
- Added PDF header/EOF validation, corruption-risk scoring, text-completeness
  scoring, OCR-confidence review flags and low-confidence page lists.
- Stored quality and detected metadata on source records during indexing.
- Added invalid-PDF signature rejection before expensive extraction/OCR work.
- Fixed Sinhala token normalization to preserve Unicode combining marks.

### Learning engine

Added authenticated APIs for:

- attempt history and automatic mistake-notebook updates;
- guessing, misconception, formula, calculation, unit and significant-figure
  issue detection;
- spaced-repetition scheduling and revision queue;
- personalized multi-day revision plans;
- marking-point grounded partial grading;
- missing-point feedback and alternative-answer matching;
- five-question daily quiz selection without exposing answers;
- question bookmarks and difficult-question collections.

Routes:

- `POST /api/learning/attempts`
- `GET /api/learning/revision-queue`
- `POST /api/learning/revision-plan`
- `POST /api/learning/grade`
- `GET /api/learning/daily-quiz`
- `POST /api/learning/bookmarks`

### Reliability and observability

- Added browser GET/HEAD request deduplication.
- Added safe automatic retries for idempotent requests.
- Added timeout handling and `Retry-After` support.
- Added request IDs across browser and backend requests.
- Added structured failure/request-duration logging without exposing tokens or
  private prompt content.

## Verification

- TypeScript lint: passed.
- Existing source, knowledge, PDF-QA, security and secure-video tests: passed.
- New feature-catalog, document-intelligence and learning-engine tests: passed.
- Vite production/PWA build: passed.
- Self-contained Vercel runtime verification and smoke test: passed.

## Remaining work

The 61 items marked `planned` need separate production work, external services,
or operational changes. Examples include antivirus scanning, account-wide
session revocation, handwritten marking, a secure Python sandbox, full SEO page
generation and real synthetic monitoring. The Feature Center keeps these items
visible without falsely enabling them.
