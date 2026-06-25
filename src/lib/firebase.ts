import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let firebaseApp: any = null;
let db: any = null;
let auth: any = null;
let isFirebaseEnabled = false;

if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.trim() !== "") {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    const dbId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-c097068e-a4a9-4ea3-9b00-0b3195093c42";
    db = getFirestore(firebaseApp, dbId);
    auth = getAuth(firebaseApp);
    isFirebaseEnabled = true;
    console.log("Firebase initialized successfully with config from firebase-applet-config.json on database: " + dbId);
  } catch (error) {
    console.error("Failed to initialize Firebase with standard config:", error);
  }
} else {
  console.info("Firebase API Key is missing. Operating in client-server DB file synchronization mode.");
}

export { firebaseApp, db, auth, isFirebaseEnabled };

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
