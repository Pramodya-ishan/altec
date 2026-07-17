# Google sign-in setup

The production frontend is hosted by Vercel and uses Firebase Authentication.

## Required Firebase console settings

1. Open Firebase Console → Authentication → Sign-in method.
2. Enable the Google provider.
3. Open Authentication → Settings → Authorized domains.
4. Add `tecal.vercel.app` and every custom production hostname that serves the app.

Preview hostnames should not be enabled indiscriminately. Use a stable preview/custom
hostname when preview authentication is required.

## Default production mode

Use Firebase's provisioned authentication domain and popup-first authentication:

```env
VITE_FIREBASE_AUTH_DOMAIN=al-ai-chat.firebaseapp.com
VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=false
VITE_FIREBASE_REDIRECT_AUTH_ENABLED=false
```

This is the safe default for a site hosted outside Firebase Hosting. It avoids losing
the pending redirect state when a browser blocks third-party storage.

## Optional same-origin redirect mode

Enable redirect mode only after all of the following are complete:

- `https://tecal.vercel.app/__/auth/handler` is registered as an authorized OAuth redirect URI.
- `tecal.vercel.app` is present in Firebase Authentication authorized domains.
- The Vercel `/__/auth/*` and `/__/firebase/*` reverse-proxy rewrites are deployed.

Then set:

```env
VITE_FIREBASE_AUTH_DOMAIN=tecal.vercel.app
VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=true
VITE_FIREBASE_REDIRECT_AUTH_ENABLED=true
```

With these variables enabled, mobile/PWA clients use redirect auth and desktop
browsers continue using popup auth.
