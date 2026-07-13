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
  
  // Wait for auth state if not loaded
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      unsubscribe();
      if (user) {
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

  // Ensure options.headers matches the Headers object
  const response = await globalThis.fetch(finalUrl, {
    ...options,
    headers
  });

  const originalJson = response.json.bind(response);
  response.json = async function() {
    try {
      return await originalJson();
    } catch (e) {
      console.warn("apiFetch safe JSON parser: Failed to parse JSON, returning empty object", e);
      return {};
    }
  };

  return response;
}
