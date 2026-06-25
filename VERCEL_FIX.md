# Vercel deployment settings

Use these settings for this project:

- Framework Preset: Vite
- Root Directory: `./`
- Install Command: Automatic
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: pinned to `22.x` by `package.json`

Required production environment variables:

- `ENCRYPTION_KEY`: a long private random secret. Do not commit it.
- `GEMINI_API_KEY`: required for Gemini features.
- `VITE_GOOGLE_CLIENT_ID`: required for Google sign-in.

After deploying, test `/api/health`. It should return JSON containing `ok: true`.
Open the new deployment once in an Incognito window. This build also unregisters old service workers and clears stale PWA caches.
