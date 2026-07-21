# Production Repair V33 — Full Project

## Base
V33 is built from the complete V32 source project, not a patch-only archive.

## Implemented changes

### PDF question preview
- Added Question / Page view modes when crop metadata exists.
- The Question mode can apply the detected crop client-side even when a preview endpoint returns a full page.
- Added stable zoom reset when switching view modes.
- Preserved the full-page control as a fallback for inaccurate crop metadata.

### AI tools drawer
- Replaced the non-clickable `@ tools` hint with a real Tools button.
- Clicking the button opens a grouped professional tool drawer.
- Added focused tools for:
  - subject/lesson-wise Guessing
  - realistic or exam-line-art image creation
  - Sinhala video explanation planning
  - clear step-by-step explanation
  - PDF library search
  - Error Log
  - web/deep search
  - file attachment
  - personalized tutor mode

### Command routing
- Added `@guessing`, `@video`, `@explain`, and `@personalize` command parsing.
- Kept aliases for existing `@web`, `@deep`, `@image`, `@pdf`, and file tools.
- Guessing requests carry the active subject and require official indexed evidence.
- Image requests retain the existing image-generation endpoint and PDF visual-reference support.
- Video requests produce a syllabus-grounded Sinhala narration/storyboard package and do not falsely claim that a rendered video exists.

### Error Log lesson connection
- Error Log lesson suggestions now include the actual Paper Structure topics stored for the selected subject.
- Fallback lesson suggestions remain available when the learner has no saved Paper Structure data.

### Personalization
- Added a local personalization context for language, explanation depth, weak lessons, voice preference, and maximum lesson-video duration.
- The context is appended as teaching-style guidance without allowing the AI to invent marks, papers, or personal facts.

## Validation
- TypeScript/TSX syntactic transpilation passed for every changed source file.
- Full archive integrity test passed.
- Full dependency-based production build was not rerun in this environment because npm dependency installation exceeded the execution window; the complete package-lock and build scripts are included for deployment CI.
