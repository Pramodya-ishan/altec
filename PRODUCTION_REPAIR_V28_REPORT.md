# Production Repair V28 — Long Answers, Original PDF UI, Z-score History, Paper Moves, Charts

## Scope

This release focuses on long AI/PDF answers and the data/UI issues reported from the live application.

## 1. Long AI answers

- Removed application-imposed output-token ceilings from the main streaming answer path.
- Removed the fixed 12,288-token ceiling from the non-stream answer path.
- Removed fixed output ceilings from substantive Direct PDF solving, full generated papers, and full-paper outline mapping.
- Added automatic completion recovery for up to 12 passes (`AI_AUTO_CONTINUATION_PASSES=12`).
- `AI_MAX_OUTPUT_TOKENS` is empty by default. It remains an optional emergency operator limit.
- Provider/model context-window limits still apply; incomplete generations are continued automatically rather than silently cut off.

Internal short JSON tasks such as planning, reviewing, memory extraction, and follow-up suggestions retain small limits because they are not learner-facing answers.

## 2. Original PDF question UI

- Direct PDF evidence now records `questionRegion`, covering the full printed question block rather than only a diagram.
- The assistant shows the original PDF crop/page before the written answer.
- Tables, drawings, graphs, dimensions, labels, subparts, and allocated marks are preserved as the original rendered PDF image.
- Added a paper-style preview card with source/page metadata, zoom controls, scrolling, and open-original action.
- Preview rasterization no longer blocks the answer. The verified answer starts immediately while the exact preview loads asynchronously.
- Indexed-PDF fast answers emit preview metadata within the same stream, avoiding a second answer request.

## 3. Z-score history

- Removed day-level replacement behavior.
- Multiple meaningful predictor changes on the same day are retained chronologically.
- Unchanged autosaves are deduplicated using calculated values, preventing write loops.
- Server history merging preserves timestamp-level points and retains up to 1,000 records.
- Same-day charts show time labels; longer histories show dates.

## 4. Move papers between collections

- Added a direct collection selector on every manageable paper card.
- Papers can be moved between:
  - A/L Past Papers
  - Model Papers
  - Marking Schemes
- Moving updates `past_papers`, `rag_sources`, `lesson_resources`, and indexed chunk metadata through the existing PATCH route.
- Added `Structured` as a supported paper type alongside MCQ, Essay, and Full Paper.

## 5. Graph hover/UI fixes

- Recharts tooltips are constrained to the chart viewport.
- Disabled tooltip escape on X and Y axes.
- Added safe chart margins, maximum tooltip width, wrapping, non-interactive hover cards, and no tooltip transition drift.
- Applied the repair to Z-score and all paper-mark charts.

## Verification

- TypeScript application check: passed.
- TypeScript scripts check: passed.
- Source/PDF/Z-score regression suite: passed.
- Production repair static verification: passed.
- Vite production build: passed.
- Self-contained Vercel runtime verification: passed.
- Isolated Vercel runtime smoke boot: passed.

The build reports existing large-chunk optimization warnings only; they are not compilation or deployment failures.
