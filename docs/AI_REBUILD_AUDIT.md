# AI Rebuild Audit - Clora X Evidence-First Core

## Status Summary
- **Source Lock**: Partially implemented, but leaks legacy fallbacks.
- **Direct PDF QA**: Failing with "Failed to fetch" (Likely Storage Rules/CORS).
- **Intent Parsing**: Buggy for "2025 SFT MCQ 2" (Year vs Question Number).
- **Cache**: Mismatched schemas between backend and structured extraction.
- **Evidence Gate**: Exists but is not wired into the main response flow.
- **Storage Rules**: Too restrictive for official papers.

## Component Audit

### 1. Intent & Parsing
- `server/ai-core/intent/paperQuestionParser.ts`: Regex needs to prioritize year vs number correctly.
- `server/knowledge/knowledgeRouter.ts`: Missing support for explicit MCQ patterns.

### 2. Sources & Locking
- `server/ai-core/sources/sourceResolver.ts`: Needs strict `allowedSourceIds` contract.
- `server/ai/respondStream.ts`: Needs to respect source lock and bypass legacy search when locked.

### 3. Evidence & Verification
- `server/ai-core/evidence/evidenceGate.ts`: Needs to be called before emitting any answer.
- `server/ai/answerVerifier.ts`: Needs strict validation of question text vs options.

### 4. Direct PDF QA (Frontend/Backend Handoff)
- `src/lib/ai/directPdfQa.ts`: Lacks detailed error stages.
- `storage.rules`: Authentication check prevents reading papers uploaded by admins.
- `/api/pdf/direct-qa`: Needs robust CORS and JSON-only error responses.

### 5. Data Persistence
- `pdf_question_cache`: Needs unified schema `{sourceId}_{questionType}_{questionNo}`.
- `chatSanitizer.ts`: Needs to handle deep undefined removal reliably.

### 6. UI & UX
- `CloraXView.tsx`: Reasoning panel shows candidates instead of evidence.
- `MessageRenderer.tsx`: KaTeX renders Sinhala characters.
- `ResponsiveChartShell.tsx`: width/height warnings.

## Fix Roadmap
1. [ ] Fix Storage Rules (Permission Denied for getBlob).
2. [ ] Add VITE_API_BASE_URL & SSE Event Metadata.
3. [ ] Improve `askDirectPdfQa` Diagnostics.
4. [ ] Fix Paper Question Parser Regex.
5. [ ] Wire Evidence Gate in `respondStream.ts`.
6. [ ] Unify Cache Schema & Quarantine logic.
7. [ ] Fix KaTeX Sinhala & Recharts warnings.
