import { auth } from './firebase';

export async function getAuthToken(): Promise<string | null> {
  if (auth?.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (error) {
      console.warn('Failed to get Firebase ID token', error);
    }
  }

  return localStorage.getItem('google_access_token');
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Relative /api URLs stay on the currently opened deployment/domain.
  // This prevents requests from being sent to an old hard-coded Vercel URL.
  return globalThis.fetch(input, {
    ...init,
    headers,
  });
}

export async function readJsonResponse<T = any>(response: Response): Promise<T> {
  const body = await response.text();

  if (!body.trim()) {
    if (response.ok) return {} as T;
    throw new Error(`Server returned an empty response (${response.status}).`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    const preview = body.replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(
      `Server returned a non-JSON response (${response.status}): ${preview || 'empty response'}`,
    );
  }
}
