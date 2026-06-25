# Vercel runtime fix

1. Set the project Node.js version to **22.x**.
2. Deploy this project as a new commit (do not redeploy an old commit).
3. Open `/api/health`; it must return JSON with `ok: true`.
4. Clear the old service worker/site data once, or use the unique new deployment URL.
5. `ENCRYPTION_KEY` may be any non-empty secret; the server now derives a valid 32-byte AES key.

The server now lazy-loads AI and YouTube modules so an optional dependency cannot crash the authentication endpoints during a Vercel cold start.
