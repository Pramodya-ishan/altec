import { auth, authPersistenceReady, getFirebaseAppCheckToken } from './firebase';
import { getLargeEndpointUrl } from './apiBase';

const inflightReads = new Map<string, Promise<Response>>();
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const LONG_RUNNING_PATHS = [
  '/api/ai/respond-stream',
  '/api/respond-stream',
  '/api/pdf/direct-qa-file',
  '/api/rag/reindex-uploaded',
  '/api/rag/ingest-uploaded',
  '/api/voice/',
  '/api/video/',
];

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (!auth) return null;
  await authPersistenceReady;
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch (e) {
      console.warn('Failed to get Firebase ID token', e);
    }
  }

  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      unsubscribe();
      if (user && !user.isAnonymous) {
        try {
          resolve(await user.getIdToken(forceRefresh));
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isLongRunning(url: string) {
  return LONG_RUNNING_PATHS.some((path) => url.includes(path));
}

function decorateJson(response: Response): Response {
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

function createAbortSignal(externalSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    },
  };
}

async function fetchWithRetry(url: string, options: RequestInit, retryable: boolean): Promise<Response> {
  const timeoutMs = isLongRunning(url) ? 180_000 : 35_000;
  const maxAttempts = retryable ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { signal, cleanup } = createAbortSignal(options.signal, timeoutMs);
    try {
      const response = await globalThis.fetch(url, { ...options, signal });
      cleanup();

      if (response.status === 401 && attempt === 0 && auth?.currentUser && retryable) {
        await getAuthToken(true).catch(() => null);
      }

      if (!RETRYABLE_STATUS.has(response.status) || attempt === maxAttempts - 1) return response;
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      await sleep(Math.min(10_000, retryAfter ?? 400 * 2 ** attempt + Math.random() * 250));
    } catch (error) {
      cleanup();
      lastError = error;
      if (options.signal?.aborted || attempt === maxAttempts - 1) throw error;
      await sleep(400 * 2 ** attempt + Math.random() * 250);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options = init || {};
  const headers = new Headers(options.headers || {});
  const token = await getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const appCheckToken = await getFirebaseAppCheckToken();
  if (appCheckToken) headers.set('X-Firebase-AppCheck', appCheckToken);
  if (!headers.has('X-Request-ID') && typeof crypto !== 'undefined' && crypto.randomUUID) {
    headers.set('X-Request-ID', crypto.randomUUID());
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let finalUrl: string;
  if (typeof input === 'string') finalUrl = getLargeEndpointUrl(input);
  else if (input instanceof URL) finalUrl = getLargeEndpointUrl(input.toString());
  else finalUrl = getLargeEndpointUrl((input as Request).url);

  const method = String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD' || headers.has('X-Idempotency-Key');
  const requestOptions: RequestInit = { ...options, method, headers };

  if (method === 'GET' || method === 'HEAD') {
    const cacheKey = `${method}:${finalUrl}:${token || 'anonymous'}`;
    let pending = inflightReads.get(cacheKey);
    if (!pending) {
      pending = fetchWithRetry(finalUrl, requestOptions, true);
      inflightReads.set(cacheKey, pending);
      pending.finally(() => inflightReads.delete(cacheKey)).catch(() => undefined);
    }
    const response = await pending;
    return decorateJson(response.clone());
  }

  const response = await fetchWithRetry(finalUrl, requestOptions, retryable);
  return decorateJson(response);
}
