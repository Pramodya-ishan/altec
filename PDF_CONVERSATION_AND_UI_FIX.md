# PDF conversation and UI fix

## Fixed behavior

- A lesson PDF search now persists the first exact match as the selected source.
- `1`, `Q1`, `question 1`, `eke prashna karamu`, and equivalent short follow-ups retain that selected PDF.
- Question requests use the authenticated Direct PDF QA pipeline; answers are not generated from templates when the source cannot be read.
- Source buttons use authenticated `openSourcePdf()` instead of opening protected API URLs in a tokenless browser tab.
- Firebase Google sign-in uses popup auth with explicit local persistence. A temporary server session bootstrap failure no longer discards a valid Firebase login.
- Auth, navigation, source panels and assistant surfaces use the shared neutral white visual language.

## Expected conversation

1. `tharala pdf`
2. Assistant returns the exact saved source and selects it.
3. `1` confirms/continues with that source.
4. `Q1` triggers a secure scan of that PDF and answers from the document.

## Firebase Console requirement

Add `tecal.vercel.app` under Firebase Authentication > Settings > Authorized domains and enable the Google provider. After deploying a changed PWA, unregister the old service worker once and clear site data.
