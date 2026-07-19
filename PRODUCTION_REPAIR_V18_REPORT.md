# Production Repair V18 Report

## Scope

V18 repairs the saved Error Log, chat header/history controls, legacy FM-Abhaya Sinhala extraction, strict SFT syllabus grounding, structured/essay completion, and Z-score history preservation. It also includes regressions discovered while integrating those changes.

## Completed repairs

### Error Log
- Reads mistake records from both `users/{uid}/mistake_notebook` and the legacy `users/{email}/mistake_notebook` path.
- Normalizes, deduplicates, sorts, and returns the actual saved record count.
- Recognizes Sinhala, English, typo, and Singlish Error Log requests such as `erorrlog` and `wrdina`.
- Provides a deterministic response from saved data instead of allowing the model to claim the notebook is empty.
- Refreshes AI context when a mistake is saved.

### Chat controls
- Removed the visible `Clora X` label.
- Added adjacent New chat, Clear, and History actions in the assistant top navigation.
- Clear chat stops active streaming/audio and clears saved history, replies, attachments, and selected PDF context.
- Chat history loads saved conversations and restores a selected conversation.

### Legacy Sinhala PDFs and pasted text
- Detects FM-Abhaya and extractor-corrupted legacy Sinhala.
- Repairs common PDF extraction spacing and `3⁄4` corruption.
- Converts trusted text to normalized Sinhala Unicode.
- Rejects low-confidence conversion so gibberish never enters RAG.
- Forces OCR/document vision for unreliable legacy pages.
- Pasted low-confidence legacy text cannot be guessed from general model memory.

### SFT evidence boundary
- Evidence priority is: matching Lesson Resources, official SFT syllabus, then approved SFT resource books.
- Question papers, guessing papers, and marking metadata are not used as theory sources unless explicitly appropriate.
- Generic non-SFT biology/chemistry concepts are blocked unless present in the verified question or approved SFT evidence.
- Terms such as cork cambium, phellem, phelloderm, and periderm are not introduced unless explicitly supported by approved evidence.

### Complete answers
- Structured/essay subparts are extracted and tracked.
- The model receives the required subpart labels.
- Incomplete first answers trigger a complete replacement attempt.
- Remaining missing subparts are shown honestly instead of silently truncating or fabricating content.
- Completion status propagates through Direct PDF QA, cache, client types, and answer formatting.

### Z-score history
- Merges saved-paper and predictor histories without deleting either source.
- Deduplicates and sorts entries.
- Prioritizes real saved-paper estimates over predictor estimates for the same date.
- Preserves up to 1,000 normalized history points.

### Additional integration repair
- Source ranking now passes structured subject/year/type/keyword filters rather than a raw prompt string.
- Existing authentication, PDF maintenance, project upload, KaTeX, security, and unlimited-capacity protections remain intact.

## Deployment note

The source and Vercel runtime were built locally. Live Firebase reads/writes, OCR, Gemini document vision, and production credentials were not executed in this environment. Validate on a Vercel Preview before production promotion.
