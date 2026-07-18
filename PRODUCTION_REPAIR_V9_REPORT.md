# Clora X Production Repair V9

## Scope

V9 repairs the Sinhala answer display, removes the visible PDF verification banner, makes the official SFT syllabus the authoritative scope boundary, restores legacy lesson resources, adds a seeded SFT reference library, strengthens evidence-based revision forecasts, and keeps image generation routed through the configured Gemini/Nano Banana-compatible image models.

## Implemented repairs

### Sinhala output

- Normalizes streamed and completed answers with Unicode NFKC/NFC.
- Repairs common broken Sinhala conjuncts such as ප්‍ර, ක්‍ර, ද්‍ර, ව්‍ය, ධ්‍ය, විද්‍යා, ප්‍රශ්න, ප්‍රතික්‍රියා, ද්‍රාවණ and සාන්ද්‍රණ.
- Buffers incomplete streamed Sinhala join sequences so the UI does not render broken half-characters.
- Uses `lang="si"`, Noto Sans Sinhala, safe line wrapping, and readable paragraph spacing.

### Direct PDF answers

- Removes the visible `Verified PDF · year · MCQ · page` evidence container.
- Keeps provenance internally and exposes sources through the normal Sources control.
- When the marking scheme answer is unavailable, the verified question is solved using the official syllabus and retrieved approved evidence rather than returning an unavailable-answer template.
- Does not present an AI-solved answer as an official marking-scheme answer.

### Authoritative SFT grounding

- Uses the stable Firebase Storage object path for `sALSyl_SFT.pdf`; the expiring signed URL is not stored in source code.
- Bundles `assets/authoritative/sft/sALSyl_SFT.pdf` into the Vercel server runtime as an offline fallback.
- Attaches the authoritative syllabus to normal SFT answers, direct PDF solving, and prediction generation.
- Prevents importing unrelated standalone A/L Biology, Chemistry, Physics, or Mathematics material unless it exists in the SFT syllabus or approved SFT resources.

### SFT reference library

Included seed sources:

- Official SFT syllabus
- SFT Mathematics Book 1
- SFT Chemistry Book 1
- SFT Biology Book
- SFT Physics Book 2
- Grade 12 SFT Resource Book

Run `npm run seed:sft-reference-library` in an authenticated environment to upload, register, and index them. The script creates official/shared RAG sources; it does not expose private Assistant uploads.

### Lesson resources

- Merges authoritative `lesson_resources`, legacy `rag_sources`, personal syllabus resources, and published videos.
- Supports historical upper-, lower-, and mixed-case subject values.
- Uses tolerant lesson ID/title matching for punctuation, Unicode, spacing, and renamed lessons.
- Preserves visible resources during temporary refresh failures.
- Keeps upload, delete, publish, priority, reprocess, and OCR actions restricted to content managers.

### Image generation

- Natural image requests are routed to `/api/image/generate` instead of producing a text-only refusal.
- Tries configured Nano Banana/Gemini image models and an Imagen fallback.
- Stores generated images in Firebase Storage when credentials are available and returns a signed preview.
- Uses the previous answer as bounded educational context and asks for short, correctly spelled Sinhala labels.

### 2026 revision forecasts

- Uses the official subject syllabus, `exam_question_index`, past papers, marking schemes, model papers, guessing papers, paper-structure resources, recency, rotation, and student weak areas.
- Produces new revision questions with lesson, subtopic, marks, marking points, evidence source IDs, and confidence.
- Forecasts are explicitly revision guidance and never claimed to be the real or guaranteed 2026 examination paper.

### Branding

- Assistant identity and visible empty-chat branding use `Clora X · Made by Pramodya Ishan`.

## Production data commands

Run after deploying with Firebase Admin/Vertex credentials:

```bash
npm run migrate:lesson-resources
npm run seed:sft-reference-library
npm run build:exam-index
```

Recommended production environment:

```env
SFT_SYLLABUS_STORAGE_PATH=users/7kUEmzikv8hat7KQg8pCNGR1ZUd2/syllabus/SFT/syllabus/general/2deba588-86ac-4393-b001-c6fe657a48c3/sALSyl_SFT.pdf
ENABLE_IMAGE_GENERATION=true
DISABLE_IMAGE_GENERATION=false
NANO_BANANA_MODEL=gemini-2.5-flash-image
NANO_BANANA_PRO_MODEL=gemini-3-pro-image-preview
```

Use model IDs supported by the configured Google project if those aliases change.

## Verification

Passed locally:

- `npm ci --include=dev`
- `npm run check:npm-registry`
- `npm run typecheck`
- `npm test`
- `npm run verify:repair`
- `npm run build:vercel`
- Vercel runtime asset verification
- Isolated pure-ESM server boot smoke test
- ZIP integrity test

The built runtime includes `server.mjs`, `pdf.worker.mjs`, Google protobuf assets, native PDF-preview assets, and the authoritative SFT syllabus PDF.

## Production-only verification still required

A real Gemini image-generation request, Firebase Storage write, Firestore migration/seed, and production account visibility test require the project credentials and cannot be completed in the local sandbox. Verify these on a Vercel Preview before promotion.
