# 300-feature foundation release

## Added

- Typed catalog for all 300 requested features.
- Admin Feature Center UI and platform capability/health APIs.
- PDF metadata classification, quality reports, duplicate detection and OCR
  review flags.
- Learning attempts, spaced repetition, revision plans, rubric grading, daily
  quizzes and bookmarks APIs.
- Client request deduplication, retry, timeout and Retry-After handling.
- Backend request IDs and structured request logging.
- New regression tests for the feature catalog, document intelligence and
  learning engine.

## Changed

- PDF indexing persists detected metadata and quality information.
- Sinhala token normalization now preserves combining marks, improving Sinhala
  lesson resolution and marking-point matching.
- Admin navigation includes Feature Center.

## Important

The registry distinguishes available, foundation and planned states. It does
not label all 300 items as production-complete.
