# 2025 Paper MCQ Quiz + Error Log Fix

## Implemented behavior

- Detects requests such as: `2025 SFT MCQ 1 idn 50 one by one ... error log`.
- Opens the locked official paper and displays only MCQ 1 first.
- Does not reveal the answer before the student responds.
- Accepts `1` to `5`, option text, `skip`, and `stop`.
- Checks the submitted answer against the server-side stored correct option.
- Automatically saves wrong answers into `users/{uid}/mistake_notebook`.
- Uses a deterministic question ID so repeating the same mistake increments `sameErrorCount` instead of creating duplicate entries.
- Stores question, options, selected answer, correct answer, explanation, paper/source metadata, and next revision date.
- Continues automatically to the next MCQ until the requested end number.
- Shows a final correct/wrong/skipped score summary.
- Correct answers are not exposed to the browser before submission.
- Removes duplicated answer markers such as `(4) (4) කන්නෙලිය ය.`.
- Restricts unsupported/speculative distractor explanations.

## Verification

- TypeScript lint passed.
- All repository tests passed.
- Added paper MCQ quiz regression tests.
- Production build passed.
- Vercel runtime build, verification, and smoke test passed.
