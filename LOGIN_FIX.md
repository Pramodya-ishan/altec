# Google sign-in production setup

The application now uses Firebase `signInWithPopup()` on Vercel and explicitly
uses `browserLocalPersistence`. A successful Firebase login is retained even if
the optional `/api/auth/session` profile bootstrap is temporarily unavailable.

Required Firebase Console configuration:

1. Authentication -> Sign-in method -> Google: Enabled.
2. Authentication -> Settings -> Authorized domains:
   - `tecal.vercel.app`
   - every custom production domain used by the app
   - `localhost` for local testing
3. If the OAuth consent screen is in Testing mode, add every permitted account
   as a test user, or publish the consent screen for general access.

Required Vercel value:

`VITE_FIREBASE_AUTH_DOMAIN=al-ai-chat.firebaseapp.com`

Use the hostname only. Do not include `https://`, a trailing slash, or
`/__/auth/handler`.

After deployment, clear the old PWA once if the browser still serves an older
bundle: Chrome DevTools -> Application -> Service Workers -> Unregister, then
Application -> Storage -> Clear site data and reload.
