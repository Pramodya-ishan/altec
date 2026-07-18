# Clora X Production Repair V14

Date: 2026-07-18

## Reported Vercel failure

The V13 cleanup correctly deleted `server/app.ts`, but the old repository overlay still contained `server/dev.ts`. That file imported `./app`, so TypeScript failed with:

- `TS2307: Cannot find module './app'`
- `TS7006` for the untyped Express callback parameters in the obsolete file

## Repair

1. Added `server/dev.ts` to `scripts/remove-obsolete-files.mjs`.
2. Kept cleanup before both `prebuild:vercel` and `pretypecheck`.
3. Added defense-in-depth exclusions to `tsconfig.json` for:
   - `server/app.ts`
   - `server/dev.ts`
   - `server/data/userRepository.ts`
   - `data_users`
4. Expanded `scripts/verify-production-repair.mjs` so a future release fails verification if the cleanup or TypeScript exclusions are removed.
5. Confirmed the stale-overlay simulation removes all four obsolete paths before TypeScript starts.

## Rate-limit behavior

No application request-count rate limit was restored. Authentication, authorization, App Check configuration, provider safeguards, upload limits, and payload validation remain separate protections.

## Validation

Passed locally:

- npm lockfile public-registry validation
- V14 obsolete-file cleanup simulation
- static production-repair verification
- TypeScript exclusion verification
- ZIP integrity verification

A clean `npm ci` could not complete in this sandbox because registry DNS requests ended with `EAI_AGAIN` and npm reported `Exit handler never called`. The supplied Vercel log confirms that the same lockfile installs successfully on Vercel and reaches TypeScript. The V14 change directly removes and excludes the files responsible for that TypeScript failure.
