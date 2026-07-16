# Full-paper OCR and chat UI fixes — 2026-07-16

## Paper question answering

- Paper-question requests now use the locked paper source and scan its complete OCR/native-text index.
- If the complete index cannot safely isolate the requested question, the backend scans the complete original PDF visually.
- Exact question boundaries are detected before answering, so adjacent questions and unrelated OCR chunks are not displayed.
- MCQ extraction requires a readable question and at least four ordered options before answer generation.
- Unsafe version-3 cached extractions are ignored; new verified evidence uses evidence version 4.
- The chat response contains only the requested question, options, validated answer, and explanation.
- Internal source state, fallback metadata, synthetic answer banners, and synthetic mark allocations are no longer rendered in the answer body.

## Sinhala text

- Removes an orphan Sinhala virama emitted at the beginning of OCR words.
- Preserves canonical yansaya and rakaransaya shaping.

## Interface

- The scroll-to-latest button is now the compact `↓` control.
- Route changes use smooth fade/translate transitions with reduced-motion support.

## Regression coverage

- Added a full-paper extraction regression test that verifies Q5 is isolated without leaking Q4 or Q6.
- Added checks that the compact answer formatter does not render internal response metadata.
