# Production Repair V19

Date: 2026-07-19

## Completed fixes

- Fixed `/api/pdf/question-preview` so Firebase Storage upload or signed-URL IAM failures no longer become a generic HTTP 500. The endpoint now returns a bounded inline PNG fallback when its private cache is unavailable.
- Kept PDF crops sharp while bounding their longest rendered edge to reduce serverless response size.
- Added visual-dependency detection for diagrams, engineering drawings, projections, dimensions, graphs, tables, and question wording such as “පහත දැක්වෙන”. These questions cannot be answered from text-only chunks.
- Added verified visual descriptions (labels, dimensions, geometry, axes, and values) to the document-vision extraction result and the syllabus-bounded solver input.
- Made local PDF.js parser failure non-fatal. The locked PDF can continue through Gemini document vision instead of returning a parser template error.
- Rejects stale cached evidence that contains legacy-font Sinhala or omits required diagram evidence.
- Converts trustworthy legacy Sinhala question/options to Unicode and rejects low-confidence legacy output instead of displaying gibberish.
- Added full selected-paper lesson/point mapping. “full paper/PDF lesson name and point name wise” now analyzes all questions and sub-sections instead of replying with the currently selected question.
- Fixed Error Log numeric follow-ups. A reply such as `2` now selects Error Log record 2 before an active PDF can interpret it as PDF question 2.
- Error Log images are loaded as authenticated bytes for Gemini vision; they no longer depend on `gs://` model access or a signed public URL.
- Added an authenticated Error Log image endpoint and blob-based React previews with cleanup/abort handling.
- Added exact, programmatic SFT mechanics/free-body diagrams for force and friction questions. Sinhala captions are browser-rendered rather than baked into unreliable AI raster text.
- Removed false “Solution flow” cards made from numbered question subparts and prevented interrogative lines from being labelled as a “Key formula”.
- Localized automatic visual titles/captions to Sinhala when the conversation is Sinhala-first.
- Corrected malformed friction LaTeX such as `\mus` to `\mu_s` before KaTeX rendering.
- Image generation can now reuse the verified PDF question crop. Generated rasters are instructed to use symbols/numbers/SI units rather than corrupted Sinhala glyphs; Sinhala explanation remains real Unicode UI text outside the raster.
- Fixed multimodal prompt assembly so adding a syllabus PDF no longer causes Error Log context to be written onto the wrong content part.

## Verification

- `npm run typecheck:app` — passed
- `npm run typecheck:scripts` — passed
- `npm test` — passed (source, PDF, knowledge, security, and video suites)
- `npm run verify:repair` — passed
- `npm run build:vercel` — passed
- Isolated Vercel ESM runtime boot and JSON API smoke verification — passed

The browser automation binary could not launch its daemon in this restricted workspace, so final UI confidence is based on TypeScript, component review, Vite production compilation, and Vercel runtime smoke verification.
