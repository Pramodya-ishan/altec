# Google authentication production repair

## Failure addressed

The previous build forced `signInWithRedirect()` on every browser while the app was
hosted on Vercel and Firebase's helper was hosted on `firebaseapp.com`. Modern browser
third-party storage restrictions can prevent that redirect result from being restored,
which makes the login appear to return to the app without signing the user in.

## Behaviour in this build

- Popup sign-in is the reliable default.
- Mobile/PWA redirect is used only when same-origin redirect support is explicitly enabled.
- A blocked popup falls back to redirect only when that redirect setup is known to be configured.
- `getRedirectResult()` is initialized once.
- Duplicate login clicks are ignored while a request is active.
- Browser-local Firebase persistence remains the authentication source of truth.
- A temporary server-session bootstrap failure does not sign out a valid Firebase user.
- Specific Firebase errors are displayed for unauthorized domains, disabled Google provider,
  blocked popups, unsupported storage, and cancelled sign-in.

## Required production variables

```env
VITE_FIREBASE_AUTH_DOMAIN=al-ai-chat.firebaseapp.com
VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=false
VITE_FIREBASE_REDIRECT_AUTH_ENABLED=false
```

Also enable Google sign-in and authorize `tecal.vercel.app` in Firebase Authentication.
