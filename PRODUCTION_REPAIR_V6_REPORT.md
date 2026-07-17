# Altec production repair V6

Date: 2026-07-18

## Vercel installation

The `EHOSTUNREACH` failure was caused by private OpenAI build-environment registry URLs
inside the committed npm lockfile. The lockfile has been regenerated with only
`registry.npmjs.org` tarball URLs. A project `.npmrc`, an explicit Vercel public-registry
install command, and a lockfile portability verifier were added.

Verified registry hosts in `package-lock.json`:

```text
registry.npmjs.org: 1026 entries
private/internal hosts: 0 entries
```

## Google login

Authentication no longer forces Firebase redirect sign-in on every browser. Popup auth is
the production default on Vercel. Mobile/PWA redirect is available only when the same-origin
Firebase auth proxy and OAuth callback have explicitly been enabled. Login attempts are
single-flight, Firebase local persistence is retained, redirect completion runs once, and
server-session bootstrap failures remain non-fatal to a valid Firebase browser session.

The Firebase console must still have Google enabled and `tecal.vercel.app` in Authorized
domains. Application code cannot change those project-console settings.

## Build verification

The following completed successfully from a clean dependency installation:

```text
npm ci --include=dev
npm run check:npm-registry
npm run typecheck
npm test
npm run build:vercel
npm run verify:repair
```

Generated runtime assets include:

```text
vercel-runtime/server.mjs
vercel-runtime/pdf.worker.mjs
vercel-runtime/google-gax-protos/
```

## Deployment note

For the first V6 deployment, redeploy without the previous Vercel build cache. The old
cache is not the original root cause, but clearing it prevents stale npm metadata from
obscuring validation of the corrected lockfile.
