# Google sign-in setup

The application uses Firebase Authentication for Google sign-in.

## Recommended production configuration

Set these Vercel environment variables for Production, Preview and
Development:

```env
VITE_FIREBASE_AUTH_DOMAIN=al-ai-chat.firebaseapp.com
VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=false
```

In Firebase Console, open **Authentication > Settings > Authorized domains**
and add `tecal.vercel.app`.

This configuration uses Firebase's provisioned callback and does not require
the Vercel URL to be registered as a Google OAuth redirect URI.

## Optional same-origin callback

Only enable a custom auth domain after adding this exact URI to the web OAuth
client in Google Cloud Console:

```text
https://tecal.vercel.app/__/auth/handler
```

Then set:

```env
VITE_FIREBASE_AUTH_DOMAIN=tecal.vercel.app
VITE_FIREBASE_USE_CUSTOM_AUTH_DOMAIN=true
```

Do not add a trailing slash to the auth domain or redirect URI.
