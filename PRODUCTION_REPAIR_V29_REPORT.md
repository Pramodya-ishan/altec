# Production Repair V29 — Sinhala Past-Paper Forecast UI

## Scope

The repository was audited across `src`, `server`, `api`, and `scripts` (61,275 source lines). The complete tree received an automated pattern and dependency scan, followed by manual review of the critical chat, prediction, PDF preview, image-generation, answer-completion, persistence, and rendering pipelines.

The visual design decisions were compared against the uploaded Sri Lankan A/L SFT and ICT papers from 2018–2024. The recurring paper conventions used by this repair are: restrained black-and-white line work, question number and text kept together, subparts on separate lines, marks aligned separately, and diagrams/tables placed directly below the question that refers to them.

## Root causes found

1. The forecast route recognized only explicit `SFT`, `ET`, or `ICT`; a request containing “electrical” could inherit the active SFT tab.
2. Prediction generation did not lock the requested lesson, allowing a higher-ranked unrelated lesson to replace it.
3. Question text and generated images were emitted as one long Markdown response, producing giant duplicated visuals and poor placement.
4. Image generation explicitly prohibited Sinhala labels and forced Latin/ASCII labels.
5. Deterministic fallback SVGs stripped every non-ASCII character and used colourful dashboard styling instead of examination styling.
6. Prediction image generation blocked the whole response before any answer was shown.
7. The main chat client buffered every SSE token until `done`, then replayed a fake typing animation.
8. A failed quality-verifier score converted a structurally complete answer into `ANSWER_INCOMPLETE`, causing the manual “complete the rest” banner.
9. Compact `(a)`, `(b)`, `(i)`, `(ii)` question parts were not separated reliably.
10. User attachment metadata omitted `isImage`, and user-message UI rendered only file-name chips.
11. Uploaded PDFs had no first-page chat preview.
12. Updated prediction images could fail to repaint because the message memo comparator checked only visual-block count.
13. Prediction visual blocks were not persisted in chat history.

## Implemented repairs

### Forecast subject and lesson lock

- Added deterministic SFT/ET/ICT and lesson inference.
- “electrical” now routes to ET Electrical Technology even when the active tab is SFT.
- Specific aliases resolve Electrical Machines, Electronics, Civil, Production, Automobile, Drawing, Surveying, Fluid Machinery, ICT Database, Python, Networking, and common SFT lessons.
- Requested lesson/topic is injected as a hard generation constraint.
- A repair pass rejects a returned question set that violates the requested lesson lock.
- Stored question metadata is normalized to the requested lesson so the card cannot show a mismatched subject/lesson heading.

### Past-paper-based image question pipeline

- Calibrated evidence now carries source page number and crop metadata.
- The image generator receives the relevant past-paper crop as a geometry/layout reference when indexed evidence provides one.
- The generated question remains new practice material; the system does not reproduce an entire copyrighted page.
- Single-question visual forecasts are instructed to use a meaningful diagram, graph, table, circuit, apparatus, or engineering drawing.
- A deterministic exam-style SVG appears immediately, while an enhanced reference-guided image is attempted with a bounded timeout.

### Sinhala Unicode visual safety

- Removed the instruction that prohibited Sinhala inside diagrams.
- Exact supplied Sinhala Unicode labels are preserved.
- Legacy-font ASCII, transliteration, and garbled glyph conversion are explicitly forbidden.
- Fallback SVGs use Unicode-safe Sinhala labels and a Sinhala-capable CSS font stack without bundling custom font files.
- Fallback visuals are now white-page, thin black-line examination diagrams rather than colourful AI cards.

### Real paper-style question UI

- Added a dedicated `prediction_question_card` visual block.
- Question number and first text appear together, matching printed-paper structure.
- Marks remain separately aligned.
- Main paragraphs and `(a)/(b)/(i)/(ii)/(iii)` subparts receive readable spacing.
- Question image is placed directly after the question at a bounded size (`max-height: 460px`) and is never stretched full-width.
- MCQ options use a compact two-column paper layout where space permits.
- Prediction priority/evidence details are moved to a small footer instead of interrupting the question.
- Cards are shown before the short AI summary, preventing duplicated giant Markdown images.

### Upload preview repair

- Image uploads preserve `isImage` and `dataUrl` in the sent user message.
- Uploaded images render as bounded previews inside the chat bubble.
- Uploaded PDFs request a first-page preview after indexing and update the chat attachment asynchronously.
- Preview creation no longer delays the upload-success state.
- Non-previewable files retain a compact file card.

### Faster and complete answer delivery

- SSE tokens now become visible approximately every 28 ms while the model is writing.
- Removed the second fake typing pass that previously started only after the server completed.
- Prediction text and an immediate paper-style fallback visual are emitted before enhanced image generation.
- Existing automatic continuation support remains enabled for genuinely truncated model output.
- Quality-verifier warnings no longer mark a structurally complete response as interrupted.
- The manual continuation banner is now reserved for genuine unresolved truncation after automatic continuation attempts.

### Persistence and repaint fixes

- Prediction visual blocks are stored with chat history and restored on reload.
- Visual-block array identity is observed by the memoized message component, so fallback-to-enhanced image replacement repaints correctly even when block count is unchanged.

## Files changed

- `server/ai/respondStream.ts`
- `server/ai-core/exam-intel/forecastIntent.ts` (new)
- `server/ai-core/exam-intel/calibratedForecast.ts`
- `server/ai-core/exam-intel/predictedPaper.ts`
- `server/ai-core/exam-intel/predictionVisual.ts`
- `server/image/generate.ts`
- `src/lib/visualBlocks.ts`
- `src/lib/markdown/normalizeAnswerMarkdown.ts`
- `src/components/ui/VisualBlockRenderer.tsx`
- `src/components/ui/clora/CloraMessageBubble.tsx`
- `src/components/views/CloraXView.tsx`
- prediction, forecast-intent, and Markdown regression tests
- `package.json` test registration

## Deployment note

The ZIP is a source-deployment package for Vercel. Compiled `dist` output is intentionally omitted; Vercel rebuilds it from `package.json`. The self-contained verified Vercel API runtime is included. No standalone font files are included in the handoff archive.

Artifact verification
---------------------
PASS  ZIP integrity test
PASS  SHA-256 checksum created
PASS  No standalone font files included
