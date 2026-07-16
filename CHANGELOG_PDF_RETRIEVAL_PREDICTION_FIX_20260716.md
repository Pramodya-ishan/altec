# PDF retrieval, Q50 and prediction fixes — 2026-07-16

## Fixed user-visible failures

1. `2025 50 mcq eke answer eka` is now parsed as **2025 / SFT / MCQ 50**. Both `MCQ 50` and `50 MCQ` word orders are supported.
2. Official paper lookup now infers missing/stale source metadata from the filename/title:
   - subject: SFT / ET / ICT
   - year from title (title year overrides stale metadata)
   - past paper / marking scheme / syllabus / paper structure
3. Documents from the `past_papers` collection are treated as official/shared sources even when old records do not contain `visibility`.
4. Strict paper source selection now prefers the requested resource type and can use either a Storage path or a verified Firebase download URL.
5. Direct PDF QA no longer refuses a valid source only because `storagePath` is absent. It can derive the object path from a Firebase download URL.
6. The selected paper and question are saved in conversation state. `recheck` can reopen and rescan the same PDF/question without asking the user to upload a screenshot.
7. `recheck`, `check again`, `verify again` and Sinhala equivalents trigger authoritative PDF re-verification.
8. `give all pdfs` no longer prints a giant duplicated 65-line text dump. Duplicate records are merged and the response shows compact category counts while preserving source cards.
9. Duplicate PDF copies are merged by normalized title/year/subject/type, Storage object or Firebase URL.
10. Wrong metadata such as `2023 SFT Paper (2022)` or `2025 ... Full SM (2026)` is corrected from the year in the file title.
11. Prediction prompts such as `2026 paper ekt oya okkoma pdf use krl guessing denna` no longer become a literal lesson-PDF search.
12. A new `past_paper_analysis` route combines accessible past papers, marking schemes, syllabus and paper-structure evidence.
13. Prediction evidence uses the full `exam_question_index` when available, with frequency, recency and question-type statistics. It falls back to indexed PDF chunks.
14. If prediction indexes are genuinely unavailable, the UI receives `prediction_index_required` instead of the false message “save කරපු PDF එකක් හමු වුණේ නැහැ.”

## Main files changed

- `server/ai-core/intent/paperQuestionParser.ts`
- `server/knowledge/knowledgeRouter.ts`
- `server/knowledge/predictionEvidence.ts`
- `server/sources/sourceInventoryService.ts`
- `server/ai-core/sources/sourceResolver.ts`
- `server/ai/respondStream.ts`
- `server/pdf/routes.ts`
- `src/lib/ai/directPdfQa.ts`
- `src/hooks/useAIWorkflowStream.ts`
- `server/knowledge/__tests__/paperRoutingRegression.test.ts`

## Deployment note

Live PDF reading still requires the source record to contain either a valid Firebase Storage object path or a Firebase/Google Storage download URL, and the deployed service account must be able to read that object. The code now supports both paths and reports a real source-access error rather than claiming the PDF is absent.
