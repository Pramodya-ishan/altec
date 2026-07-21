# Production Repair V32 — Notes Page Simplification

Date: 2026-07-21
Base: V31 AI Hardening

## Requested removals

The Notes page no longer displays or maintains the inline lesson-note editor UI:

- `Lesson notes`
- `Saved to your subject progress and available from this lesson.`
- character counter such as `0 characters`
- note textarea and its placeholder
- `Save notes` button

The duplicate page introduction was removed:

- `Lesson workspace`
- duplicate `Notes` heading
- the long Notes workspace description

The page-level SFT / ET / ICT selector was also removed. Subject selection now comes only from the application's existing global subject selector, preventing two competing subject toggles on the Notes page.

## Preserved functionality

- lesson search and lesson selection
- completion indicator per lesson
- PDF, image, and video lesson library
- upload, drag-and-drop, and clipboard paste
- upload progress
- resource opening, video playback, and authorized deletion
- Paper Structure lesson linkage

## Files changed

- `src/components/views/NotesView.tsx`
- regenerated production `dist/` assets

## Verification

- application and scripts TypeScript checks passed
- production repair static verification passed
- Vite production build passed with 3,297 transformed modules
- removed text and local subject-toggle source scans passed
