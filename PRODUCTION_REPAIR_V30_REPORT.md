# Altec / Clora X Production Repair V30

## Scope

V30 repairs the disconnect between the **Past Papers** library and the Assistant, preserves paper context across short follow-up messages, strengthens generated-question visuals and paper formatting, adds bulk media workflows, and introduces a professional lesson-based **Notes** workspace.

Static review coverage:

- 394 source/configuration files
- 75,574 lines scanned across `src`, `server`, `scripts`, `shared`, `api`, and `app`
- 21 implementation/test files changed or added from V29

## Root causes found

### 1. Past Papers visible in the UI but unavailable to AI

The Past Papers page treated legacy `past_papers` rows without a `published` field as visible, while the Assistant inventory required an explicit published state. The same database record could therefore appear in the tab but be excluded from AI retrieval.

**Repair:** legacy past-paper rows are canonicalized in the shared source inventory. Unless explicitly unpublished, they receive student-visible official past-paper semantics. The Assistant now queries the same effective catalog as the Past Papers page.

### 2. Paper context disappeared on `2023 krmu`, `31 mcq`, or `q1`

The old parser primarily recognized question-type-before-number expressions such as `MCQ 31`. It did not reliably recognize number-before-type expressions such as `31 mcq`. The client also omitted the active subject from the AI request.

**Repair:** both forms are parsed; a selected paper stores source ID, title, subject, year, question type, lesson context, and strict evidence mode. Short follow-ups continue against that locked source. The active SFT/ET/ICT subject is now sent with every Assistant request.

### 3. The Assistant guessed paper availability instead of checking the library

Year-list and paper-selection conversations were being left to general model generation.

**Repair:** deterministic paper-catalog handling now:

- lists only years actually present in the user's accessible library;
- selects the real saved paper for requests such as `2024 ET ... කරමු` or `2023 කරමු`;
- excludes marking schemes when selecting the question paper;
- prefers official past papers over model/guess papers;
- saves the selected source before asking for a question number.

### 4. Guessing questions did not reliably receive an image

Visual creation depended too heavily on the model setting an optional image flag.

**Repair:** the visual-integrity layer inspects the requested lesson and question text. A single generated forecast question that naturally requires a circuit, graph, instrument scale, measurement diagram, or engineering drawing receives a deterministic paper-style visual fallback even when the model omitted the flag. AI enhancement may replace the fallback later without delaying the question.

### 5. Question parts and marks were glued into one paragraph

Generated content could contain `(a)`, `(b)`, `(i)`, `(ii)`, the next numbered question, and marks in a single continuous block.

**Repair:** both Markdown normalization and visual-question rendering now separate compact exam subparts, question boundaries, and mark labels while protecting math and code segments.

### 6. Chat and Error Log attachment workflows were incomplete

Chat supported file selection but not a complete drop/paste workflow. Error Log accepted only one image.

**Repair:**

- Chat composer accepts click selection, drag-and-drop, and clipboard-pasted images/files.
- Existing attachment cards continue to show image/PDF previews in the user's message.
- Error Log accepts up to 24 PNG/JPEG/WebP images at once.
- Error Log supports file selection, drag-and-drop, paste, queued previews, remove/clear, sequential upload, and partial-success reporting.
- Every uploaded image becomes a separate mistake record using the selected subject, lesson, and note.

### 7. No unified lesson notes and resources workspace

Lesson notes and Paper Structure resources were scattered across modal workflows.

**Repair:** added `/notes` with:

- SFT / ET / ICT subject toggle;
- all syllabus lessons and lesson search;
- per-lesson personal notes;
- PDF, image, and secure-video resource library;
- bulk selection, drag-and-drop, paste, upload progress, open/play/delete actions;
- the same normalized lesson ID and `/api/lesson-resources` backend used by Paper Structure;
- direct navigation back to the exact lesson card in Paper Structure.

The UI uses a restrained white/slate layout, clear hierarchy, bounded cards, accessible controls, responsive columns, and no decorative AI-style gradients.

### 8. False incomplete-response warnings

A substantial finished answer could still show an alarming incomplete-response card when a final continuation request made no progress or failed after usable content had already arrived.

**Repair:** hard truncation remains protected by automatic continuation. After the continuation budget, only residual heuristic/no-progress conditions are suppressed when the existing answer is already substantial. Genuine hard completeness failures still show the continuation action.

## Key implementation files

- `server/sources/sourceInventoryService.ts`
- `server/ai/paperCatalogContext.ts`
- `server/ai/respondStream.ts`
- `server/ai/sourceSelection.ts`
- `server/knowledge/knowledgeRouter.ts`
- `server/ai-core/exam-intel/predictionVisual.ts`
- `src/components/views/CloraXView.tsx`
- `src/components/ui/clora/CloraComposer.tsx`
- `src/components/modals/ErrorLogModal.tsx`
- `src/components/views/NotesView.tsx`
- `src/components/ui/VisualBlockRenderer.tsx`
- `src/lib/markdown/normalizeAnswerMarkdown.ts`
- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`

## Verification

- Application and script TypeScript checks passed.
- Source, PDF, OCR, direct-PDF, source-selection, paper-catalog, legacy visibility, answer-quality, formatting, Firebase mistake, and Z-score regression tests passed.
- Knowledge routing regression tests passed.
- Security and capability tests passed.
- Secure-video tests passed.
- AI evaluation suite: **600 / 600 passed**.
- Production repair verifier passed, including new V30 assertions.
- Vite production build passed: **3,297 modules transformed**.
- Self-contained Vercel runtime verification passed: **49 imports**.
- Isolated pure-ESM runtime boot and JSON API smoke test passed.

## Operational notes

- The Assistant can only retrieve a paper that the signed-in user is authorized to access.
- A scanned paper that has neither searchable chunks nor a completed OCR/direct-PDF path may still require processing before question-level extraction works.
- Shared Notes uploads remain permission-gated. Students can read resources and save personal notes; publishing/deleting shared lesson resources requires an authorized content role.
- Generated forecasts remain revision material, not official, leaked, or guaranteed exam questions.
