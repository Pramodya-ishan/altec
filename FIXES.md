# A/L Tech Blueprint – Vercel/API Fixes

## Fixed

- Removed the conflicting root `server.ts` Express entrypoint.
- Added a single Vercel function entry at `api/index.ts`.
- Corrected API rewrites to target `/api/index` without a TypeScript file extension.
- Separated local development/production startup into `server/dev.ts`.
- Added JSON 404 and centralized JSON 500 handling for API requests.
- Added Firestore REST request timeouts and atomic local file writes.
- Reduced quota polling from every 5 seconds to every 30 seconds and paused it while the tab is hidden.
- Added stable initial dimensions to Recharts containers to stop width/height `-1` warnings.

## Vercel project settings

The repository configuration already sets these values:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node.js: 20.x or 22.x

Deploy the project root as-is. Do not manually set a different Root Directory.

## Environment variables

Copy the required values from `.env.example` into Vercel Project Settings → Environment Variables. At minimum, set the Gemini key if AI routes are used. Firebase Admin environment variables are required for Firebase Admin-only authentication actions.

## Browser-extension console error

`share-modal.js` and `content-script.js` are not project files. Those messages are injected by a browser extension. Disable the related extension or test in an Incognito window with extensions disabled to remove those messages.
