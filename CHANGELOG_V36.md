# Tec A/L V36

## Product experience

- Rebuilt the application shell around a restrained white/off-white system with accessible blue, green, amber, and red states.
- Replaced the desktop sidebar with compact and expanded modes, clearer hierarchy, and stable role-based navigation.
- Replaced the six-column mobile bar with five 44 px+ targets: Plan, Errors, Study, Marks, and More.
- Added a mobile More sheet for Past Papers, Z-score, profile, syllabus, and administrator routes.
- Rebuilt the top bar and moved Conversation History and Clear Conversation into a compact overflow menu.
- Removed the visible “AI Assistant” product treatment and renamed the learning surface Study Desk.
- Added GSAP route and content reveals using only opacity and transforms, with reduced-motion support and cleanup.
- Consolidated visual tokens, spacing, radii, focus states, shadows, typography, and responsive behavior.

## Error Log

- Rebuilt Error Log as an image-first revision workspace.
- Added responsive summary metrics, search, subject filtering, due status, mastery progress, and scheduled-review feedback.
- Added authenticated full-image opening and clear unavailable-image states.
- Added a direct “Review at Study Desk” handoff that targets the exact saved record ID.
- Preserved image-only legacy records and UID/email legacy-path merging.

## Saved-image assistant repair

- “give error log” followed by “with images” now renders the already-saved images inside the conversation.
- A combined “give my Error Log with images” request now lists records and renders their image previews in one response.
- Added English, Sinhala, and Singlish image-follow-up recognition.
- The assistant no longer asks the learner to re-upload an image that is already stored.
- Legacy image records without a MIME type now infer JPEG, PNG, WebP, or GIF safely.
- Selected saved-image records are exposed to the UI even when model-side image reading fails, so the learner gets a truthful preview/error state.
- Exact Error Log record IDs can now be selected from the Error Log-to-Study Desk handoff.

## Existing production repairs retained

- Legacy `video-{id}` lesson-resource deletion resolves the real video record instead of returning the reported 404.
- Bulk notifications remain bounded, deduplicated, validated, role-protected, and return delivered/missing counts.
- Published lesson resources use authenticated API access while personal files remain owner-only.
- Admin and content routes retain role gates, upload limits, App Check, safe keyboard focus, and route splitting.

## Verification

- TypeScript application and script checks: passed.
- Source, knowledge, security, video, and AI suites: passed.
- AI evaluations: 600/600 passed.
- Production dependency audit: 0 vulnerabilities.
- Frontend and CommonJS server production build: passed.
- Self-contained Vercel runtime build, verification, and isolated boot: passed.
- Production repair static manifest: passed through V35 checks plus the V36 navigation and Study Desk contract.
- Automated browser screenshots were not available in the build workspace because neither `agent-browser` nor a Chromium executable was installed. The Vite production preview server did start successfully.
