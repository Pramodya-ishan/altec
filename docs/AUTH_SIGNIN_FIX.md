# Google sign-in configuration

This build uses Firebase's default authentication handler:

`https://al-ai-chat.firebaseapp.com/__/auth/handler`

That prevents a Vercel custom-domain proxy from generating a Google OAuth
`redirect_uri_mismatch`.

## Required console setting

In **Firebase Console → Authentication → Settings → Authorized domains**, keep
all deployed frontend domains, including the production Vercel domain and any
preview/custom domain that should be allowed to sign in.

The frontend environment should normally use:

```env
VITE_FIREBASE_AUTH_DOMAIN=al-ai-chat.firebaseapp.com
VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=false
```

Only enable a custom authentication domain after its exact
`https://<domain>/__/auth/handler` URI is configured for the Firebase/Google
OAuth client and the domain is serving Firebase's authentication helper files.

## Behaviour in this build

- Popup sign-in is the primary path.
- Redirect sign-in is used only when a browser blocks/does not support popups.
- Redirect results are completed during application bootstrap.
- Duplicate sign-in clicks are ignored while one request is active.
- Firebase Auth persistence is the session source of truth.
- Expired Google `userinfo` access tokens are no longer restored from local storage.
