import { auth, getFirebaseAppCheckToken } from './firebase';
import { apiUrl, getLargeEndpointUrl } from './apiBase';

export async function getAuthToken(): Promise<string | null> {
  if (!auth) return null;
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn("Failed to get Firebase ID token", e);
    }
  }
  
  // Wait briefly for Firebase's first auth event. Never leave API calls
  // pending forever when persistence or a browser extension blocks auth.
  return new Promise((resolve) => {
    let settled = false;
    let timeout = 0;
    let unsubscribe = () => {};
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(value);
    };
    timeout = window.setTimeout(() => finish(null), 5000);
    unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      if (user) {
        try {
          finish(await user.getIdToken());
        } catch (e) {
          finish(null);
        }
      } else {
        finish(null);
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

  // Ensure options.headers matches the Headers object
  const response = await globalThis.fetch(finalUrl, {
    ...options,
    headers
  });

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
