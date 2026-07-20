# ALTEC Production Repair V24

## Outcome

V24 keeps every V23 production repair and adds deterministic conversational routing, strict selected-paper question-type preservation, stronger Essay question extraction, source-lock isolation, hidden internal quality UI, and failure-source cleanup.

## User-visible fixes

- Removed the `AI-verified complete` / `AI-verified and corrected` badge text and its container. Quality checks still run internally.
- Short identity, capability, acknowledgement, wellbeing, thanks, and creator questions use a deterministic fast path. They no longer invoke paper search, answer planning, quality review, or unrelated educational suggestions.
- The creator name is configurable with optional `APP_CREATOR_NAME`; the existing default remains `Pramodya Ishan`.
- `guessing papr 1 essay ...` and similar romanized/typo source names now resolve to the intended saved Essay PDF.
- A follow-up such as `q6` preserves the selected PDF's stored `ESSAY` type. A router default can no longer silently change it to `MCQ`; an explicit current-turn type such as `mcq 6` still wins.
- Locked-source short question follow-ups bypass the LLM intent router and go directly to deterministic PDF question routing.
- An unrelated question no longer inherits the locked PDF's source ID, year, question type, source badge, or retrieval context.
- Failed Direct PDF answers clear source cards, so an error message no longer displays a misleading `Sources 1` action.
- Automatic incomplete-answer recovery now permits three continuation passes in both standard and Pro flows.

## PDF / Essay reliability

- Added exact marker support for `Question No. 06`, `Question Number 6`, `Essay 06`, `Structured 06`, `Q6`, `(6)`, and Sinhala numbered-question headers.
- Exact matching remains fail-closed and does not treat a page number such as `Page 6 of 20` as Question 6.
- Indexed text, local PDF text, and OCR-ready text use the same exact-question window selector.
- The selector includes the page/chunk before the marker and the next two continuation pages/chunks, which captures multi-page Essay main questions.
- Whole-PDF vision recognizes equivalent question-number formats and automatically performs one exhaustive second locator pass when the first pass is missing question text or MCQ options.
- Essay/Structured extraction never requires MCQ options.

## Image explanation and existing V23 repairs retained

- Natural prompts such as `මේක රූපයක් සමඟ පැහැදිලි කරන්න` and `meka image ekkin explain krnn` use real image generation instead of ASCII/code diagrams.
- Generated-image failures remain explicit and retryable.
- Error Log image records, legacy Sinhala normalization, PDF preview routing, OCR jobs, source security, evidence contracts, answer completeness, and internal quality repair remain included from V23.

## Changed areas

- `server/ai/fastConversation.ts`
- `server/ai/respondStream.ts`
- `server/ai/sourceSelection.ts`
- `server/ai/prompts.ts`
- `server/ai-core/pdf/directPdfQa.ts`
- `server/ai-core/pdf/indexedQuestionSelection.ts`
- `server/pdf/routes.ts`
- `src/hooks/useAIWorkflowStream.ts`
- `src/components/views/CloraXView.tsx`
- `src/components/ui/clora/CloraMessageBubble.tsx`
- regression tests and production verifier

## Verification

- `npm test`: passed
- AI evaluations: 600/600 passed
- `npm run typecheck:app`: passed
- `npm run typecheck:scripts`: passed
- `npm run build`: passed
- `npm run build:vercel`: passed
- isolated Vercel ESM boot/API smoke test: passed
- `npm run verify:repair`: passed

The Vercel build verifies a self-contained runtime containing the PDF route, PDF.js worker, Google protobuf assets, and native PDF preview assets.

## Deployment

Use the deploy ZIP when importing/deploying without a local dependency install. It contains the built frontend and self-contained `vercel-runtime`. Do not upload both the code ZIP and deploy ZIP as one project.

No new required environment variable was added. `APP_CREATOR_NAME` is optional. Cloud OCR should remain enabled in production for large scanned PDFs; bounded Gemini document vision remains the fallback when OCR is unavailable.
