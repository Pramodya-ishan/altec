import { apiFetch } from './api';

let cachedMode: 'backend_multer' | 'client_firebase_storage' | null = null;
let fetchPromise: Promise<'backend_multer' | 'client_firebase_storage'> | null = null;

export async function getRecommendedUploadMode(): Promise<'backend_multer' | 'client_firebase_storage'> {
  if (cachedMode) {
    return cachedMode;
  }
  
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await apiFetch('/api/ai/health');
      if (!res.ok) {
        throw new Error('Health check failed');
      }
      const health = await res.json();
      
      const recMode = health.storageMode?.recommendedUploadMode || health.recommendedUploadMode;
      const tests = health.storageMode?.tests || {};
      
      if (
        recMode === 'client_firebase_storage' ||
        tests.canUploadStorage === false ||
        tests.canGenerateSignedUrl === false
      ) {
        cachedMode = 'client_firebase_storage';
      } else {
        cachedMode = recMode || 'client_firebase_storage';
      }
    } catch (err) {
      console.warn('[uploadMode] Health query failed, falling back to client storage mode:', err);
      cachedMode = 'client_firebase_storage';
    }
    return (cachedMode || 'client_firebase_storage') as 'backend_multer' | 'client_firebase_storage';
  })();

  return fetchPromise as Promise<'backend_multer' | 'client_firebase_storage'>;
}

export function forceClientUploadMode() {
  cachedMode = 'client_firebase_storage';
}

