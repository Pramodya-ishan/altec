# Production Repair V26

V26 adds an evidence-calibrated 2026 A/L revision-forecast system for SFT, ET and ICT. Forecast scores are revision priorities, not claims that an exact future examination question is known.

## Delivered

- Added subject-specific SFT, ET and ICT prediction profiles covering calculations, engineering drawings, circuits, graphs, experiments, flowcharts, networks, ERDs and logic diagrams.
- Added a syllabus-corpus loader that discovers every accessible approved syllabus PDF, attaches as many as the model/runtime can safely accept, includes indexed syllabus text, and reports discovered, attached, indexed and skipped coverage instead of silently claiming complete coverage.
- Added official-source reliability weighting. Official syllabuses, past papers and marking schemes outweigh model papers; guessing/prediction PDFs are excluded by default to prevent circular predictions and are an admin-only opt-in.
- Added calibrated topic ranking using syllabus weight, official-weighted frequency, rotation gap, recent trend, marks, visual patterns and source quality. Scores are capped below certainty and include confidence intervals and evidence sufficiency.
- Added leave-one-year-out historical backtesting with precision, recall and hit-rate reporting.
- Added a 1–5 member independent review committee for historical patterns, syllabus coverage, adversarial overfitting checks, visuals and calibration.
- Added actual question-image generation for image-dependent questions. If the image model is unavailable, a deterministic SVG diagram is returned; a required image is never silently rendered as a text-only question.
- Added short English/symbol-only in-image label rules and external Sinhala captions/alt text to avoid corrupted Sinhala inside generated diagrams.
- Added full marking schemes, answer keys, evidence IDs, per-question priority/confidence, source reasons and generated-image metadata.
- Added automatic JSON repair/retry when a paper-generation response is empty, truncated or has too few questions.
- Added a complete Prediction Papers dashboard: subject/year/mode/paper-type controls, marks and question counts, image quota, analysis-pass count, admin defaults, syllabus coverage, topic rankings, paper, marking scheme, evidence and backtest tabs, JSON download, and Print/Save PDF.
- Added chat routing that distinguishes an exact saved PDF request such as `Guessing 01 Essay PDF q6` from a new request such as `2026 A/L එකට එන්න පුළුවන් SFT ප්‍රශ්නයක්`.
- New forecast requests clear unrelated old PDF locks, generate a fresh evidence-based paper, attach real images, and return contextual next-action suggestions.
- Prevented ordinary users from overriding admin prediction weights or enabling circular guessing-paper evidence through a crafted API body.

## Accuracy statement

No system can honestly provide a 100% or “1000% correct” future-paper guarantee. V26 improves defensibility through official source weighting, syllabus coverage reporting, historical backtesting, independent review and uncertainty labels. It explicitly rejects leaked/official/guaranteed wording.

## Validation

- TypeScript application and scripts: passed.
- Full automated test suite: passed.
- AI evaluation set: 600/600 passed.
- Prediction policy, source weighting, backtest and deterministic-image tests: passed.
- Source-lock/forecast routing regression tests: passed.
- Production frontend/server build: passed.
- Self-contained Vercel runtime build and isolated pure-ESM smoke test: passed.
- Production repair static verification: passed.

## Runtime notes

- Syllabus coverage is limited only by access permissions and explicit model/runtime document and byte limits; the UI/API exposes omissions.
- AI image generation remains the preferred path. The deterministic SVG fallback keeps image-based questions usable during a provider outage.
- The full deploy archive includes the native Canvas/PDF runtime and may exceed small chat transfer limits; smaller application and runtime archives are provided separately.
