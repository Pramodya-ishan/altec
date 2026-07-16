# 2026-07-16 repair build

## Authentication

- Removed the production hard-code that changed Firebase `authDomain` to the Vercel domain.
- Removed the Vercel proxy rewrite for `/__/auth/*`.
- Added popup-blocked redirect fallback and boot-time redirect-result handling.
- Prevented duplicate sign-in requests and stale Google access-token reuse.
- Added readable sign-in errors and a new clean, unbranded sign-in modal.

## AI answer integrity

- Exact-PDF handoff now clears tentative streamed text and replaces it with one authoritative answer.
- Final answers replace the message instead of being appended as a second answer.
- Hidden `_Reasoning_`, chain-of-thought labels, embedded source labels and repeated long paragraphs are removed.
- Direct-PDF results are normalized at browser, server, cache and rendering boundaries.
- Correction feedback no longer appears as part of the answer before the verified answer.

## Sinhala rendering

- Normalizes malformed yansaya/rakaransaya sequences to canonical ZWJ shaping.
- Prioritizes Noto Sans Sinhala and makes form controls inherit the same font.
- Removes joiners only inside math expressions so KaTeX remains stable.
