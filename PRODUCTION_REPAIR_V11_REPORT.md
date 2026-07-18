# Clora X Production Repair V11

## Status

V11 is the complete source-and-build package from the V10 audit repair pass. It contains source code, public assets, Firebase rules, migration and validation scripts, the frontend production build, and a self-contained Vercel API runtime. `node_modules` and secret `.env` files are intentionally excluded.

## Unlimited application access

Clora X no longer applies its own request-count limits. The compatibility limiter sets `X-Application-Rate-Limit: disabled` and never returns HTTP 429.

This does not bypass authentication, authorization, Firebase App Check, upload/body-size validation, Vercel infrastructure limits, Gemini/Firebase/Google quotas, billing availability, or provider backpressure. Those protections remain required.

## Critical security and privacy fixes

- Separated true administrator privileges from `content_editor`, `teacher`, and `ops` content-management capabilities.
- Restricted private user documents and subcollections to the owning UID, administrators, and operations support.
- Added deny-by-default Firestore and Storage catch-all rules.
- Disabled direct Firebase-client reads of shared Storage files; published access is resolved by authenticated server endpoints.
- Added Firebase App Check validation to protected API routes.
- Added secure Firebase HttpOnly session cookies.
- Removed client persistence of OAuth tokens, YouTube cookies, sessions, and user-progress data from `localStorage` and `sessionStorage`.
- Removed the legacy email-keyed local user database, bundled `data_users` files, default encryption key, and REST backup path.
- Removed the insecure legacy server implementation.
- Added HTTPS-only remote-PDF allowlisting, DNS/private-address rejection, byte limits, and `%PDF-` signature verification.
- Added MIME, size, and magic-byte validation for personal and shared uploads.
- Replaced the undeclared `uuid` package use with Node's built-in `crypto.randomUUID()`.
- Removed obsolete `@types/pdfjs-dist` and `@types/uuid` packages.

## Permissions

- Students cannot upload, publish, unpublish, delete, OCR, reprocess, or attach shared lesson resources.
- Only verified `admin`, `content_editor`, `teacher`, and `ops` roles can manage shared lesson content.
- Teachers and content editors do not gain private student-record access.
- Student visibility requires explicit publication and an allowed audience; source scope alone never publishes a resource.
- Personal Assistant uploads remain owner-only.

## Preserved product repairs

V11 retains the prior production repairs for Google authentication, mobile navigation, Sinhala rendering, exact PDF source locking, syllabus-bounded SFT answers, OCR state handling, lesson-resource migration, protected PDF access, image generation routing, direct video streaming, chart measurement, notification handling, and mobile UI behavior.

## Validation completed

- npm public-registry lockfile check
- TypeScript application typecheck
- TypeScript operational-script typecheck
- Source, Z-score, Markdown, Sinhala, authentication, PDF, AI, upload, knowledge, permissions, and video tests
- Integration regression tests
- Static production-repair verification
- Frontend production build from the final frontend source
- Self-contained Vercel API runtime bundle
- Vercel runtime dependency and asset verification
- Isolated pure-ESM API smoke test outside root `node_modules`
- ZIP integrity verification

The local Chromium browser is managed with `URLBlocklist: ["*"]`, so navigation-based browser E2E was skipped by the test harness. Run the included browser test in unrestricted Preview/CI.

## Known deployment-time checks

Live credentials are unavailable in the packaging environment. Before production promotion, verify Google sign-in, Firebase App Check, Firestore and Storage rules, image generation, OCR buckets, signed PDF/video access, and cross-account published-resource visibility in a Vercel Preview.

The frontend build reports non-fatal large-chunk warnings. Further code splitting remains a performance optimization.

A dependency audit reported advisories in transitive Google/HTTP packages. The available non-breaking package refresh could not be downloaded during the final pass because public-registry DNS became unavailable. Do not run the proposed forced fix because it downgrades Firebase Admin to a breaking version. Re-run `npm audit fix` against the public registry in normal CI, then repeat all validation.

## Build and deploy

```bash
npm ci --include=dev --registry=https://registry.npmjs.org/
npm run typecheck
npm test
npm run verify:repair
npm run build:vercel
```

Publish the included Firebase rules:

```bash
firebase deploy --only firestore:rules,storage
```

Use `.env.example` as the environment checklist. Never commit service-account JSON, private keys, OAuth tokens, cookies, session secrets, or production `.env` files.
