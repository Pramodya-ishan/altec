# Production Repair V21

## Outcome

V21 turns the answer pipeline into a fail-closed Planner → Solver → Completion Recovery → Independent Quality Reviewer → Repair Writer workflow. It also repairs the Direct PDF path, question preview failures, scanned/legacy Sinhala ingestion, full-paper mapping, Error Log image review, adaptive practice, and operational visibility.

## AI answer quality and incomplete-response repair

- Added a Pro answer planner that converts every substantive prompt into an auditable requirement, structure, calculation, evidence, visual, and language checklist.
- Added an explicit answer contract covering every requested subpart, marking-point depth, formulas, substitution, SI units, sign/direction, source support, Unicode Sinhala, and closed Markdown/math.
- Retained up to three automatic continuation passes for model truncation, broken streams, unfinished sentences, open delimiters, and missing explicit subparts.
- Added an independent Pro reviewer after the draft is complete. It checks coverage, factual risks, numerical work, citations/evidence, and formatting.
- Failed reviews trigger one full replacement answer, not a continuation fragment. The replacement is independently reviewed again before it can be marked complete.
- Added `answer_replace` and `quality_report` stream events plus a UI verification badge.
- Incomplete, interrupted, or quality-failed answers remain saved but are marked incomplete and expose a continuation action. Long-term memory is not extracted from them.

## Direct PDF and paper answers

- Fixed the Direct PDF client incorrectly forcing `completed: true` for failed and partial responses.
- Added a fail-closed Direct PDF completeness report. An extracted question without a substantive answer is incomplete.
- Structured/essay questions detect A/B/C and i/ii/... labels; every readable subpart must be answered before success.
- The essay solver receives the exact verified question, syllabus boundary, expected labels, and a second replacement attempt listing missing labels.
- Exact question-number routing remains locked to the selected source; it does not interpret the first page/chunk as Q1.
- Added a regression for the terse request `2025 guessing 1 pdf q1` and dedicated direct-PDF extraction-only/partial-essay regressions.
- Expanded full-paper outlines to include lesson, point, subparts, competency, difficulty, marks, required visuals, skills, formulae, and confidence.

## PDF preview, OCR, and document intelligence

- `POST /api/pdf/question-preview` no longer returns HTTP 500 when native rendering, Storage caching, or URL signing fails. It returns either an inline PNG crop or an explicit inline SVG fallback while preserving verified text evidence.
- Added a page-level OCR ensemble across native PDF text, trusted legacy conversion, Cloud Vision, and Gemini PDF vision. The best candidate is selected per page with low-confidence and provider-disagreement warnings.
- Added durable Firestore PDF jobs with stages, progress, attempts, retryability, typed failures, status polling, one automatic browser retry, and a server retry limit.
- Added document classification, per-page quality, low-confidence pages, human-review flags, file fingerprints, and duplicate-source detection.
- Automatic OCR and the Pro OCR fallback are enabled in the production environment template.

## Sinhala and educational visuals

- Legacy FM-Abhaya-like text is normalized only when conversion confidence is sufficient; otherwise the app asks for the original PDF/image instead of inventing unreadable text.
- Mechanics questions automatically receive a native SVG free-body diagram when mass/force/angle/surface evidence is present.
- Formula cards, reaction relationships, process flows, PDF crops, and saved Error Log images render as structured UI blocks.
- Generated raster-image prompts explicitly prohibit Sinhala text inside the bitmap. Sinhala explanations stay as correct Unicode HTML outside the image.
- Generated images include download, regenerate, and retry controls and their outcomes are recorded in quality telemetry.

## Error Log and adaptive learning

- Saved mistake images are served through an authenticated endpoint and previewed in both the Error Log page and AI revision answers.
- Added mastery score, error category, attempt count, correct streak, easiness factor, interval, next review date, and an SM-2-inspired due queue.
- The Error Log UI shows due/mastered/average-mastery summaries and records “Need practice” / “Got it” reviews without drifting counters.
- Mounted the previously implemented learning and platform routes, enabling marking-point grading, daily/adaptive practice, revision queues, capability discovery, and document review queues.

## Observability and operations

- Added rolling and best-effort Firestore telemetry for answer completion, automatic continuation, quality pass/repair, latency, PDF preview fallback, and image generation.
- Replaced fake PDF admin metrics with real completion rate, quality pass/repair rate, preview success/fallbacks, P95 latency, and recent failures.
- Updated the production environment template with planner, reviewer, telemetry, three continuation passes, automatic OCR, Pro OCR model, and bounded direct-PDF settings.

## Verification

- Application TypeScript: passed.
- Script TypeScript: passed.
- Complete source, knowledge, security, and video regression suite: passed.
- Production repair static verification: passed.
- Production Vite build: passed (3,296 modules transformed).
- Self-contained Vercel runtime build/verification/smoke boot: passed, including PDF.js worker, native canvas assets, Google protobufs, pure-ESM boot, and JSON API handling without root `node_modules`.
- Chromium visual E2E is configured to run when Chromium is installed; this container has no Chromium binary, so that optional visual check was skipped rather than reported as an application failure.

## Deployment requirements

Use `.env.example` as the source of truth. Production still requires valid Google/Firebase credentials, Firestore database ID, Storage/OCR buckets and IAM, Firebase App Check configuration, and enabled Vertex AI / Vision APIs. No live deployment is performed by this repair archive.
