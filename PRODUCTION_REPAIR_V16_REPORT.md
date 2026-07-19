# Clora X Production Repair V16

## Incident

The browser had a valid Firebase user and successfully refreshed its Firebase ID token, but the backend returned:

- `POST /api/auth/session` → 500
- `GET /api/data` → 401
- `GET /api/profile` → 401
- `GET /api/notifications` → 401
- `GET /api/auth/context` → 401

The repeated progress retries then produced a large stream of identical 401 requests.

## Root causes fixed

1. Normal API authentication called `verifyIdToken(token, true)` and `verifySessionCookie(cookie, true)`. The `true` flag performs an additional revocation lookup through the privileged Firebase Auth API. A valid token could therefore be rejected when the deployment service account could verify Firebase JWTs but lacked the optional revocation-check permission.
2. `/api/auth/session` treated cookie signing and Firestore profile initialization as mandatory. Failure in either optional operation converted an otherwise valid Firebase login into an HTTP 500.
3. The client retried only a narrow set of 401 error codes and did not coordinate concurrent token recovery.
4. Progress loading and saving continued short-interval retries after authentication failures, creating repeated `/api/data` 401 traffic.
5. The session bootstrap ran before progress/profile/notification loading, even though every protected request already carries a Firebase bearer token.

## Repairs

### Server authentication

- Standard API requests now validate Firebase ID tokens cryptographically with `checkRevoked=false`.
- Session cookies are also validated without a privileged revocation lookup.
- Invalid or expired credentials still return 401.
- Authentication-provider infrastructure failures return a retryable 503 instead of being mislabeled as an invalid login.
- Firestore role metadata remains supplemental and cannot invalidate a valid Firebase identity.

### Session endpoint

- The ID token is verified first.
- HttpOnly session-cookie creation is best-effort.
- Firestore profile bootstrap is best-effort.
- Cookie-signing or profile-sync failure no longer returns 500.
- The response reports `sessionCreated`, `profileSynced`, and `authMode`.
- Firebase bearer authentication remains active even when no session cookie can be signed.

### Browser API client

- All API calls use `credentials: include`.
- Expired Firebase ID tokens are force-refreshed once.
- Concurrent 401 responses share one recovery promise instead of triggering many token refreshes.
- The optional server session is recreated after token recovery.
- App Check 401 responses refresh App Check independently from Firebase Auth.
- Non-replayable streaming request bodies are never retried unsafely.
- Firebase auth-state waiting has a bounded timeout.

### Application bootstrap and progress synchronization

- Session creation runs in parallel with progress, profile, and notification loading.
- Session-cookie failure does not block authenticated application data.
- 401/403 progress failures are not retried three times immediately.
- Authentication failures back off for 60 seconds instead of flooding the API.
- Focus/visibility refreshes are limited to unhydrated or stale progress data.
- Existing in-memory progress remains preserved during a temporary authentication or network failure.

## Files changed

- `server/firebase/authMiddleware.ts`
- `server/auth/routes.ts`
- `src/lib/api.ts`
- `src/lib/firebase.ts`
- `src/context/AppContext.tsx`
- `src/lib/__tests__/authRecoveryRegression.test.ts`
- `scripts/verify-production-repair.mjs`
- `package.json`

## Verification

Passed:

- npm clean install: 922 packages
- TypeScript application check
- TypeScript operational-script check
- Full source/PDF/AI/Sinhala/security/video test suite
- Firebase auth recovery regression test
- Integration test suite
- Production repair static verification
- Vite production frontend build
- Self-contained Vercel runtime build
- Vercel runtime import verification
- Isolated pure-ESM Vercel function boot

## Deployment

Deploy this project as a new Vercel build. A clean deployment without the previous build cache is recommended so browsers receive the new hashed frontend bundles.

The runtime still requires valid Firebase/Google server credentials for Firestore reads and writes. `firebase-applet-config.json` already contains the non-default Firestore database ID used by the application.
