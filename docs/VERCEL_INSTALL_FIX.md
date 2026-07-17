# Vercel npm install repair

## Root cause

`package-lock.json` contained tarball URLs from a private build environment:

`packages.applied-caas-gateway1.internal.api.openai.org`

That hostname resolves only inside that environment. Vercel therefore failed during
`npm ci` with `EHOSTUNREACH` before the application build started.

## Repair

- Every package-lock tarball now resolves from `https://registry.npmjs.org/`.
- `.npmrc` forces the public npm registry and registry-host replacement.
- Vercel's install command explicitly supplies the public registry.
- `scripts/check-npm-registry.mjs` blocks future commits containing private registry URLs.
- The verification suite checks `.npmrc`, `package-lock.json`, and `vercel.json`.

## Vercel deploy action

Redeploy once with **Use existing Build Cache** disabled. Later deployments may use the
cache normally. The lockfile and install command no longer depend on the private registry.
