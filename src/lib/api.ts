import { auth, authPersistenceReady, getFirebaseAppCheckToken } from './firebase';
import { apiUrl, getLargeEndpointUrl } from './apiBase';

export async function getAuthToken(): Promise<string | null> {
  if (!auth) return null;
  await authPersistenceReady;
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn("Failed to get Firebase ID token", e);
    }
  }
  
  // Wait for auth state if not loaded
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      unsubscribe();
      if (user && !user.isAnonymous) {
        try {
          resolve(await user.getIdToken());
        } catch (e) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options = init || {};
  const headers = new Headers(options.headers || {});
  
  const token = await getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const appCheckToken = await getFirebaseAppCheckToken();
  if (appCheckToken) headers.set("X-Firebase-AppCheck", appCheckToken);

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let finalUrl: string | Request = input as any;
  if (typeof input === 'string') {
    finalUrl = getLargeEndpointUrl(input);
  } else if (input instanceof URL) {
    finalUrl = getLargeEndpointUrl(input.toString());
  } else if (input && typeof (input as any).url === 'string') {
    finalUrl = getLargeEndpointUrl((input as Request).url);
  }

  // Ensure options.headers matches the Headers object. Expired Firebase ID
  // tokens are refreshed once so progress reads/writes do not surface as false
  // offline failures after a long-running browser session.
  let response = await globalThis.fetch(finalUrl, {
    ...options,
    headers,
  });

  if (response.status === 401 && auth?.currentUser && !(typeof ReadableStream !== "undefined" && options.body instanceof ReadableStream)) {
    let code = "";
    try {
      const authError = await response.clone().json();
      code = String(authError?.code || "");
    } catch {
      // Non-JSON 401 responses are not retried automatically.
    }
    if (["LOGIN_REQUIRED", "UNAUTHENTICATED", "AUTHENTICATED_USER_REQUIRED"].includes(code)) {
      try {
        const refreshedToken = await auth.currentUser.getIdToken(true);
        headers.set("Authorization", `Bearer ${refreshedToken}`);
        response = await globalThis.fetch(finalUrl, {
          ...options,
          headers,
        });
      } catch {
        // Preserve the original authentication failure response semantics.
      }
    }
  }

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
