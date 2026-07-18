# Clora X Production Repair V12

## Resolved deployment failure

The Vercel build previously stopped during `validate:vercel-env` with:

```text
FIREBASE_APP_CHECK_REQUIRED=true is required in Vercel.
```

That check incorrectly made Firebase App Check a mandatory build-time dependency even when the browser did not have `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Requiring App Check in that state would also make authenticated API requests fail because the client could not mint an App Check token.

## Implemented repair

- Vercel validation no longer fails merely because Firebase App Check is not configured.
- A missing App Check site key now produces clear deployment warnings rather than a build failure.
- Firebase Authentication and all server-side route/role/ownership checks remain enabled.
- App Check enforcement automatically becomes active in production when `VITE_FIREBASE_APP_CHECK_SITE_KEY` is configured, unless explicitly disabled.
- If `FIREBASE_APP_CHECK_REQUIRED=true` or `VIDEO_REQUIRE_APP_CHECK=true` is present without a site key, the runtime safely disables only App Check enforcement instead of blocking every API request.
- Video playback retains authentication, publication, visibility, and user-access checks when App Check is unavailable.
- Missing optional administrator-email or syllabus-source values now generate warnings instead of preventing deployment. Firebase custom claims and bundled/indexed syllabus fallbacks remain supported.
- `.env.example` now starts App Check flags as `false` until a valid public reCAPTCHA v3 site key is configured.
- Added a permanent regression test that reproduces the reported Vercel configuration and verifies both validation and runtime fallback behavior.

## Security behavior

This repair does not add an unauthenticated bypass. It changes only the optional App Check hardening layer. Firebase ID-token/session authentication, API authorization, content-manager permissions, upload validation, storage/firestore rules, PDF access checks, and video access policy remain in place.

## Verification completed

- `npm run typecheck`
- `npm test`
- `npm run verify:repair`
- Vercel environment simulation with App Check flags enabled and no site key
- `vite build`
- `npm run bundle:vercel`
- Vercel runtime asset verification
- Isolated pure-ESM serverless runtime smoke test
- ZIP integrity verification

## Optional App Check activation

To enable App Check later, set the following Vercel variables for Production and Preview:

```env
VITE_FIREBASE_APP_CHECK_SITE_KEY=<public-recaptcha-v3-site-key>
FIREBASE_APP_CHECK_REQUIRED=true
VIDEO_REQUIRE_APP_CHECK=true
```

Register the production and preview domains in Firebase App Check before enabling enforcement.
