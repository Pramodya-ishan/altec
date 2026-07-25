# ALTEC Production Repair V34

Date: 2026-07-25

## Outcome

This repair addresses the production failure paths found across the React/Vite client, Express API, Firebase authorization, PDF ingestion, AI response flow, and Vercel runtime. Forty-two source/configuration files changed, with obsolete AI-template and browser-persistence modules removed.

The request to “find 1000+ issues” was treated as a broad audit target, not as a number to manufacture. The archive contained 1,178 entries, but defects are reported only when they were reproduced or supported by code evidence.

## Major repairs

- Shared lesson and paper PDFs now open through the authenticated API instead of owner-only Firebase download URLs.
- Personal Knowledge Base files use an owner-only Storage path that matches `storage.rules`.
- TTS files have an explicit owner-read Storage rule.
- Failed ingestion removes the newly uploaded, still-unregistered object to prevent orphaned files.
- Express PDF uploads are limited to one PDF and 50 MB, with structured 413/415 responses.
- Administrator workspaces have client role guards in addition to server authorization.
- The admin support console no longer enumerates or overwrites Firestore from the browser. Exact-email lookups and edits use the audited server workflow.
- The stale Vercel runtime directory is recreated on every bundle, preventing old authoritative PDFs from surviving into a deployment.
- AI canned greetings, deterministic conversational templates, welcome messages, suggestion chips, suggestion SSE events, and suggestion-generation calls were removed.
- Client-side tutor personalization no longer stores learning preferences in `localStorage`; server-owned user context remains the personalization source.
- Keyboard focus indicators are visible, interactive text is semantic, blocking alerts were replaced with notifications, and key mobile controls meet a 40–44 px target.
- Font Awesome is bundled locally instead of loading a CSP-blocked CDN.
- Server PDF fallback paths no longer use `import.meta.url` in the CommonJS build.
- Large workspaces are route-lazy. The main application entry is approximately 297 KB uncompressed.
- React, React Router, Firebase, Firebase Admin, Multer, Google GAX, and related transitive dependencies were updated. `npm audit` reports zero known vulnerabilities.

## Verification

| Gate | Result |
|---|---|
| Application and scripts TypeScript | Pass |
| Source and regression suites | Pass |
| Knowledge routing suites | Pass |
| Security and capability suites | Pass |
| Secure video suites | Pass |
| AI evaluations | 600/600 pass |
| Dependency audit | 0 vulnerabilities |
| Vite production bundle | Pass |
| CommonJS Express bundle | Pass |
| Self-contained Vercel runtime | Pass, 49 imports verified |
| Isolated Vercel ESM/API boot smoke | Pass |
| V34 static production-repair assertions | Pass |
| Browser mobile overflow/auth test | Not executed: Chromium is unavailable in the build environment |

The browser test remains in `scripts/run-browser-e2e.mjs` and checks 320, 360, 375, 390, and 430 px viewports when Chromium is available.

## Deployment requirements

- Use Node.js 22.22 or newer.
- Deploy both `firestore.rules` and `storage.rules` with the application.
- Configure the documented Firebase, App Check, Vertex/Gemini, Storage, OCR, video, and allowed-origin variables in the deployment environment.
- Run `npm ci`, `npm test`, and `npm run build:vercel` before release.

