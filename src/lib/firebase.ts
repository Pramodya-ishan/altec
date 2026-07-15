import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';
import localConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID,
};

// Vercel projects often override only one or two public Firebase values.  Do
// not replace the complete checked-in client config with a partial env object:
// an undefined authDomain/appId makes Google sign-in appear to succeed and
// then immediately return to the sign-in screen.
const activeConfig = Object.fromEntries(
  Object.entries({ ...localConfig, ...firebaseConfig }).filter(([, value]) =>
    typeof value === 'string' ? value.trim().length > 0 : value != null
  )
) as typeof firebaseConfig;

let firebaseApp: any = null;
let db: any = null;
let auth: any = null;
let storage: any = null;
let appCheck: any = null;
let isFirebaseEnabled = false;

if (activeConfig && activeConfig.apiKey && activeConfig.apiKey.trim() !== "") {
  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(activeConfig);
    let dbId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || (activeConfig as any).firestoreDatabaseId;
    db = initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true
    }, dbId);

    auth = getAuth(firebaseApp);
    // Persist the Firebase user across page navigation, reloads and OAuth
    // popup completion. Failure is non-fatal (for example, private browsing).
    void setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('Firebase local auth persistence is unavailable:', error);
    });
    storage = getStorage(firebaseApp);
    storage.maxOperationRetryTime = 2000;
    storage.maxUploadRetryTime = 5000;
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
    if (appCheckSiteKey) {
      appCheck = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    isFirebaseEnabled = true;
    if (import.meta.env.DEV) {
      console.info("Firebase client initialized successfully.");
    }
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.info("Firebase API Key is missing. Operating in client-server DB file synchronization mode.");
}

export async function getFirebaseAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const result = await getToken(appCheck, false);
    return result.token || null;
  } catch (error) {
    console.warn('Failed to obtain Firebase App Check token', error);
    return null;
  }
}

export { firebaseApp, db, auth, storage, appCheck, isFirebaseEnabled };

// Standardized Firestore error logger as specified in SKILL.md
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
