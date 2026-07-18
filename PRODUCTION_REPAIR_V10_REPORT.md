# Clora X Production Repair V10

Date: 2026-07-18
Base: Clora X V9 production-repair source
Creator branding: Clora X · Made by Pramodya Ishan

## Repair objective

This release prevents Clora from inventing questions or answers when a user selects a saved Guessing, Model, or Past Paper PDF. A selected PDF now remains locked across short follow-ups such as `1`, `q1`, `?`, `next`, and replies to earlier messages. SFT answers are constrained by the official SFT syllabus and the supplied SFT reference books.

## Exact PDF source lock

- Added deterministic named-source ranking for requests such as `guessing 1 essay q1`.
- Added deterministic numbered selection after a source list.
- Stored the selected source ID, title, subject, year, question type, and pending choices in conversation state.
- Preserved the active PDF across short follow-up messages.
- Removed arbitrary “first matching PDF” and “first indexed chunks” fallbacks.
- A requested question number is accepted only when the extracted text contains a real question marker.
- Page position is never treated as the question number.
- If exact evidence cannot be extracted, Clora reports that it cannot verify the question instead of constructing a similar question.

## Fake-answer prevention

- Direct PDF QA now validates exact question evidence before calling the answer model.
- Essay answers are generated only for subparts that are visible in the extracted question.
- Cached PDF answers require evidence version 3.
- Rejected or invalidated caches are never reused.
- User correction feedback can invalidate an incorrect cached answer.
- Old V9 answers that lack the new evidence version are ignored.

## Authoritative SFT grounding

The production runtime includes these supplied references:

- Official SFT syllabus: `sALSyl_SFT.pdf`
- `SFT Maths book 1.pdf`
- `SFT Chemistry Book 1.pdf`
- `SFT Bio Book.pdf`
- `SFT Physics book2.pdf`
- `sGr12OM SFT ResourceBookNew.pdf`

The configured Firebase/GCS storage paths are used on Vertex AI. Bundled local copies are used as a runtime fallback. Expiring signed URLs are not stored as permanent source identifiers.

For an SFT question, Clora receives the official SFT syllabus plus only the relevant SFT reference books. The solver must return an explicit syllabus-scope decision. When the content cannot be verified inside the SFT syllabus, it returns no invented answer.

## Sinhala rendering repair

- Preserved the Sinhala zero-width joiner in ordinary prose.
- Limited zero-width-character cleanup to mathematical segments.
- Normalized malformed Sinhala conjuncts on the server and client.
- Prevented duplicated arrows such as `→ →`.
- Kept long Sinhala answers in readable paragraphs.

## Assistant UI repair

- The large “Verified PDF · year · MCQ · page” evidence container is not generated in Assistant answers.
- Inventory-only PDF candidates are excluded from the visible answer source count.
- Source lists are capped and numbered for reliable selection.
- The final answer remains a plain, full-width chat response.

## PDF extraction behavior

1. Resolve and authorize the exact selected source.
2. Reuse valid version-3 extracted evidence when available.
3. Search indexed chunks for an exact question marker.
4. Try native PDF extraction when text is usable.
5. Use visual PDF extraction or OCR for scanned/legacy-font documents.
6. Solve only after exact question evidence is validated.
7. Cache the evidence-linked result as version 3.

## Production notes

A live Gemini request, Firebase Storage read, and Firestore conversation-state write were not executed locally because production credentials were not available. The self-contained Vercel runtime booted successfully in production mode without root `node_modules`.

Before promoting to production, verify with two accounts:

- Select `Guessing 01 Essay`, then send `1`, `?`, and `next`; every response must remain tied to that PDF.
- Ask for a question absent from the selected PDF; Clora must refuse to invent it.
- Mark a wrong response as incorrect and repeat the request; the rejected cache must not return.
- Confirm SFT answers cite only the SFT syllabus/reference corpus.
- Confirm Sinhala conjuncts render correctly on Chrome Android and desktop Chrome.
