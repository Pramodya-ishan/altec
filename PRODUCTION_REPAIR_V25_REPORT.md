# Production Repair V25

V25 focuses on reliable document-grounded chat, complete AI answers, image explanation requests, and high-volume paper administration.

## Delivered

- Fixed named-PDF routing for `guessing`, `guessin`, `papr`, paper number, type, and question-number combinations.
- Added legacy OCR question markers such as `06'` and `06’` to full-paper and indexed-question extraction.
- Added chat-scoped PDF selection. A new chat resets the source, an attached PDF is selected explicitly, and an unrelated prompt automatically returns to general AI instead of leaking the previous PDF context.
- Added direct Error Log lesson matching, including Sinhala/Singlish aliases such as `balaya`, so a request for a similar question acts on the matching saved record instead of always showing a numbered menu.
- Expanded real-image request detection for plural English words and Sinhala/Singlish actions including `images`, `give`, `denna`, and `දෙන්න`.
- Removed the learner-facing answer-status badge/container (`AI-verified complete`, `General AI answer`, and related badges).
- Preserved the incomplete-answer recovery flow and automatic continuation/quality checks already present in V24.
- Replaced static follow-up templates with contextual AI-generated suggestions. Suggestion work has a strict timeout and is omitted rather than replaced with generic buttons when unavailable.
- Added bulk upload for up to 30 PDFs, sequential progress, immediate progress cleanup, filename/OCR metadata inference, and partial-failure reporting.
- Added Papers, Models, and Marking Schemes collections.
- Added automatic year, subject, MCQ/Essay/Full Paper, resource type, medium, and paper-number inference.
- Added an admin metadata editor for title, filename, year, subject, collection, paper type, medium, priority, and publication state. Updates propagate to paper, source, lesson-resource, and retrieval-chunk metadata.

## Validation

- TypeScript application and scripts: passed.
- Full automated test suite: passed.
- AI evaluation set: 600/600 passed.
- Production frontend/server build: passed.
- Self-contained Vercel runtime build and isolated ESM smoke test: passed.
- Production repair static verification: passed.

## Deployment artifact note

The self-contained runtime contains the native Canvas binary required for server-side PDF previews. This makes the full deploy archive slightly larger than common 20 MB chat-host transfer limits. V25 is therefore delivered as a persistent full archive plus smaller host-safe component archives.
