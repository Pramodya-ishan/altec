# Tec A/L Production Repair V7

Date: 2026-07-18

## Outcome

V7 replaces the Direct PDF QA dead end with a syllabus-grounded answer pipeline, adds real natural-language image generation, adds secure PDF-page image previews, corrects Sinhala rendering, and simplifies the Assistant answer UI to a clean ChatGPT-style layout.

The application no longer returns “The question was found in the PDF, but a confirmed answer was not available.” when a verified question is present but an official marking-scheme answer is absent. It now uses the verified question, its answer choices, relevant indexed lesson material, and the relevant subject syllabus to produce a clearly labelled AI-solved answer. It claims an official answer only when official scheme evidence is actually available.

## Direct PDF QA

- Added `server/ai-core/pdf/solveExtractedQuestion.ts`.
- Verified question text and choices remain the primary evidence.
- Relevant SFT, ET, or ICT syllabus material is attached when available.
- Indexed lesson and syllabus chunks are retrieved before model generation.
- Answers are cached with source and page metadata.
- Missing official schemes no longer block a useful answer.
- Exact past-paper answers are never presented as official unless verified by an official scheme.
- Visual questions bypass text-only indexed answers and use the direct visual extraction path.

## PDF image previews

- Added `server/pdf/questionPreview.ts`.
- Relevant PDF page regions can be rendered to PNG with PDF.js and `@napi-rs/canvas`.
- Generated crops are stored under `pdf_question_previews/{uid}/{sourceId}/...`.
- Source access is verified before rendering.
- Preview links use short-lived signed URLs.
- The client securely refreshes an expired preview URL rather than leaving a broken image.
- Preview-generation failure is nonfatal; the text answer remains available.

## Image generation

- Added natural-language image intent detection in `server/ai/imageIntent.ts`.
- Requests such as “create an image explaining this in Sinhala” now invoke image generation rather than returning a capability refusal.
- Supports Gemini image models and Imagen-style models through the existing Google AI configuration.
- Generated files are saved in Firebase Storage under `generated_images/{uid}/...` with Firestore metadata.
- Recent answer context, subject, and source evidence are used to create useful educational diagrams.
- `DISABLE_IMAGE_GENERATION=true` is the explicit emergency kill switch.

## Sinhala and answer presentation

- Expanded Sinhala Unicode normalization for malformed conjuncts such as `ප්ර`, `ශ්ර`, `ධ්ය`, and `ත්යා`.
- Long answers are divided into readable paragraphs without splitting equations or answer options.
- Removed the oversized green evidence card.
- Removed the dark blue text-diagram/blockquote presentation.
- Source evidence is shown as a compact inline row.
- Assistant output is plain, full-width, responsive content without an AI-style bordered card.
- Images render as normal responsive figures rather than inside oversized containers.
- Tables and code blocks scroll internally on narrow screens.

## Vercel runtime

The Vercel runtime now includes:

- `vercel-runtime/server.mjs`
- `vercel-runtime/pdf.worker.mjs`
- `vercel-runtime/google-gax-protos/`
- `vercel-runtime/node_modules/@napi-rs/canvas/`
- `vercel-runtime/node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node`

The native canvas dependency is copied deliberately because PDF page rendering cannot rely on a browser canvas inside a Vercel Node function. This increases the packaged runtime size, but it prevents the PDF crop endpoint from failing at runtime.

## npm registry safety

`package-lock.json` contains public `registry.npmjs.org` URLs and no `packages.applied-caas-gateway1.internal.api.openai.org` references. The Vercel install command remains pinned to the public npm registry, and `scripts/check-npm-registry.mjs` fails the build if a private registry URL is introduced again.

## Production variables

Recommended image settings:

```env
ENABLE_IMAGE_GENERATION=true
DISABLE_IMAGE_GENERATION=false
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

`GEMINI_IMAGE_PRO_MODEL` may be configured when an approved higher-quality image model is available. Existing Google AI or Vertex credentials must be valid in the selected production environment.

Optional subject-syllabus configuration can point to published SFT, ET, and ICT syllabus sources through the subject-specific syllabus URL/path variables documented in `.env.example`. When these are omitted, the resolver searches accessible published syllabus sources in the existing content catalog.

## Verification completed

The following commands passed against the final source tree:

```text
npm run check:npm-registry
npm run typecheck
npm test
npm run build:vercel
npm run verify:repair
```

The isolated Vercel runtime boot test passed. The native PDF crop test created a real PDF, rendered a crop, and validated the resulting PNG. The API smoke test reached authentication for Direct PDF QA and did not return `API_NOT_FOUND`.

Final frontend bundles include:

```text
dist/assets/index-BnPRbsoF.js
dist/assets/firebase-BCa7H10T.js
```

## Verification boundary

Automated tests used controlled local fixtures and an isolated Vercel runtime. A real Gemini/Imagen generation request and a real Firebase Storage write were not executed because production credentials are not present in this workspace. Those integrations must be smoke-tested in a protected Preview deployment before promotion to Production.

## Deployment

This package has not been deployed from this environment. Deploy it as a Preview first, confirm Direct PDF QA, PDF cropping, Firebase Storage writes, image generation, and mobile rendering with authenticated test users, then promote the verified deployment to Production.

## Use of uploaded reference files

The uploaded model/tool reference files were treated as untrusted reference material. Only suitable product concepts—source-grounded answers, direct response structure, explicit tool invocation, and image-generation workflows—were adapted. Vendor identities, hidden system instructions, unsupported model claims, and unrelated behavioral rules were not copied into the application.
