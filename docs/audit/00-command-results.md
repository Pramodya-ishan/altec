# 00-command-results.md

## Baseline Command Results

This document records the output of the standard diagnostic and compilation commands run against the Clora X repository to establish a reliable baseline before any remediation work begins.

| Command | Result | Important Output | Blocking? |
|---|---|---|---|
| `node --version` | Success | `v22.23.0` | No |
| `npm --version` | Success | `10.9.8` | No |
| `npm run lint` | Success | `tsc --noEmit` completed with no errors. | No |
| `npm run build` | Success | Production build succeeded. Output directories: `dist/` and `dist/server.cjs` | No |

## Build and Bundle Analysis

The production build of Clora X compiles both the client-side single-page application (using Vite) and the full-stack server (using esbuild).

### Bundle Size Analysis
The production build output highlights that several chunks exceed the standard 500 kB limit:
- **`dist/assets/firebase-BNW1sJl_.js`** (~738.54 kB): Large monolithic Firebase Client SDK bundle.
- **`dist/assets/CloraXView-BI57XwUo.js`** (~452.54 kB): Heavily coupled core conversation and tutoring views.
- **`dist/assets/pdf-BKgQKo8Q.js`** (~439.50 kB): Bundled PDF.js worker and parsing tools.
- **`dist/assets/charts-NxwjayUT.js`** (~391.30 kB): Recharts, D3, and associated analytical charting modules.
- **`dist/assets/paper-structure-BpWzB1-v.js`** (~388.65 kB): Monolithic structure definition layouts.

### Precache Manifest
The Service Worker (`dist/sw.js`) precaches 31 assets totaling ~2.49 MB, which is relatively large for quick mobile loads.

## Test Suite Baseline
No substantial automated test suite currently exists in the codebase (apart from the trivial `test_abort.ts` file).
