# Clora X Production Repair V13

## Reported Vercel failure

TypeScript failed because the repository still contained the obsolete pre-V11 file `server/app.ts`. That file imported `RPM_LIMIT`, `RPD_LIMIT`, `requestCountPM`, and `requestCountPD` from `server/ai/queue.ts`, but V11 intentionally removed those request-count exports when application-enforced rate limits were disabled.

## V13 repair

- Added `scripts/remove-obsolete-files.mjs`.
- Added the `cleanup:obsolete` npm command.
- Wired cleanup before every TypeScript check and every frontend/Vercel production build.
- The cleanup removes only these known legacy paths:
  - `server/app.ts`
  - `server/data/userRepository.ts`
  - `data_users`
- Added static verification that the cleanup script and lifecycle hooks remain present.
- No request-count rate limit was reintroduced.
- Authentication, authorization, Firebase App Check behavior, upload limits, provider quotas, and concurrency protection remain unchanged.

## Why this is needed

Copying a repaired project over an older Git checkout does not delete files that no longer exist in the repaired package. The stale `server/app.ts` therefore remained tracked in GitHub and was included by `tsc`. V13 removes known obsolete files before compilation, so overlay-style updates cannot recreate this failure.

## Validation completed in this environment

- npm lockfile registry check: passed
- obsolete-file cleanup regression: passed
- cleanup script syntax check: passed
- production repair static verification: passed
- V10 authoritative syllabus/Sinhala/source checks: passed
- V11 security/privacy/unlimited-capacity/App Check checks: passed

A fresh dependency installation and full TypeScript/Vite build could not be rerun in this sandbox because outbound npm DNS resolution returned `EAI_AGAIN`. The same dependency installation succeeded in the supplied Vercel log before the stale import error. The V13 change runs before TypeScript and directly removes the file that produced those four `TS2305` errors.

## Preferred permanent Git cleanup

After copying V13 into the repository, remove the obsolete tracked paths from Git history in the next commit:

```bash
git rm -f server/app.ts
git rm -f server/data/userRepository.ts 2>/dev/null || true
git rm -r data_users 2>/dev/null || true
git add package.json scripts/remove-obsolete-files.mjs scripts/verify-production-repair.mjs
git commit -m "Remove obsolete legacy backend files"
git push origin main
```

The build-time cleanup remains as protection against future overlay copies.
