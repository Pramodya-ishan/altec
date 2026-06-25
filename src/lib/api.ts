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
  
  let urlStr = input.toString();
  if (urlStr.startsWith('/')) {
    urlStr = 'https://tecnology-livid.vercel.app' + urlStr;
  }
  
  return globalThis.fetch(urlStr, options);
}
