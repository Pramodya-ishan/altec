import { auth } from './firebase';

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

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Ensure options.headers matches the Headers object
  return globalThis.fetch(input, {
    ...options,
    headers
  });
}
