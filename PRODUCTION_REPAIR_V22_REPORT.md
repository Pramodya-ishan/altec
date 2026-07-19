# Production Repair V22

## Outcome

V22 separates saved-PDF context from ordinary AI conversation, routes future-paper predictions to analysis instead of filename matching, and makes “explain with an image” produce a real generated visual rather than ASCII art.

## Source-lock and routing repair

- A selected PDF remains available for explicit requests such as `q1`, `essay 2`, `මේ PDF එකේ...`, and exact saved names such as `Guessing 01 Essay`.
- A new standalone lesson, calculation, visual request, or other topic is no longer filtered through the previously locked source.
- Stale PDF/Error Log choice lists are cancelled when the student starts a substantive new request, preventing a later number from selecting an unrelated old record.
- Named-source matching now requires an actual file/source identity. The words “guessing” and “paper” alone cannot open or list saved PDFs.

## Future-paper prediction repair

- Requests such as `2026 al paper ekt enna puuluwn ... guessing ...` are deterministically classified as past-paper analysis.
- The future-paper detector takes priority over the official-paper gate and over saved `Guessing` PDF matching.
- A prediction may use the broader evidence library without being restricted to the PDF selected in an earlier turn.

## Real visual explanations

- Sinhala, English, and Singlish forms of “explain this with an image/diagram” enter the actual image-generation flow.
- Attached-image analysis such as “explain this image” remains image understanding, not accidental regeneration.
- The UI rejects a nominally successful image response that has no preview URL, displays a useful retry error, and preserves generated-image storage/model metadata.
- Answer instructions prohibit ASCII-art diagrams and code-block imitations when the student requested a visual.

## AI completeness retained

V22 preserves the V21 Planner → Solver → automatic continuation → independent reviewer → full replacement workflow. Incomplete or quality-failed answers remain explicitly incomplete and are not promoted to long-term learning memory.

## Verification

- Focused image-intent, source-selection, and paper-routing regressions: passed.
- Application and script TypeScript: passed.
- Complete source, knowledge, security, and video test suite: passed.
- Production repair static verification: passed.
- Production frontend and bundled Express backend build: passed (3,296 modules transformed).
- Self-contained Vercel runtime build, import verification, pure-ESM boot, and JSON API smoke check: passed.
- Browser visual E2E was configured but skipped because this container does not include `/usr/bin/chromium`; production build and API runtime smoke verification passed independently.
