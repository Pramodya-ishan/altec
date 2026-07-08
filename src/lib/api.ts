import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

let authReadyPromise: Promise<void> | null = null;

export function waitForFirebaseAuthReady(timeoutMs = 4000): Promise<void> {
  if (!auth) return Promise.resolve();
  if (auth.currentUser) return Promise.resolve();
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      let unsubscribe = () => {};
      const timer = window.setTimeout(() => {
        unsubscribe();
        resolve();
      }, timeoutMs);
      unsubscribe = onAuthStateChanged(auth, () => {
        window.clearTimeout(timer);
        unsubscribe();
        resolve();
      });
    });
  }
  return authReadyPromise;
}

export async function getAuthToken(): Promise<string | null> {
  await waitForFirebaseAuthReady();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch (e) {
    console.warn("Failed to get Firebase ID token", e);
    return null;
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return globalThis.fetch(input, {
    ...init,
    headers,
  });
}
