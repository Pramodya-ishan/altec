import { auth } from './firebase';

export async function getAuthToken(): Promise<string | null> {
  if (auth && auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn("Failed to get Firebase ID token", e);
    }
  }
  return localStorage.getItem('google_access_token');
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAuthToken();
  const options = init || {};
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': 'Bearer ' + token
    };
  }
  
  // Keep API calls on the same origin. This works both locally and on Vercel,
  // where /api/* is routed to the serverless Express handler by vercel.json.
  return globalThis.fetch(input, options);
}

export async function readJsonResponse(response: Response): Promise<any> {
  const body = await response.text();

  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    const preview = body.replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(
      `Server returned a non-JSON response (${response.status}): ${preview || 'empty response'}`
    );
  }
}
