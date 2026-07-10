import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";
import path from "node:path";

let cachedApp: any = null;
let cachedDb: any = null;
let cachedBucket: any = null;
let credentialInfo: any = null;

function ensureCredentialInfo() {
  if (credentialInfo) return;

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const hasKey = parsed.private_key 
        ? parsed.private_key.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n").includes("BEGIN PRIVATE KEY") 
        : false;

      credentialInfo = {
        credentialMode: "service_account_json",
        credentialsEmail: parsed.client_email || "unknown_json",
        hasPrivateKey: hasKey
      };
      return;
    } catch (e) {
      console.error("ensureCredentialInfo: Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON", e);
    }
  }

  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const hasKey = parsed.private_key 
        ? parsed.private_key.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n").includes("BEGIN PRIVATE KEY") 
        : false;

      credentialInfo = {
        credentialMode: "service_account_file",
        credentialsEmail: parsed.client_email || "unknown_file",
        hasPrivateKey: hasKey
      };
      return;
    } catch (e) {
      console.error("ensureCredentialInfo: Failed to parse GOOGLE_APPLICATION_CREDENTIALS file", e);
    }
  }

  credentialInfo = {
    credentialMode: "application_default",
    credentialsEmail: "unknown_adc",
    hasPrivateKey: false
  };
}

function loadCredential() {
  ensureCredentialInfo();

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
        throw new Error("INVALID_GOOGLE_APPLICATION_CREDENTIALS_JSON");
      }

      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n");

      return cert(parsed);
    } catch (e: any) {
      console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON in loadCredential:", e.message);
    }
  }

  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n");
      }
      return cert(parsed);
    } catch (e: any) {
      console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS file in loadCredential:", e.message);
    }
  }

  return applicationDefault();
}

let adminEnabled = true;
let initError: any = null;

export function getAdminApp() {
  if (cachedApp) return cachedApp;
  if (!adminEnabled) {
    return null;
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    "al-ai-chat";

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "al-ai-chat.firebasestorage.app";

  try {
    cachedApp = getApps()[0] || initializeApp({
      credential: loadCredential(),
      projectId,
      storageBucket
    });
    return cachedApp;
  } catch (e: any) {
    adminEnabled = false;
    initError = e;
    console.warn("[FIREBASE_ADMIN] Safe bypass: Firebase Admin initialization failed. Disabling admin features. Error:", e.message);
    return null;
  }
}

export function getAdminDb() {
  if (cachedDb) return cachedDb;

  const app = getAdminApp();
  if (!app) {
    throw new Error("ADMIN_FEATURE_DISABLED_IN_APPLET_SHARE");
  }

  let databaseId =
    process.env.FIRESTORE_DATABASE_ID ||
    process.env.VITE_FIRESTORE_DATABASE_ID;

  if (!databaseId) {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        databaseId = config.firestoreDatabaseId;
      }
    } catch (e) {
      console.warn("Failed to load firestoreDatabaseId from firebase-applet-config.json:", e);
    }
  }

  if (!databaseId) {
    throw new Error("CONFIG_ERROR_FIRESTORE_DATABASE_ID_MISSING");
  }

  cachedDb = getFirestore(app, databaseId);
  return cachedDb;
}

export function getAdminStorage() {
  const app = getAdminApp();
  if (!app) {
    throw new Error("ADMIN_FEATURE_DISABLED_IN_APPLET_SHARE");
  }
  return getStorage(app);
}

export function getAdminBucket() {
  if (cachedBucket) return cachedBucket;

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "al-ai-chat.firebasestorage.app";

  cachedBucket = getAdminStorage().bucket(storageBucket);
  return cachedBucket;
}

export function getAdminAuth() {
  const app = getAdminApp();
  if (!app) {
    throw new Error("ADMIN_FEATURE_DISABLED_IN_APPLET_SHARE");
  }
  return getAuth(app);
}

export function getAdminDbInfo() {
  ensureCredentialInfo();
  return {
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      "al-ai-chat",
    databaseId:
      process.env.FIRESTORE_DATABASE_ID ||
      process.env.VITE_FIRESTORE_DATABASE_ID ||
      null,
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      "al-ai-chat.firebasestorage.app",
    credentialMode: credentialInfo?.credentialMode || "not_initialized",
    credentialsEmail: credentialInfo?.credentialsEmail || "unknown",
    hasPrivateKey: credentialInfo?.hasPrivateKey === true,
    envPresent: {
      GOOGLE_APPLICATION_CREDENTIALS_JSON: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      FIRESTORE_DATABASE_ID: !!process.env.FIRESTORE_DATABASE_ID,
      FIREBASE_STORAGE_BUCKET: !!process.env.FIREBASE_STORAGE_BUCKET
    }
  };
}

export async function verifyFirebaseToken(authHeader: string | undefined) {
  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return { uid: 'dev-user-id', email: 'dev@example.com', name: 'Dev User', admin: true };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
      admin: decodedToken.admin || false
    };
  } catch (error) {
    throw new Error('Unauthorized: Invalid token');
  }
}

export async function requireUser(req: any) {
  return await verifyFirebaseToken(req.headers.authorization);
}

export async function requireAdmin(req: any) {
  const user = await requireUser(req);
  if (!user.admin && process.env.DEV_BYPASS_AUTH !== 'true') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}
