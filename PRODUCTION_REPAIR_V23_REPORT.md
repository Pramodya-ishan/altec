# ALTEC Production Repair v23

Date: 2026-07-20

## Outcome

v23 upgrades the learner AI from a single-pass chat response into an evidence-aware exam workflow with deterministic verification, document intelligence, adaptive learning, calibrated forecasting, and durable PDF processing controls.

## AI answer reliability

- Added an answer contract and independent quality review before delivery.
- Added deterministic checking for requested subparts, visible mark allocation, answer depth, units, signs/directions, arithmetic equalities, and common scientific calculations such as `sin`, `cos`, `tan`, and `sqrt`.
- Incomplete or failed verification triggers full-answer repair/continuation; incomplete answers remain explicitly recoverable instead of being presented as complete.
- Added truthful answer provenance: `Official source answer`, `AI-solved from source`, `Prediction — not guaranteed`, `AI model question`, or `General AI answer`.
- Only verified, complete PDF answers and stable memories enter trusted caches.

## Source and PDF trust

- PDF/OCR/web text is treated as untrusted data. Embedded prompt injection, prompt-exfiltration, secret requests, role impersonation, and unsafe external-action instructions are removed before model use.
- Source-locked turns cannot silently use a different saved PDF. A new unrelated question uses General AI for that turn while preserving the explicit PDF lock for later PDF follow-ups.
- Added visible Source locked / General AI mode and an explicit Unlock PDF control.
- Low-confidence OCR, review-required pages, and unindexed documents are blocked from strict source answers.
- Added page, character-offset, and bounding-box evidence contracts, citation labels, and multi-source contradiction alerts.
- The PDF preview endpoint returns a valid degraded SVG preview instead of HTTP 500 when the native renderer is unavailable.
- Added cooperative PDF job pause, resume, retry, progress, and retry-limit controls.
- Added visual-region extraction for tables, graphs, diagrams, equations, and technical drawings.

## Images and Sinhala

- “Explain with an image” routes to the real image-generation endpoint; ASCII/code-art is prohibited.
- Sinhala prose/captions remain outside the raster image to avoid corrupted Sinhala glyphs.
- Raster content uses safe variables, arrows, numbers, SI units, and short Latin labels.
- Existing download/regenerate controls remain available, and verified PDF crops can be supplied as image references.

## Exam intelligence

- Replaced unconstrained model guessing with a calibrated 2026 forecast based on indexed frequency, distinct years, recency/rotation gap, syllabus weight, coverage, and verified source ratio.
- Every forecast includes a bounded probability, confidence score, confidence interval, sample size, evidence list, study priority, skip risk, and an explicit “not leaked or guaranteed” disclaimer.
- Full-paper lesson/point mapping remains document-wide and reports question labels, lesson, concepts, skills, difficulty, marks, visual need, and page evidence.

## Adaptive learner intelligence

- Added a per-user concept knowledge graph using softened Beta-Bernoulli mastery updates.
- Added adaptive practice ranking, spaced-review due dates, error-category counts, progressive four-level hints, and explanation-strategy switching.
- Expanded mistake categories for sign/direction, diagram interpretation, and reading errors.
- Added a strict two-subject-per-day planner with weakness and exam-urgency weighting.

## Operations and UI

- Added an admin data-quality endpoint and dashboard for OCR, low-confidence text, missing metadata, duplicates, visual review, and unindexed sources.
- Added source region/citation display, answer provenance badges, contradiction warnings, PDF job pause/resume controls, and source-mode state.
- Added verified-only memory/cache policy and kept Pro final writer + independent reviewer routing.

## Verification

- TypeScript application and scripts: passed.
- Full repository test suite: passed.
- Golden AI evaluation suite: 600/600 passed across arithmetic, prompt-injection defense, strict source readiness, visual regions, calibrated forecasts, and exact two-subject plans.
- Production frontend/server build: passed.
- Self-contained Vercel ESM runtime build, dependency verification, and isolated boot smoke test: passed.

## Deployment data/configuration still required

The code is complete, but production quality depends on deployment configuration and source data:

1. Enable Cloud Vision OCR (`ENABLE_CLOUD_VISION_OCR=true` or `OCR_ENABLED=true`) for scanned/legacy Sinhala papers.
2. Configure the intended Firestore database ID and Vertex/Firebase service identity in Vercel.
3. Reprocess sources marked `needs_ocr`, `low_confidence_text`, or `not_indexed` in PDF Intelligence.
4. Rebuild `exam_question_index` after adding or repairing papers; forecasts deliberately refuse to fabricate evidence when the index is empty.
5. Add verified official marking schemes where available; AI-solved answers remain clearly labelled until then.
