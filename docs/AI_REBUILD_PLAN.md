# AI Core Rebuild Plan - Evidence-First Engine

## 1. Data Structures & Types
- **File:** `server/ai-core/evidence/evidenceTypes.ts`
- **Addition:** Add `validationStatus: "valid" | "rejected" | "needs_review"` and `extractionMethod`.

## 2. Intent Parsing (Refinement)
- **File:** `server/ai-core/intent/paperQuestionParser.ts`
- **Goal:** Ensure "025" -> "2025" and Sinhala year strings are handled.
- **Goal:** Differentiate between "vaguely asking about a year" and "asking for a specific question number".

## 3. Strict Source Locking
- **File:** `server/ai-core/sources/sourceResolver.ts`
- **Action:** If `isPaperQuestion` is true, enforce a `-1000` score for any source that doesn't match the year/subject.
- **Action:** Prevent any RAG retrieval from "alternative" sources if a strict match is found but is unreadable.

## 4. Evidence Gate Implementation
- **File:** `server/ai-core/evidence/evidenceGate.ts`
- **Logic:**
  - If `questionType === 'MCQ'`, `options` must be present.
  - `questionText` must contain at least 2 relevant keywords from the user prompt.
  - If `source.resourceType === 'marking_scheme'`, the answer must be labeled as "Official".

## 5. Zero-GCS Direct PDF QA (Verification)
- **Path:** Frontend `askDirectPdfQa` -> Backend `POST /api/pdf/direct-qa`.
- **Backend:** Must use `askGeminiDirectPdfStructured` from `server/ai-core/pdf/directPdfQa.ts`.
- **Validation:** Call `validateQuestionEvidence` before returning to frontend.

## 6. Feedback & Quarantine
- **Endpoint:** `POST /api/ai/feedback/wrong-answer`.
- **Logic:**
  - Update `pdf_question_cache` doc for that question to `rejected: true`.
  - Delete/Invalidate any `rag_chunks` with `extractionMethod: "gemini_direct_pdf_qa"` for that source+question.

## 7. Formatting & Sanity Fixes
- **Firestore:** Use `removeUndefinedDeep` in `saveFinalChat`.
- **KaTeX:** Update `mathSanitizer.ts` to unwrap any block containing `[\u0D80-\u0DFF]`.
- **Recharts:** Ensure `ResponsiveChartShell.tsx` uses `ResizeObserver` with a > 0 check.
- **OAuth:** Remove `calendar` and `drive` scopes from `GoogleAuthProvider` in `AppContext.tsx`.

## 8. Acceptance Tests
- **Test A:** "2025 sft mcq 10" -> Must pick 2025 SFT source.
- **Test B:** "Wrong" -> Next response must admit lack of evidence, not guess.
- **Test C:** Direct PDF QA -> Check server logs for `googleapis.com/oauth2/v4/token` (should be absent).
