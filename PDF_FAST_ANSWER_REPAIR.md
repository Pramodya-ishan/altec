# Fast PDF Answer Repair

This repair reduces answer latency for questions asked from saved or selected PDFs while preserving the existing OCR and full-document fallbacks.

## What changed

- Answers cached in `pdf_question_cache` are returned immediately and also kept in a short-lived server memory cache.
- Indexed PDF questions are answered inside the original AI stream instead of ending the stream and forcing the browser to start a second direct-PDF request.
- Selecting a known PDF now performs direct document lookups instead of scanning every source collection.
- Independent Firestore inventory reads run concurrently.
- The common solver path uses small indexed syllabus excerpts and a Flash model first.
- Large syllabus/reference PDF attachments and the Pro model are used only when the fast answer is missing, invalid, or incomplete.
- The legacy OCR, scanned-document, visual extraction, and full PDF paths remain available as fallbacks.

## Optional environment controls

No new environment variable is required. These optional values can tune the behavior:

```env
PDF_FAST_ANSWER_MODE=true
INDEXED_PDF_QA_TIMEOUT_MS=20000
GEMINI_PDF_SOLVE_MODEL=gemini-3.5-flash
GEMINI_PDF_SOLVE_FALLBACK=gemini-2.5-flash
```

Set `PDF_FAST_ANSWER_MODE=false` only to restore the larger retrieval context on the first pass. Do not set an extremely long indexed timeout because the full PDF fallback should take over when indexed extraction stalls.

## Verification completed

- Full application TypeScript check
- Script TypeScript check
- Indexed-question selection tests
- Direct-PDF input tests
- Essay-completeness tests
- Response-hygiene tests
- Server PDF formatter smoke test
- Vercel production frontend build
- Self-contained Vercel runtime bundle verification and smoke boot
