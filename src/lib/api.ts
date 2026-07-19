import { auth, authPersistenceReady, getFirebaseAppCheckToken } from './firebase';
import { apiUrl, getLargeEndpointUrl } from './apiBase';

const AUTH_RECOVERY_CODES = new Set([
  'LOGIN_REQUIRED',
  'UNAUTHENTICATED',
  'AUTH_REQUIRED',
  'AUTHENTICATED_USER_REQUIRED',
  'INVALID_ID_TOKEN',
  'TOKEN_EXPIRED',
]);
const APP_CHECK_CODES = new Set(['APP_CHECK_REQUIRED', 'APP_CHECK_INVALID']);

let authRecoveryPromise: Promise<string | null> | null = null;
let appCheckRecoveryPromise: Promise<string | null> | null = null;

function waitForAuthState(timeoutMs = 5_000): Promise<any | null> {
  if (!auth) return Promise.resolve(null);
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    let unsubscribe: () => void = () => undefined;
    const finish = (user: any | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    };
    unsubscribe = auth.onAuthStateChanged((user: any) => finish(user || null));
    timeout = setTimeout(() => finish(auth.currentUser || null), timeoutMs);
  });
}

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (!auth) return null;
  await authPersistenceReady;
  const user = auth.currentUser || await waitForAuthState();
  if (!user || user.isAnonymous) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    console.warn('Failed to obtain Firebase ID token', error);
    return null;
  }
}

function canReplayRequestBody(body: BodyInit | null | undefined) {
  return !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream);
}

function toFinalUrl(input: RequestInfo | URL): string | Request {
  if (typeof input === 'string') return getLargeEndpointUrl(input);
  if (input instanceof URL) return getLargeEndpointUrl(input.toString());
  if (input && typeof (input as Request).url === 'string') {
    return getLargeEndpointUrl((input as Request).url);
  }
  return input as Request;
}

function requestPath(input: string | Request) {
  try {
    const raw = typeof input === 'string' ? input : input.url;
    return new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname;
  } catch {
    return '';
  }
}

async function readErrorCode(response: Response) {
  try {
    const payload = await response.clone().json();
    return String(payload?.code || payload?.error || '');
  } catch {
    return '';
  }
}

async function establishOptionalServerSession(idToken: string, appCheckToken: string | null) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  });
  if (appCheckToken) headers.set('X-Firebase-AppCheck', appCheckToken);

  try {
    // Session cookies are a same-origin fallback only. API requests continue to
    // use the Firebase bearer token even when cookie creation is unavailable.
    await globalThis.fetch(apiUrl('/api/auth/session'), {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ idToken }),
    });
  } catch {
    // A valid Firebase bearer token is sufficient; do not fail the caller.
  }
}

async function recoverAuthentication() {
  if (authRecoveryPromise) return authRecoveryPromise;
  authRecoveryPromise = (async () => {
    const refreshedToken = await getAuthToken(true);
    if (!refreshedToken) return null;
    const appCheckToken = await getFirebaseAppCheckToken();
    await establishOptionalServerSession(refreshedToken, appCheckToken);
    return refreshedToken;
  })().finally(() => {
    authRecoveryPromise = null;
  });
  return authRecoveryPromise;
}

async function recoverAppCheck() {
  if (appCheckRecoveryPromise) return appCheckRecoveryPromise;
  appCheckRecoveryPromise = getFirebaseAppCheckToken(true).finally(() => {
    appCheckRecoveryPromise = null;
  });
  return appCheckRecoveryPromise;
}

function attachSafeJson(response: Response) {
  const jsonSource = response.clone();
  response.json = async function() {
    const text = await jsonSource.text();
    if (!text.trim()) return {};

    try {
      return JSON.parse(text);
    } catch {
      if (!response.ok) {
        return {
          ok: false,
          error: text.trim().slice(0, 500) || `Request failed (${response.status})`,
          status: response.status,
        };
      }
      return { data: text };
    }
  };
  return response;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options = init || {};
  const headers = new Headers(options.headers || {});
  const finalUrl = toFinalUrl(input);
  const path = requestPath(finalUrl);

  const token = await getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const appCheckToken = await getFirebaseAppCheckToken();
  if (appCheckToken) headers.set('X-Firebase-AppCheck', appCheckToken);

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const requestOptions: RequestInit = {
    ...options,
    credentials: options.credentials || 'include',
    headers,
  };

  let response = await globalThis.fetch(finalUrl, requestOptions);
  if (response.status !== 401 || !canReplayRequestBody(options.body)) {
    return attachSafeJson(response);
  }

  const code = await readErrorCode(response);

  // Refresh App Check independently. Do not waste Firebase Auth refreshes on
  // application-attestation errors.
  if (APP_CHECK_CODES.has(code)) {
    const refreshedAppCheck = await recoverAppCheck();
    if (refreshedAppCheck) {
      headers.set('X-Firebase-AppCheck', refreshedAppCheck);
      response = await globalThis.fetch(finalUrl, { ...requestOptions, headers });
    }
    return attachSafeJson(response);
  }

  const isSessionBootstrap = path === '/api/auth/session';
  const shouldRecoverAuth = !isSessionBootstrap && auth?.currentUser
    && (!code || AUTH_RECOVERY_CODES.has(code));

  if (shouldRecoverAuth) {
    const refreshedToken = await recoverAuthentication();
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      response = await globalThis.fetch(finalUrl, { ...requestOptions, headers });
    }
  }

  return attachSafeJson(response);
}
